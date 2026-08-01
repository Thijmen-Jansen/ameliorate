# React Joyride POC: Reliable CSS Targeting for React Flow Nodes

Experiment report — `driverJS-POC` branch.

## Goal

Prove that [react-joyride](https://react-joyride.com/) can be used to highlight elements inside
this app's onboarding UI, with the same hard/interesting case as the driver.js experiment: **nodes
inside the React Flow diagram**. See
[`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md) for the first POC in this
series and the full writeup of why diagram nodes are hard to target in the first place.

## Problem

Diagram nodes are dynamic and user-created, so there's no ID known ahead of time. The driver.js POC
already solved the underlying plumbing problem — `EditableNode`/`FlowNode` now stamp a stable
`data-tour="node-<id>"` attribute directly onto the rendered node element. That plumbing is
app-level, not driver.js-specific, so this experiment reuses it as-is with **zero changes** to
`EditableNode.tsx` or `FlowNode.tsx`.

The actual question for this POC was narrower: given that a `[data-tour^="node-"]` selector exists,
what's the marginal work for react-joyride specifically to target an element that may not exist in
the DOM yet at the moment the tour is configured?

## Investigation

1. **API shape.** React Joyride 3.x ships two APIs: a `<Joyride run steps={...} />` component, and a
   `useJoyride({ steps })` hook that returns `{ controls, state, Tour }`. The hook API was chosen
   for this POC since it mirrors driver.js's imperative "click a button, start a tour" trigger most
   closely — `controls.start()` — while the hook still returns a `Tour` React element that must be
   rendered into the tree (unlike driver.js's fully imperative `.drive()`).

2. **How does target resolution work?** Read through `node_modules/react-joyride/src/modules/dom.ts`
   and `src/hooks/useTargetPosition.ts`: a step's `target` (string, `HTMLElement`, ref, or function)
   is resolved via `getElement()`, which calls `document.querySelector()` for string targets. Unlike
   driver.js, this resolution isn't just lazy per-step — if the target isn't found immediately,
   `useTargetPosition` sets up a `MutationObserver` on `document.body` and keeps watching until a
   matching element appears (bounded by the `targetWaitTimeout` option, default 1000ms). This is
   strictly more forgiving than driver.js, which expects the element to exist by the time its step is
   shown but does no active waiting/observing itself.

3. **Could the same prefix-match selector be used directly?** Yes — `document.querySelector` natively
   supports the `^=` attribute prefix syntax, and because react-joyride re-resolves `target` from the
   raw string per-step (rather than requiring a pre-resolved concrete selector or DOM reference up
   front), `'[data-tour^="node-"]'` could be passed straight into the step config. This is simpler
   than the driver.js POC, which needed a small `findFirstNodeSelector()` helper to resolve the
   prefix match to one concrete `[data-tour="node-<id>"]` string ahead of building the `steps` array.

## Solution

No new DOM plumbing — reuses `data-tour="node-<id>"` from the driver.js POC. Added:

- **`JoyrideTourPOC.tsx`** (new, isolated POC file, mirroring `DriverTourPOC.tsx`): defines a 2-step
  `steps` array (static demo text → diagram node) using the `useJoyride` hook, and exports a floating
  trigger button that calls `controls.start()` and renders the returned `Tour` element.
- **`TopicWorkspace.tsx`**: mounted `<JoyrideTourPOCButton />` alongside (not replacing) the existing
  `@reactour/tour`-based tutorial components and the driver.js POC button, so both experiments can be
  triggered side by side for comparison.

## Why this is reliable

Same reasoning as the driver.js POC: the query is a prefix match rather than a hardcoded ID, so it
resolves to whichever node happens to be rendered:

```ts
target: '[data-tour^="node-"]';
```

The `node-<id>` naming convention still makes this prefix match safe against unrelated `data-tour`
values elsewhere in the app (e.g. `poc-static-text`, `poc-static-text-joyride`). Because
react-joyride actively watches for the target via `MutationObserver` (rather than only checking
once), it's additionally tolerant of the diagram node mounting *after* the tour has already started,
which driver.js is not.

## Code changes

| File | Change |
|---|---|
| `package.json` / `package-lock.json` | Added `react-joyride` (3.2.0) dependency. |
| `src/web/topic/components/TopicWorkspace/JoyrideTourPOC.tsx` | New, isolated POC file: builds a 2-step react-joyride tour (static demo text → diagram node) via `useJoyride`, exports a floating trigger button. |
| `src/web/topic/components/TopicWorkspace/TopicWorkspace.tsx` | Mounted `<JoyrideTourPOCButton />` alongside the existing `@reactour/tour` tutorial components and the driver.js POC button. |

No changes were needed to `EditableNode.tsx` or `FlowNode.tsx` — the `dataTour` prop plumbing added
for the driver.js POC was reused unmodified.

## Verification

- `npm run check-types` — no errors.
- `npx eslint` on all touched files — no errors.
- Manual browser check on the Playground (`/playground`): clicking the "React Joyride Tour (POC)"
  button highlights the demo static text first, then advances to highlight an actual node in the
  diagram, confirming the `[data-tour^="node-"]` selector reliably resolves to a real, visible DOM
  element (verified by the repo owner).

## Implementation Effort & Difficulty

### Criteria

Same criteria and scoring scale used for the driver.js POC, so results stay directly comparable. See
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

As with the driver.js POC, criterion 2 doesn't re-charge the cost of the `data-tour` plumbing itself
(that's shared, one-time, app-level work) — only the marginal work react-joyride needed on top of a
selector already being available.

### Score: react-joyride

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Setup effort | **1** | `npm install react-joyride`, no separate CSS import needed (styles are inlined via JS), `useJoyride({ steps })` + rendering the returned `Tour` element — no provider/context required. |
| 2 | Dynamic element targeting | **1** | Accepts a plain CSS selector string per step, same as driver.js, but goes further: if the target isn't found immediately it sets up a `MutationObserver` and keeps waiting (bounded by `targetWaitTimeout`), so it tolerates the node mounting *after* the tour has started, not just before its step is reached. |
| 3 | Framework integration friction | **2** | The hook (`useJoyride`) fits React's render cycle more natively than driver.js's fully imperative `.drive()` — cleanup and re-render safety come from React itself. But it's a bigger mental model: the hook returns `controls`/`state`/`Tour`, and the returned `Tour` element has to actually be rendered in JSX for anything to show up, which is one more moving part than driver.js's single function call. |
| 4 | Styling/theming effort | **2** | Default styling is clean out of the box, not themed for this POC. Theming surface (`options`, per-part `styles` object covering arrow/beacon/tooltip/overlay/buttons individually) is more powerful but also more to learn than driver.js's single `popoverClass` escape hatch. |
| 5 | TypeScript support | **1** | Ships its own types (`dist/index.d.cts`/`.d.mts`); the `useJoyride` return value, `Step`, and `Controls` types are all fully typed with no casts or `any` needed in the POC code. |
| 6 | API surface / learning curve | **3** | v3's API is meaningfully larger than driver.js's: separate `Step`/`Props`/`EventData`/`Controls`/`State` types, controlled vs. uncontrolled modes, `before`/`after` step hooks, and an `ACTIONS`/`EVENTS`/`STATUS`/`LIFECYCLE` literal system to understand before reliably driving anything beyond the default flow. Needed to read through several type/module files (not just top-level docs) to find how target resolution and waiting actually worked. |
| 7 | Bundle size / dependencies | **3** | ~30KB per format per the package's own `size-limit` budget (esm/cjs), with 9 runtime dependencies (`@floating-ui/react-dom`, `scroll`, `scrollparent`, `use-sync-external-store`, etc.) — noticeably heavier than driver.js's zero-dependency, ~5KB footprint. |

**Total: 13 / 35** — **Overall difficulty: Low–Medium**

**Time spent:** roughly 20–30 minutes hands-on. Notably less than the driver.js POC's 30–45 minutes,
because the `data-tour` plumbing was already in place and didn't need to be re-derived — nearly all
of the time here went into reading react-joyride's type definitions and DOM-resolution modules
directly (v3's hook API is newer and less covered by existing tutorials/StackOverflow answers than
its older callback-based v2 API).
