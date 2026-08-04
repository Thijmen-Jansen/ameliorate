# Shepherd.js POC: Reliable CSS Targeting for React Flow Nodes

Experiment report — `driverJS-POC` branch.

## Goal

Prove that [Shepherd.js](https://shepherdjs.dev/) can be used to highlight elements inside this
app's onboarding UI, with the same hard/interesting case as the earlier experiments: **nodes inside
the React Flow diagram**. See
[`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md) and
[`docs/reports/react-joyride-node-targeting.md`](./react-joyride-node-targeting.md) for the first
two POCs in this series.

## Problem

Diagram nodes are dynamic and user-created, so there's no ID known ahead of time. This was already
solved by the driver.js POC — `EditableNode`/`FlowNode` stamp a stable `data-tour="node-<id>"`
attribute directly onto the rendered node element. That plumbing is app-level, not library-specific,
so this experiment reuses it as-is with **zero changes** to `EditableNode.tsx` or `FlowNode.tsx`.

The actual question for this POC was the same narrower one as for react-joyride: given that a
`[data-tour^="node-"]` selector exists, what's the marginal work for Shepherd.js specifically to
target an element that may not exist in the DOM yet when the tour is configured?

## Investigation

1. **API shape.** Shepherd.js is fully imperative and class-based: `new Shepherd.Tour(options)`,
   then `tour.addStep({...})` per step, then `tour.start()`. This is the closest of the three POCs to
   driver.js's API shape — no hook, no React component to render, just a `Tour` instance driven from
   a plain `onClick`.

2. **How does target resolution work?** Per `StepOptionsAttachTo` in
   `node_modules/shepherd.js/dist/js/shepherd.d.mts`, `attachTo.element` accepts a CSS selector
   string, an `HTMLElement`, `null`, or a zero-arg function returning one of those. Like driver.js,
   this is resolved when the step is actually shown (in `Step#_setupElements`/`_resolveAttachToOptions`),
   not upfront when the tour is constructed — so a step whose target doesn't exist yet is fine as
   long as it exists by the time that step is reached. Unlike react-joyride, there's no built-in
   `MutationObserver`/wait-timeout: if the target still isn't there when the step is shown, the step
   just renders without an anchored position (floating in the center), same tradeoff as driver.js.

3. **Could the same prefix-match selector be used directly?** Not quite as directly as with
   react-joyride. `attachTo.element` is queried once per step-show via a single
   `document.querySelector`-style lookup rather than being re-evaluated reactively, so a raw
   `'[data-tour^="node-"]'` string would technically work the same way it does for driver.js and
   react-joyride. This POC kept the driver.js POC's small `findFirstNodeSelector()` helper (resolving
   to one concrete `[data-tour="node-<id>"]` string ahead of building the steps) purely so the second
   step can be conditionally omitted when no node exists yet — not because Shepherd.js required it.

4. **A real TypeScript/lint friction point.** Shepherd's step `buttons[].action` type is
   `(this: Tour) => void` — the docs show passing bound instance methods directly, e.g.
   `action: tour.next`. Doing that here tripped the repo's
   `@typescript-eslint/unbound-method` ESLint rule (an unbound class method reference can silently
   lose its `this` binding when detached from its instance). Fixed by wrapping the calls in arrow
   functions (`action: () => tour.next()`) instead of passing the method references directly — this
   is a real, if minor, extra step that neither driver.js nor react-joyride required, since neither
   exposes instance-bound methods as step-config values in the same way.

## Solution

No new DOM plumbing — reuses `data-tour="node-<id>"` from the driver.js POC. Added:

- **`ShepherdTourPOC.tsx`** (new, isolated POC file, mirroring `DriverTourPOC.tsx`): builds a
  `Shepherd.Tour` with up to two steps (static demo text → diagram node, the second step omitted if
  no node is found), and exports a floating trigger button that calls `tour.start()`.
- **`TopicWorkspace.tsx`**: mounted `<ShepherdTourPOCButton />` alongside the existing
  `@reactour/tour`-based tutorial components and the driver.js/react-joyride POC buttons, so all
  three experiments can be triggered side by side for comparison.

## Why this is reliable

Same reasoning as the other two POCs: the query is a prefix match rather than a hardcoded ID, so it
resolves to whichever node happens to be rendered:

```ts
document.querySelector('[data-tour^="node-"]');
```

The `node-<id>` naming convention still makes this prefix match safe against unrelated `data-tour`
values elsewhere in the app (e.g. `poc-static-text`, `poc-static-text-joyride`,
`poc-static-text-shepherd`). Because the node's `data-tour` attribute is applied directly by React to
an always-rendered element with real dimensions, targeting it doesn't depend on any driver/tour
library's internal DOM structure.

## Code changes

| File | Change |
|---|---|
| `package.json` / `package-lock.json` | Added `shepherd.js` (15.2.2) dependency. |
| `src/web/topic/components/TopicWorkspace/ShepherdTourPOC.tsx` | New, isolated POC file: finds a node via `[data-tour^="node-"]`, builds a Shepherd.js tour (static demo text → diagram node), exports a floating trigger button. |
| `src/web/topic/components/TopicWorkspace/TopicWorkspace.tsx` | Mounted `<ShepherdTourPOCButton />` alongside the existing `@reactour/tour` tutorial components and the driver.js/react-joyride POC buttons. |

No changes were needed to `EditableNode.tsx` or `FlowNode.tsx` — the `dataTour` prop plumbing added
for the driver.js POC was reused unmodified.

## Verification

- `npm run check-types` — no errors.
- `npx eslint` on all touched files — no errors (after fixing the `unbound-method` issue described
  above).
- Manual browser check on the Playground (`/playground`): clicking the "Shepherd.js Tour (POC)"
  button highlights the demo static text first, then advances to highlight an actual node in the
  diagram, confirming the `data-tour="node-<id>"` selector reliably resolves to a real, visible DOM
  element (verified by the repo owner).

## Implementation Effort & Difficulty

### Criteria

Same criteria and scoring scale used for the driver.js and react-joyride POCs, so results stay
directly comparable. See
[`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md#criteria) for full
definitions. Each is rated **1 (trivial) – 5 (very difficult)**.

| # | Criterion | What it measures |
|---|---|---|
| 1 | **Setup effort** | Installing the package, importing its CSS/JS, and getting *one* highlight working from a cold start. |
| 2 | **Dynamic element targeting** | Marginal work to reliably target an element that doesn't exist at build time (like a diagram node), *given the `data-tour` plumbing already exists*. |
| 3 | **Framework integration friction** | How naturally the library's API fits React's render cycle — imperative call vs. component/hook, ref handling, cleanup on unmount, re-render safety. |
| 4 | **Styling/theming effort** | Work needed to make the tour's popover/overlay visually match the app (colors, fonts, spacing) rather than looking like a stock default. |
| 5 | **TypeScript support** | Completeness/accuracy of shipped or `@types` definitions — did types need casting, `any`, or manual augmentation? |
| 6 | **API surface / learning curve** | How much documentation reading was needed before the first working step, and how large/consistent the config API is. |
| 7 | **Bundle size / dependencies** | Footprint added to the app (package size, transitive dependencies). |

As with the other two POCs, criterion 2 doesn't re-charge the cost of the `data-tour` plumbing itself
(that's shared, one-time, app-level work) — only the marginal work Shepherd.js needed on top of a
selector already being available.

### Score: Shepherd.js

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Setup effort | **1** | `npm install shepherd.js`, one CSS import (`shepherd.js/dist/css/shepherd.css`), `new Shepherd.Tour({ steps }).start()` — no provider/context, no wrapping component tree required. Nearly identical setup shape to driver.js. |
| 2 | Dynamic element targeting | **2** | `attachTo.element` accepts a plain CSS selector string (or a zero-arg function returning one), resolved lazily when the step is shown, tolerating nodes that don't exist yet at call time as long as they exist by the time that step is reached — functionally identical to driver.js. No built-in retry/observer like react-joyride's, so a node that mounts *after* its step has already shown up empty won't be picked up automatically. |
| 3 | Framework integration friction | **2** | Fully imperative (`new Shepherd.Tour().start()`), not a React component or hook — trivial to trigger from a plain `onClick`, same tradeoff as driver.js: no built-in React lifecycle integration (no auto-cleanup on unmount, no reactive re-targeting if the app's state changes mid-tour). |
| 4 | Styling/theming effort | **2** | Ships a more visually "branded" default theme (rounded card, drop shadow, arrow) than driver.js's plainer popover, themeable via CSS custom properties (`--shepherd-*`) and the `classes` step option — straightforward but more surface to learn than driver.js's single `popoverClass` escape hatch; not themed for this POC. |
| 5 | TypeScript support | **2** | Ships its own `.d.mts`/`.d.cts`, fully typed `Tour`/`Step`/`StepOptions`; no casts or `any` needed, but passing bound instance methods (`tour.next`) directly as a button `action` tripped the repo's `@typescript-eslint/unbound-method` rule and needed wrapping in arrow functions — a small but real friction point neither of the other two libraries hit. |
| 6 | API surface / learning curve | **2** | `Tour`/`Step` classes with `addStep`/`addSteps`, button `action`s bound to the tour instance, `useModalOverlay`, and an `Evented` base class for `on`/`once`/`off` — a bit more surface than driver.js's single flat `steps` array (instance methods and modal-overlay concepts to learn), but far smaller than react-joyride's controlled/uncontrolled + lifecycle + hook-return-value surface. |
| 7 | Bundle size / dependencies | **2** | ~42KB uncompressed JS (`dist/js/shepherd.mjs`), 2 runtime dependencies (`@floating-ui/dom`, `deepmerge-ts`) plus their transitive deps — heavier than driver.js's zero-dependency ~5KB footprint, but noticeably lighter and fewer dependencies than react-joyride's ~30KB/9-dependency footprint. |

**Total: 13 / 35** — **Overall difficulty: Low–Medium**

**Time spent:** roughly 20–30 minutes hands-on, on par with the react-joyride POC and faster than
driver.js's original 30–45 minutes, since the `data-tour` plumbing was already in place. Most of the
time went into reading Shepherd's bundled type definitions to confirm target-resolution timing, plus
diagnosing and fixing the `unbound-method` lint error.
