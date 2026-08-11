# Plan: Off-Screen Node Tour POC

Implementation plan for a working demo of bringing a currently off-screen React Flow node into view
as part of a tour step. Builds on the findings in
[`docs/reports/off-screen-node-targeting.md`](../reports/off-screen-node-targeting.md).

## Goal

A single demo button that:

1. Deliberately pans the diagram viewport away from a target node, so it's genuinely off-screen
   (not just theoretically — visible proof for whoever clicks the button).
2. Starts a short tour whose final step targets that node, panning the viewport back to include it
   *before* the popover is positioned/shown.

## Library choice: Shepherd.js

Per the off-screen-node-targeting report, Shepherd.js is the only one of the three libraries with a
documented extension point for replacing its default (scroll-based) reveal behavior. The existing
`ShepherdTourPOC.tsx` is also the closest match structurally, so this extends that pattern rather than
starting from driver.js or react-joyride.

## Mechanism: `beforeShowPromise`, not `scrollToHandler`

The earlier report flagged `scrollToHandler` as Shepherd's escape hatch, but on closer look it's the
wrong hook for this specific job:

- `scrollToHandler` replaces *how* Shepherd scrolls to the target, but it's invoked synchronously as
  part of the step's show flow — it doesn't clearly support Shepherd awaiting an async pan animation
  before it positions the popover (`getViewportToIncludeNode`-style panning in this app animates over
  a duration, e.g. `setViewport(vp, { duration: 500 })`).
- **`beforeShowPromise`** is a step option built for exactly this shape of problem: it's a function
  returning a `Promise`, and Shepherd waits for that promise to resolve before it shows/positions the
  step. Its documented use case is literally "lazily load an element" — panning a node into view is
  the same category of problem (element isn't ready/visible yet).

**Plan: use `beforeShowPromise` on the target step**, resolving the returned promise only after the
pan animation completes. This sidesteps a subtler risk with `scrollToHandler`: Shepherd positions its
popover using floating-ui, whose `autoUpdate` tracking (ancestor scroll/resize) may not reliably catch
a node moving purely due to a CSS `transform` on an ancestor mid-animation. Awaiting full completion
before Shepherd ever measures the target's position avoids relying on that tracking altogether.

**To verify at implementation time:** whether `useReactFlow().setViewport()` (and `fitView()`) in the
installed `@xyflow/react` version actually returns a `Promise` that resolves on animation-end. If it
doesn't, fall back to `duration: 0` (instant jump, no promise needed) or a `setTimeout` matching the
configured `duration` inside the `beforeShowPromise` executor.

## Where the new code has to live: inside `ReactFlowProvider`

This is the one hard constraint that didn't apply to the other three POCs. `DriverTourPOC.tsx`,
`JoyrideTourPOC.tsx`, and `ShepherdTourPOC.tsx` are all plain functions/components mounted in
`TopicWorkspace.tsx` ([`TopicWorkspace.tsx:206-208`](../../src/web/topic/components/TopicWorkspace/TopicWorkspace.tsx#L206-L208)) — outside `<Diagram />`. They never needed
React Flow's imperative API because `getBoundingClientRect()`-based highlighting works regardless of
where the button lives.

Panning the viewport is different: it requires `useReactFlow()` (for `setViewport`/`getViewport`/
`fitView`/`getNode`), and that hook only works inside the `<ReactFlowProvider>` that wraps
`<StyledReactFlow>` in [`Diagram.tsx`](../../src/web/topic/components/Diagram/Diagram.tsx) (provider
added at `Diagram.tsx:335-337`). So the new trigger **cannot** be mounted in `TopicWorkspace.tsx` like
the other three POCs — it has to render inside `Diagram.tsx`'s component tree instead.

Two ways to satisfy that, in order of preference:

1. **New component rendered from within `Diagram.tsx`.** Add `<OffscreenNodeTourPOCButton />` as a
   sibling to `<StyledReactFlow>` inside `DiagramWithoutProvider`'s returned JSX (so it's inside the
   provider) instead of in `TopicWorkspace.tsx`. Minimal, explicit, keeps the "where does this button
   live" logic obvious from reading `Diagram.tsx`.
2. **Extend `externalFlowStore.ts`.** That file already exists specifically to leak React Flow state
   (`getNodes`, `getNodesBounds`) out past the provider boundary for exactly this kind of situation.
   Could add `setViewport`/`fitView`/`getNode` to it and keep the button in `TopicWorkspace.tsx` for
   visual consistency with the other three. More consistent placement, but pulls viewport-mutation
   methods into a store explicitly documented as "pretty jank" — expands its scope beyond its current
   read-only purpose.

**Plan: option 1.** It's less code, and the location constraint is inherent to this specific demo
(off-screen panning), not something worth generalizing into shared plumbing for a POC.

## Node selection & how "off-screen" gets demonstrated

Reuse the existing `[data-tour^="node-"]` prefix-match convention from the other three POCs — no new
DOM plumbing needed. New logic on top of that:

1. On trigger click, resolve the target's React Flow node object via `useReactFlow().getNode(id)`
   (needed for `fitView({ nodes: [...] })`), using the same `data-tour` attribute to get the `id`.
2. **Pan away first:** call `setViewport({ x, y, zoom }, { duration: 300 })` with coordinates
   chosen to be far outside the target node's position (e.g. offset a large fixed amount from the
   node's own `x`/`y`, not just an arbitrary constant, so this works regardless of where the diagram
   happens to be laid out). This is the "before" state — visible confirmation the node is genuinely
   off-screen before the tour starts, not just assumed.
3. **Start the Shepherd tour** with two steps, mirroring the existing POC's shape:
   - Step 1: static intro text (existing `poc-static-text-shepherd` element), explaining what's about
     to happen.
   - Step 2: the diagram node, with `beforeShowPromise` panning the viewport back via
     `fitView({ nodes: [node], duration: 400 })` (or `setViewport`), resolving once that finishes.

This keeps the demo self-contained and repeatable — clicking the button always reproduces the
off-screen condition first, rather than depending on the diagram's current pan state.

## Preconditions confirmed already true in this repo

- Node virtualization is off: `<StyledReactFlow>` in `Diagram.tsx` does not set
  `onlyRenderVisibleElements`, so the target node's DOM element (and its `data-tour` attribute) exists
  regardless of current pan position — required for `document.querySelector('[data-tour^="node-"]')`
  to find it even while off-screen.

## File-by-file changes

| File | Change |
|---|---|
| `src/web/topic/components/TopicWorkspace/OffscreenNodeTourPOC.tsx` | New. Exports `OffscreenNodeTourPOCButton`, a component using `useReactFlow()` — pans away on click, then runs a 2-step Shepherd tour whose second step's `beforeShowPromise` pans the node back into view. |
| `src/web/topic/components/Diagram/Diagram.tsx` | Render `<OffscreenNodeTourPOCButton />` inside `DiagramWithoutProvider`'s returned JSX (inside `ReactFlowProvider`), not in `TopicWorkspace.tsx`. |

No changes needed to `EditableNode.tsx`/`FlowNode.tsx` (the `data-tour` plumbing already exists) or to
`TopicWorkspace.tsx`.

## Risks / open questions to resolve while implementing

- **Does `setViewport`/`fitView` return a `Promise` in the installed `@xyflow/react` version?**
  Determines whether `beforeShowPromise` can await it directly or needs a `setTimeout` fallback (see
  above).
- **Does Shepherd's popover reposition correctly on the very first render after `beforeShowPromise`
  resolves**, or does it need a forced re-measure (e.g. calling `tour.getCurrentStep()?.updateStepOptions({})`
  or similar) once the pan finishes? Worth checking against Shepherd's actual behavior once dependencies
  are installed, since this wasn't verified in the original Shepherd.js POC (target was always
  already on-screen there).
- **Picking a "far enough" pan-away offset.** A fixed pixel offset could coincidentally still leave
  the node partially visible on very large/zoomed-out diagrams. Deriving the offset from the current
  viewport's zoom level (e.g. a multiple of the viewport width/height) is more robust than a hardcoded
  constant.

## Verification plan

Same as the other three POCs: `npm run check-types`, `npx eslint` on touched files, then a manual
browser check on `/playground` — click the button, confirm the viewport visibly pans away from the
node first, then confirm the tour's second step pans back and highlights it correctly.

## Out of scope

- No changes to driver.js or react-joyride POCs — this is Shepherd.js-specific, per the chosen
  extension point.
- No attempt to generalize this into reusable app-level tour infrastructure — stays an isolated POC
  file like the other three.
