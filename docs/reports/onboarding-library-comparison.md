# Onboarding Library Comparison: driver.js vs. react-joyride vs. Shepherd.js vs. UserTour

Final comparison report — `driverJS-POC` branch.

**Scope note:** the four POCs behind this comparison were built and verified inside *this* repo
(a TypeScript app) purely as an experimentation sandbox — it happened to already have a React Flow
diagram with dynamic nodes, which is a good stand-in for the hard case any React Flow app faces. The
actual target for this recommendation is a **different, separate application**: one built with React
Flow and **plain JavaScript** (not TypeScript). Everything below is written for that target app, not
for this sandbox repo — findings that were specific to this repo's setup (its existing
`@reactour/tour` tutorial system, its specific node-component structure, its TypeScript/ESLint config)
are called out explicitly as such, so they aren't mistaken for requirements of the target app.

Individual reports (read these first for full detail/evidence — all four were built and, except
UserTour, verified against *this* repo's React Flow diagram):

- [`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md) — hands-on, verified
- [`docs/reports/react-joyride-node-targeting.md`](./react-joyride-node-targeting.md) — hands-on, verified
- [`docs/reports/shepherdjs-node-targeting.md`](./shepherdjs-node-targeting.md) — hands-on, verified
- [`docs/reports/usertour-node-targeting.md`](./usertour-node-targeting.md) — documentation-based only, **not** run or verified (no account/self-hosted instance available)

## What transfers to the target app, and what doesn't

The parts of these POCs that are about **React Flow's own architecture** transfer directly to any
React Flow app, including the target one — React Flow behaves the same way regardless of which
application embeds it. The parts that are about **this specific repo** (its existing tutorial system,
its `EditableNode`/`FlowNode` component chain, its strict TypeScript/ESLint setup) do not transfer, and
are noted below so they aren't read as requirements for the target app.

## The pattern every library needs, generalized for the target app

All four POCs here relied on one piece of app-level plumbing: a stable `data-tour="node-<id>"`
attribute applied directly to each node's actual rendered DOM element, queried generically via a
prefix match:

```js
document.querySelector('[data-tour^="node-"]');
```

This pattern is **library-agnostic and framework-generic** — it'll need to be replicated in the target
app, but the shape of the work is predictable: find wherever the target app's custom node component
renders its outermost DOM element, and make sure a per-node identifier (React Flow already guarantees
`node.id` is unique) reaches that element as a real DOM attribute. In this repo that meant drilling a
`dataTour` prop through two wrapper component layers (`FlowNode` → `EditableNode`) — the target app's
component structure is unknown, but the same category of investigation (does the outermost prop reach
the DOM, or get silently dropped by an intermediate wrapper) is a near-certain first step there too.

One shortcut worth knowing about regardless: **React Flow itself already stamps
`.react-flow__node[data-id="<node-id>"]` on every node's wrapper, for free, with zero app code.** This
repo's driver.js POC deliberately avoided relying on that (to not couple tour selectors to React
Flow's internal markup, which could change), but for the target app it's worth weighing as a
zero-setup alternative to adding a custom `data-*` attribute, especially if the target app doesn't
already have a natural place to plumb one through.

## React Flow architecture facts that apply to the target app too

These are general React Flow behaviors (confirmed by reading this repo's diagram code, but true of
React Flow generally, not specific to this repo) that matter for choosing among these libraries in
*any* React Flow app:

- **Node virtualization is opt-in and off by default.** React Flow only skips rendering off-screen
  nodes if the app explicitly passes `onlyRenderVisibleElements`. If the target app doesn't set this,
  every node's DOM element (and its targeting attribute) exists at all times, regardless of current
  pan position — worth explicitly checking in the target app's `<ReactFlow>` props, since it changes
  whether a targeting selector can even find an off-screen node.
- **Pan/zoom is a CSS transform, not native scrolling.** React Flow positions its
  `.react-flow__viewport` via a `transform` driven by its own internal viewport state (exposed through
  `useReactFlow()`'s `getViewport`/`setViewport`/`fitView`), not by a scrollable container's
  `scrollTop`/`scrollLeft`. This is true in any React Flow app. All four tour libraries position their
  spotlight/popover using `getBoundingClientRect()` on the target element, which correctly reflects
  wherever the transform has currently placed the node — so **if a node is currently rendered
  on-screen, all four libraries should highlight it correctly**, transform and all.

### The gap none of the four POCs tested — and it'll matter for the target app too

None of the four POCs tested what happens when the target node has been **panned outside the visible
viewport** before a tour step tries to show it (in this repo's Playground, the target node was already
on-screen after React Flow's own initial `fitView`). This matters for *any* React Flow app because of
the point above: React Flow's canvas isn't scrolled in the traditional sense, so each library's
built-in "bring the target into view" feature — driver.js's default scroll-to-step behavior,
react-joyride's `scrollTo`/`scrollOffset` options, Shepherd's `scrollTo`/`scrollToHandler` options —
is built around calling `scrollIntoView()` / adjusting `scrollTop` on a scrollable ancestor. A React
Flow diagram pane has no such scrollable ancestor to adjust; an off-screen node's position only
changes when the library's own viewport transform changes.

**Practical implication for the target app, not yet verified in any POC:** if a tour step's target
node is off-screen when that step is shown, none of driver.js/react-joyride/Shepherd's built-in
scroll-to-target behavior would be expected to pan the React Flow canvas to reveal it. This isn't a
defect in any one library; it's a consequence of React Flow's architecture that applies equally to all
of them (and to UserTour's dashboard-driven approach too).

**The fix is the same regardless of which library the target app picks**, and doesn't depend on this
repo at all: before a node-targeting step is shown, call React Flow's own `useReactFlow()` API —
`setViewport(...)` or `fitView({ nodes: [targetNode] })` — to pan the node into view, *then* let the
chosen library's normal `getBoundingClientRect()`-based highlighting take over once the node is
actually on-screen. (This repo happens to already have a small helper that wraps exactly this,
`moveViewportToIncludeNode` in `src/web/topic/hooks/flowHooks.ts`, built on the same public
`useReactFlow()` API — useful as a reference for the shape of that glue code, not as something the
target app can reuse directly.)

## Target-resolution mechanics, side by side

| | driver.js | react-joyride | Shepherd.js | UserTour |
|---|---|---|---|---|
| Selector shape | `string \| Element \| (() => Element)` | `string \| HTMLElement \| ref \| (() => Element)` | `string \| HTMLElement \| null \| (() => Element \| string \| null)` | Dashboard-authored (OpenPicker or hand-typed CSS) |
| When resolved | Lazily, when that step is shown | Lazily, when that step is active | Lazily, when that step is shown | Unknown — no docs on timing |
| Waits/retries if not yet mounted? | No — must exist by step time | **Yes** — `MutationObserver` + `targetWaitTimeout` (default 1000ms) | No — must exist by step time | Unknown — undocumented |
| Built-in "scroll target into view"? | Yes (assumes scrollable ancestor) | Yes, `scrollTo`/`scrollOffset` (assumes scrollable ancestor) | Yes, `scrollTo`/`scrollToHandler` (assumes scrollable ancestor, but `scrollToHandler` can be overridden with custom logic — see below) | Unknown |

react-joyride is the only one of the four with an active, documented mechanism for a target that
doesn't exist *yet*. Shepherd's `scrollToHandler` override is worth flagging specifically for a React
Flow app: it's the one documented, ready-made escape hatch for plugging in exactly the "call
`fitView`/`setViewport` instead of `scrollIntoView`" logic described above, without needing to bypass
the library's own step-advancement flow. driver.js and react-joyride would need a similar override
built by hand (e.g., calling `fitView` in a step's `onNext`/lifecycle callback before it's shown).

## Implementation effort scores, side by side

Pulled directly from the four individual reports (same 7 criteria, same 1–5 scale, defined in
[`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md#criteria)). These scores were
measured hands-on **in this TypeScript repo** — see the JavaScript-specific caveat right after the
table for how criterion 5 should be re-read for the target app. UserTour's row is lower-confidence —
see its report.

| # | Criterion | driver.js | react-joyride | Shepherd.js | UserTour |
|---|---|---|---|---|---|
| 1 | Setup effort | 1 | 1 | 1 | 4 |
| 2 | Dynamic element targeting | 2 | 1 | 2 | 3 |
| 3 | Framework integration friction | 2 | 2 | 2 | 2 |
| 4 | Styling/theming effort | 1 | 2 | 2 | 3 |
| 5 | TypeScript support | 1 | 1 | 2 | 3 |
| 6 | API surface / learning curve | 1 | 3 | 2 | 3 |
| 7 | Bundle size / dependencies | 1 | 3 | 2 | 1 |
| | **Total** | **9 / 35** | **13 / 35** | **13 / 35** | **19 / 35** |
| | **Overall difficulty** | **Low** | **Low–Medium** | **Low–Medium** | **Medium** *(unverified)* |
| | Integration style | Imperative | Hook (`useJoyride`) | Imperative (class-based) | Hosted platform; code only triggers dashboard content |
| | Bundle footprint | ~5KB, 0 deps | ~30KB, 9 deps | ~42KB uncompressed, 2 deps | <16KB gzipped (loader ~0 deps), but requires a backend |

**JavaScript-specific re-read of criterion 5:** all three client-side libraries ship their own type
definitions, but a plain-JavaScript target app gets no compile-time benefit from that (only optional
editor autocomplete, if the target app's tooling reads `.d.ts` files from `node_modules` at all).
Shepherd.js's score in this table includes a real friction point encountered in this repo — passing
`tour.next` directly as a button action tripped the `@typescript-eslint/unbound-method` ESLint rule —
but that rule is TypeScript-specific and requires a fairly strict ESLint config; **it almost certainly
won't apply in a plain-JavaScript project**, so Shepherd's effective score for the target app is likely
closer to driver.js's on this axis. Net effect: criterion 5 should carry less weight than the other six
when comparing these three for a JavaScript target app.

## Recommendation (for the target React Flow + JavaScript app)

- **driver.js is the strongest starting point.** It's the lightest library, has the smallest API
  surface to learn, and its imperative `driver({ steps }).drive()` call needs nothing beyond a plain
  function call from wherever the target app wants to trigger a tour — no provider, no hook, no JSX
  element to render. Its two real weaknesses (no active wait for late-mounted targets, no
  transform-aware scroll-into-view) are shared by Shepherd.js too, and are best solved once at the
  app level regardless of library choice (see the pan/zoom section above), not by picking a heavier
  library.
- **react-joyride is the one to reach for if the target app needs to target nodes that don't exist yet
  when a tour *starts*** — e.g., a guided "click here to create your first node" flow, where the
  target genuinely doesn't exist until the user acts. Its `MutationObserver`-based wait is the only
  one of the four with real, built-in support for that scenario. That comes at a real cost: roughly
  6x driver.js's bundle weight and 9 transitive dependencies, plus a materially larger API surface
  (controlled/uncontrolled modes, lifecycle events, hook-return-value shape) to learn.
- **Shepherd.js doesn't clearly win over driver.js on any axis** for a plain-JavaScript React Flow app
  — similar imperative integration style and comparable effort to driver.js, but heavier
  (~42KB vs. ~5KB, 2 dependencies vs. zero) with no offsetting capability, since the
  `@typescript-eslint/unbound-method` friction this repo hit won't reproduce in JavaScript. Its one
  genuine edge is the documented `scrollToHandler` override, which is the most direct place to plug in
  custom "pan the React Flow canvas into view" logic if that becomes a real requirement — worth
  reconsidering only if that specific need arises.
- **UserTour is a different category of tool, not a peer to the other three.** It trades code-level
  control (and, for this evaluation, verifiability — this report's findings on it were never run
  against a live instance) for a non-technical, dashboard-driven flow-authoring workflow. It's worth
  considering only if there's a genuine desire for non-engineers to build/edit onboarding content
  without shipping code changes to the target app — a real and valid use case, but a different kind of
  project decision than "which client-side library to `npm install`," and one that first requires
  standing up a UserTour account or self-hosted instance to properly evaluate against the target app's
  actual diagram.

**Independent of which library the target app picks:** the off-screen/panned-node gap described above
applies to all three client-side libraries and isn't solved by picking a "smarter" one — it needs one
small piece of app-level glue code (calling React Flow's own `fitView`/`setViewport` before showing a
node-targeting step) that the target app would write once, using React Flow's public API, and that
would work the same way regardless of which of the three is adopted.
