# Off-Screen Node Tour POCs: Comparing All Three Libraries

Follow-up to [`off-screen-node-targeting.md`](./off-screen-node-targeting.md) (library research,
corrected in place — see its top note) and
[`off-screen-node-tour-poc-implementation.md`](./off-screen-node-tour-poc-implementation.md) (the
original Shepherd-only implementation report). That research originally concluded only Shepherd.js
could bring an off-screen React Flow node into view via a documented extension point. Re-checking
against the versions actually installed in this repo turned up a native equivalent in react-joyride
too, so all three tour libraries now have a working off-screen demo:

| File                           | Export                           | Mechanism used                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OffscreenShepherdTourPOC.tsx` | `OffscreenShepherdTourPOCButton` | `beforeShowPromise` — a step option Shepherd natively awaits before showing/positioning the step.                                                                                                                |
| `OffscreenJoyrideTourPOC.tsx`  | `OffscreenJoyrideTourPOCButton`  | `before` — a step option react-joyride (3.2.0) natively awaits before showing the step; direct equivalent of `beforeShowPromise`.                                                                                |
| `OffscreenDriverTourPOC.tsx`   | `OffscreenDriverTourPOCButton`   | `popover.onNextClick` interception — driver.js has no async pre-show hook, so the intro step's "Next" click handler is overridden entirely: pan back, then call `driver.moveNext()` manually once that finishes. |

All three share the same pan-away math (`setViewport` to a position 2 viewport-widths/heights outside
the visible area, derived from live `useStore((s) => s.width/height)` so it's robust regardless of
zoom/layout) and the same `data-tour="node-<id>"` node lookup, duplicated per file rather than shared —
consistent with how the original four POC files are each documented as "kept fully separate" by
design.

## Pain points

**Shared across all three:**

1. **Provider placement broke the sibling-POC pattern, now three times over.** All three buttons had
   to move into `Diagram.tsx`'s JSX (inside `<ReactFlowProvider>`) instead of `TopicWorkspace.tsx`
   like the four original POC buttons, since all three need `useReactFlow()`. What was a one-off
   inconsistency for the Shepherd version is now the norm for every off-screen demo — any future
   tour-library POC needing viewport control will hit the same constraint.
2. **The prior research needed re-verification, not just reuse.** The original comparison report's
   react-joyride conclusion was wrong for the installed version — trusting it at face value would have
   skipped a cleaner implementation path entirely. Had to re-derive the finding from the actual shipped
   `.d.ts` files rather than the earlier write-up.

**driver.js-specific:**

1. **No documented hook — had to read minified bundled source to find the workaround.** Every hook in
   driver.js's public `Config`/`Popover`/`DriveStep` types is synchronous
   (`(element, step, opts) => void`); nothing in the types or docs suggests `onNextClick` fully
   replaces the default advance. That had to be confirmed by reading
   `node_modules/driver.js/dist/driver.js.iife.js` directly
   (`if(n.closest('.driver-popover-next-btn'))return t.onNextClick?.();` — no fallback call). This is
   the least discoverable of the three mechanisms by a wide margin.
2. **Slower to reveal in practice.** Across both verification runs, driver.js's popover consistently
   took ~690ms to appear after the "Next" click, versus ~510–530ms (Shepherd) and ~470–530ms
   (react-joyride) for the same 400ms `fitView` duration. Root cause wasn't isolated — plausibly extra
   synchronous work driver.js does rebuilding its stage/overlay elements on `moveNext()` — but it's a
   real, consistently-reproduced gap worth flagging rather than an artifact of a single run.
3. **The "no config flag needed" behavior is implicit, not guaranteed.** Relying on driver.js's own
   `scrollIntoView` call becoming a no-op (because the node is already on-screen by the time it runs)
   works today, but it's an inferred behavior from reading current source, not a documented contract —
   a future driver.js version could change that internal visibility check without it counting as a
   breaking change to its public API.

**react-joyride-specific:**

1. **A beacon step sits in front of the first tooltip, undocumented in the types file.** By default
   (`beaconTrigger: 'click'`), react-joyride shows a pulsing "beacon" the user must click before the
   first step's tooltip opens — confirmed only by reading the bundled source
   (`data-testid="button-beacon"`, and that hovering is explicitly ignored:
   `if (event.type === "mouseenter" && step.beaconTrigger !== "hover") return;`). This cost real
   debugging time during verification (see below).
2. **`useJoyride`'s steps are a render-time hook input, not something built imperatively at click
   time.** Unlike Shepherd/driver.js (fully imperative — the tour object is constructed inside the
   button's `onClick`), react-joyride's `steps` prop is declared once at render. Since which node to
   target is only known once the button is clicked, the node had to be threaded through a
   `useRef<ReactFlowNode | null>`, read lazily by both the node step's `target` function and its
   `before` hook. Real, if manageable, architectural friction specific to this library's API shape.
3. **Wrong initial assumption during verification: a second beacon does _not_ gate the node step.**
   Expected (by analogy with the first step) that advancing to the node step would show another beacon
   requiring a click before its `before` hook even ran. Actual behavior: once a continuous tour is
   progressing via its own "Next" button, subsequent steps' tooltips open directly — no beacon gate in
   between. Cost a debugging round-trip (chasing a `.click()` timeout on an element that had already
   been replaced by the tooltip) before landing on the correct model.

## Pros

**Shared across all three:**

1. **The original "only Shepherd can do this" conclusion was wrong, and now provably so.** All three
   libraries have a working, verified implementation — corrected in
   [`off-screen-node-targeting.md`](./off-screen-node-targeting.md).
2. **All three verified end-to-end with real measurements, not code review.** Headless-Chromium runs
   (throwaway Playwright script, deleted after use) confirmed for each library: the node's screen
   position goes genuinely off-viewport after pan-away, the popover/tooltip doesn't appear until the
   pan-back visibly completes, and the node is on-screen at the exact instant it appears — see the
   table below.
3. **`data-tour="node-<id>"` plumbing holds up a sixth time.** Zero changes to
   `EditableNode.tsx`/`FlowNode.tsx` across all six POCs (3 on-screen + 3 off-screen) that now depend
   on it.
4. **Clean bar across the board.** `tsc --noEmit`, `eslint`, and `prettier` all pass on every new/touched
   file with no casts, `any`, or new suppression patterns beyond the one `functional/immutable-data`
   disable already used elsewhere in the codebase for direct ref mutation.

**driver.js-specific:**

1. **Once understood, the implementation itself is small.** No config flag equivalent to `scrollTo:
false`/`skipScroll: true` was needed at all — gating `moveNext()` alone is sufficient, confirmed by
   the node being on-screen at popover-appearance time in every run.

**react-joyride-specific:**

1. **The cleanest hook match of the three, once the beacon/ref wrinkles were worked out.** `before` is
   purpose-built for exactly this, and pairing it with an explicit `skipScroll: true` (rather than
   relying on an implicit no-op like driver.js) makes the intent explicit in the step config itself.
2. **The ref-based lazy-target pattern is reusable.** Any future react-joyride step needing
   click-time-only data (not known at render time) can follow the same
   `useRef` + function-form `target` + `before`-reads-the-ref shape established here.

## Verification: measured results

Same throwaway-Playwright-script approach used for the original Shepherd POC (headless Chromium
against the local dev server, 1400×900 viewport, script and downloaded browser binaries deleted after
use). Run twice in full for all three libraries; numbers were consistent run to run.

| Check                                                      | Shepherd.js                     | driver.js  | react-joyride |
| ---------------------------------------------------------- | ------------------------------- | ---------- | ------------- |
| Node position before click                                 | on-screen (`x:800, y:450`)      | same       | same          |
| Node position after pan-away                               | off-screen (`x:-1672, y:-1424`) | same       | same          |
| Time from "Next" click to popover/tooltip appearing        | ~510–530ms                      | ~690–696ms | ~470–530ms    |
| Node on-screen at the instant the popover/tooltip appears  | **yes**                         | **yes**    | **yes**       |
| Gap between node bottom and popover/tooltip top            | 0px                             | 35px       | ~36px         |
| New console errors vs. pre-existing `/playground` baseline | none                            | none       | none          |

All three correctly gate on the pan-back completing before positioning against the target — the core
question this whole POC series set out to answer, now answered three times over with three different
underlying mechanisms.

## Difficulty level

Same 1 (trivial) – 5 (very difficult) scale as the Shepherd implementation report (see
[`off-screen-node-tour-poc-implementation.md`](./off-screen-node-tour-poc-implementation.md#difficulty-level)),
scoped to what each library specifically added on top of the shared pan-away/pan-back plumbing.

| #   | Criterion                      | Shepherd.js                                   | driver.js                                                                                                                                                               | react-joyride                                                                                                                               |
| --- | ------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Extension-point research       | **1** — already resolved by prior report/plan | **3** — no documented hook; required reading minified bundled source to find the `onNextClick` workaround                                                               | **2** — required correcting an outdated prior conclusion against the actually-installed version's types                                     |
| 2   | Pan-away offset design         | **2** — shared code, reused verbatim          | **2**                                                                                                                                                                   | **2**                                                                                                                                       |
| 3   | Async coordination             | **1** — direct promise pass-through           | **3** — manual click interception + async IIFE + imperative `moveNext()` call, relying on an inferred (undocumented) internal behavior for the reveal to become a no-op | **2** — direct promise pass-through like Shepherd, but needs the ref-based lazy-target pattern plus correctly modeling the beacon lifecycle |
| 4   | Provider/placement constraint  | **3** — shared structural cost                | **3**                                                                                                                                                                   | **3**                                                                                                                                       |
| 5   | Manual verification confidence | **2** — 3 consistent headless runs            | **2** — 2 consistent headless runs, consistent ~690ms timing both times                                                                                                 | **2** — verified, but only after a debugging round-trip on a wrong assumption about a second beacon                                         |

**Totals: Shepherd.js 9/25 (Low–Medium) · react-joyride 11/25 (Low–Medium) · driver.js 13/25 (Medium)**

## Which mechanism fit best

Ranked by how directly each library's own API expresses "wait for this async thing, then show the
step":

1. **Shepherd.js's `beforeShowPromise`** — purpose-built, documented, zero workaround.
2. **react-joyride's `before`** — equally purpose-built and equally direct once its render-time
   `steps` shape and beacon step are accounted for; the extra friction here is architectural (hook API
   shape), not conceptual.
3. **driver.js's `onNextClick` interception** — fully viable and the resulting code is small, but it's
   a workaround built on an undocumented behavior (no fallback advance when the hook is set, and an
   inferred no-op for its own reveal call) rather than a mechanism designed for this. Most likely of
   the three to break silently on a driver.js upgrade.
