# Off-Screen Node Tour POC: Implementation Report

Follow-up to [`off-screen-node-targeting.md`](./off-screen-node-targeting.md) (library comparison)
and [`off-screen-node-tour-poc-plan.md`](../plans/off-screen-node-tour-poc-plan.md) (implementation
plan). Records what it was actually like to build the plan: `OffscreenShepherdTourPOCButton` (in
`OffscreenShepherdTourPOC.tsx`, renamed from `OffscreenNodeTourPOC.tsx` once driver.js and
react-joyride equivalents were added — see
[`off-screen-node-tour-poc-comparison.md`](./off-screen-node-tour-poc-comparison.md)), a demo that
pans the React Flow viewport away from a node, then runs a Shepherd.js tour whose final step pans
back to it via `beforeShowPromise` before showing the popover.

## Pain points

1. **Provider placement broke the sibling-POC pattern.** `DriverTourPOCButton`, `JoyrideTourPOCButton`,
   and `ShepherdTourPOCButton` all mount from `TopicWorkspace.tsx`, outside `<Diagram />`. This POC
   can't — `useReactFlow()` only works inside `<ReactFlowProvider>`, so the button had to move into
   `Diagram.tsx`'s own JSX instead. That's a real inconsistency for anyone comparing the four POCs
   side by side (three buttons live in one file, this one lives in another), and it's not a one-off
   quirk of this file — it's inherent to any tour step that needs imperative viewport control, so a
   production version of this would carry the same constraint.
2. **"Far enough off-screen" isn't a constant.** A fixed pixel offset would coincidentally leave the
   node partially visible on a zoomed-out diagram with many nodes. Getting a pan-away offset that's
   robust regardless of zoom/layout required reasoning through the viewport's screen-space transform
   (`screenPos = node.position * zoom + viewport.xy`) and pulling live `width`/`height` off React
   Flow's internal store (`useStore((s) => s.width)`), rather than just picking a big number.
3. **`scrollTo` needed an explicit opt-out.** Shepherd's `defaultStepOptions.scrollTo` defaults to
   `true` in the sibling `ShepherdTourPOC.tsx`. Left on here, it would fire Shepherd's own
   scroll-based reveal (a no-op against a transform-based canvas, per the linked report) at the same
   time as the custom `beforeShowPromise` pan — redundant at best, a race at worst. Had to be
   explicitly set to `false`, which is easy to miss since it's silent when left on (it just does
   nothing, rather than erroring).
4. **Confirming the riskiest assumption took more than one pass.** The plan flagged an open question:
   does Shepherd's popover re-measure correctly the instant `beforeShowPromise` resolves? No interactive
   browser tool was available in this session, so this was checked with a throwaway Playwright script
   driving a real headless Chromium against the dev server instead (see Verification below) — deleted
   after use, not part of the repo. The first attempt gave a false-positive "popover already visible
   after 3ms" reading, because `.shepherd-element` matches _any_ step's popover, and it briefly caught
   step 1's element mid-teardown during the transition to step 2. Had to narrow the check to step 2's
   own title text before the timing numbers were trustworthy.
5. **No re-targeting if the diagram changes mid-tour.** Same inherited Shepherd limitation as the
   plain `ShepherdTourPOC.tsx` — if the target node is deleted or the diagram re-filters between pan-away
   and pan-back, the second step has nothing reliable to attach to. Not new to this POC, but the
   off-screen mechanism adds one more window (the pan-away duration) during which that could happen.

## Pros

1. **`beforeShowPromise` was genuinely the right hook — no workaround needed.** It's a plain
   `() => Promise<unknown>` that Shepherd awaits before showing/positioning the step, which is exactly
   the "wait for an async reveal, then position" shape this needed. No monkey-patching Shepherd
   internals, no polling for a CSS transform to settle.
2. **`setViewport`/`fitView` already return real promises.** Checked directly against the installed
   `@xyflow/react`/`@xyflow/system` types (`node_modules/@xyflow/system/dist/esm/types/general.d.ts`):
   both are typed `Promise<boolean>`, resolving on animation end. That resolved the plan's biggest open
   risk in favor of the simpler path — `beforeShowPromise: () => fitView({ nodes: [node], duration: 400 })`
   directly, with no `setTimeout` fallback needed.
3. **Reused existing viewport math instead of inventing new math.** The pan-away offset logic
   (`screenPos = node.position * zoom + viewport.xy`) is the same relationship
   `getViewportToIncludeNode` in `flowHooks.ts` already relies on for the app's real
   "move viewport to include node" feature — this POC didn't need to discover anything new about how
   React Flow's transform works, just apply it in the opposite direction (push the node out, not pull
   it in).
4. **Zero changes to `EditableNode.tsx`/`FlowNode.tsx`.** The `data-tour="node-<id>"` attribute from
   the original driver.js POC was reused as-is, consistent with all three prior tour-library POCs —
   this is the third POC in a row that's validated that plumbing is genuinely library-agnostic.
5. **Type-checking and linting were clean on the first pass.** `tsc --noEmit` and `eslint` both passed
   with no casts, `any`, or suppression comments — the shipped Shepherd.js and `@xyflow/react` types
   were complete enough that nothing needed working around, unlike the `unbound-method` friction noted
   in the plain Shepherd POC report.
6. **The demo is self-contained and repeatable.** Because the pan-away offset is derived from the
   _current_ viewport each time (not a state flag), clicking the button reproduces the off-screen
   condition from whatever pan/zoom state the diagram happens to be in — no dependency on "did I
   already scroll away" bookkeeping.

## Difficulty level

Same 1 (trivial) – 5 (very difficult) scale used in the sibling reports (see
[`shepherdjs-node-targeting.md`](./shepherdjs-node-targeting.md#criteria)), but scoped to what this
POC specifically added on top of an already-chosen library — bringing an off-screen node into view via
`beforeShowPromise`, not re-evaluating Shepherd.js setup from scratch.

| #   | Criterion                                            | Score | Notes                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Extension-point research                             | **1** | Already resolved by the prior report/plan — `beforeShowPromise` was identified and reasoned about before any code was written, so no discovery cost here.                                                                                                                       |
| 2   | Pan-away offset design                               | **2** | Not hard once the existing `getViewportToIncludeNode` math was found, but required understanding React Flow's screen-space transform rather than guessing a constant.                                                                                                           |
| 3   | Async coordination (`beforeShowPromise` + `fitView`) | **1** | Turned out to "just work" — both are typed `Promise`-returning, so the implementation is a direct pass-through with no timing glue code.                                                                                                                                        |
| 4   | Provider/placement constraint                        | **3** | The one real structural cost: couldn't reuse the other three POCs' mounting pattern, had to place the component inside `Diagram.tsx` and reason about why (see Pain points #1).                                                                                                 |
| 5   | Manual verification confidence                       | **2** | Confirmed via a real headless-Chromium run (see Verification) rather than a live click-through, so it's not quite the same as the repo-owner-verified sibling POCs — but the behavior is now backed by DOM/screen measurements across 3 consecutive runs, not just a code read. |

**Total: 9 / 25 — Overall difficulty: Low–Medium**, leaning on the lower end for the pure code (the
async/promise plumbing was easier than the plan anticipated) and pulled up slightly by the placement
constraint.

## Verification: off-screen reveal confirmed

Ran with a throwaway Playwright script (`chromium.launch()` against the local dev server, 1400×900
viewport) driving the actual button click end-to-end, deleted after use. 3 consecutive runs, all
consistent:

| Check                                                     | Result                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node screen position before clicking the button           | `x: 800, y: 450` (on-screen, 1400×900 viewport)                                                                                                                                                                                                                      |
| Node screen position after pan-away (300ms)               | `x: -1672, y: -1424` — **fully off-screen**, confirmed both via the node's `getBoundingClientRect()` and via `.react-flow__viewport`'s CSS `transform`                                                                                                               |
| Time from clicking "Next" to step 2's popover appearing   | **~430–450ms**, consistent across all 3 runs — matches `fitView`'s `duration: 400` plus a small overhead, not near-instant                                                                                                                                           |
| Node screen position _at the instant_ the popover appears | `x: 712, y: 421` (fully on-screen) — confirms `beforeShowPromise` genuinely gated the popover until the pan-back had **finished**, not just started                                                                                                                  |
| Popover position relative to the node once shown          | `attachTo: "bottom"` honored exactly: **0px vertical gap** between the node's bottom edge and the popover's top edge, horizontally overlapping the node — no mispositioning, no flicker, no forced re-measure call needed                                            |
| Console errors/warnings during the full run               | 2 warnings appeared, but a baseline run of `/playground` with **zero** interaction reproduced the same 2 warnings — pre-existing page noise (an unrelated `TutorialController` `setState`-during-render warning and two unrelated `500`s), not caused by this change |

This closes out the plan's two biggest open risks in the implementation's favor:

- **`beforeShowPromise` does gate correctly** — Shepherd does not show/position the step until the
  returned promise resolves, and no `tour.getCurrentStep()?.updateStepOptions({})`-style forced
  re-measure was needed; floating-ui positioned it correctly on first render.
- **The pan-away offset is robust** — derived from live viewport width/height rather than a constant,
  it reliably pushed the node ~2 viewport-widths outside the visible area regardless of the node's own
  position, and the pan-back (`fitView`) reliably restored it to a fully on-screen, non-clipped position.

One residual gap versus the sibling POC reports: this was verified via an automated headless-browser
run rather than a live click-through by the repo owner in an actual browser window — worth a quick
manual sanity check if this pattern gets carried into production tour infrastructure, but the
mechanism itself is now measured, not just theorized.
