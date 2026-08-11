# Off-Screen Node Targeting: driver.js vs. react-joyride vs. Shepherd.js

Follow-up to [`onboarding-library-comparison.md`](./onboarding-library-comparison.md). Scope: can
each library, using only its own built-in features, highlight a node that's currently panned outside
the visible viewport by bringing it into view itself? UserTour is excluded (not being pursued
further).

> **Correction (post-implementation):** the react-joyride findings below were written against
> `docs`/types read at the time, and turned out to be outdated for the version actually installed in
> this repo (3.2.0, per `package.json`) — that version has a native async pre-show hook after all. The
> table and conclusion have been corrected in place; see the implementation POCs
> (`OffscreenDriverTourPOC.tsx`/`OffscreenJoyrideTourPOC.tsx`/`OffscreenShepherdTourPOC.tsx`) and
> [`off-screen-node-tour-poc-comparison.md`](./off-screen-node-tour-poc-comparison.md) for what was
> actually verified working for all three libraries.

## Why this is hard for any of them

React Flow pans its canvas via a CSS `transform` on `.react-flow__viewport`, not native
`scrollTop`/`scrollLeft` on a scrollable container. All three libraries' "scroll target into view"
features are built around `scrollIntoView()` / adjusting a scrollable ancestor's scroll offset — a
model React Flow doesn't use. This wasn't tested hands-on in any of the three node-targeting POCs
(the target node was already on-screen in each), so the findings below are read from each library's
own docs/types, not verified against an actually-off-screen node.

## Per-library findings

| Library           | Built-in reveal mechanism                                                                   | Verdict for a React Flow canvas                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **driver.js**     | Default scroll-to-step behavior (`element.scrollIntoView(...)`)                             | Assumes a scrollable ancestor — won't move a transform-based canvas. No async pre-show hook exists, but `popover.onNextClick` fully replaces the default "advance to next step" action (confirmed by reading the bundled source), so a custom reveal can be gated by calling `driver.moveNext()` manually only once it finishes — a workaround, not a purpose-built hook.                                   |
| **react-joyride** | `skipScroll`-gated scroll-to-step, plus a `targetWaitTimeout` wait for late-mounted targets | Same scrollable-ancestor assumption for its own reveal (disable via `skipScroll: true`), **but** the installed version (3.2.0) ships a step-level `before?: (data) => Promise<void>` hook that the tour explicitly awaits before showing the step — a direct, first-class equivalent of Shepherd's `beforeShowPromise`. (Not present in the version originally checked when this report was first written.) |
| **Shepherd.js**   | `scrollTo`/`scrollToHandler`                                                                | Same default assumption, **but** `beforeShowPromise` is a documented step option built for exactly this: a function returning a `Promise` that Shepherd awaits before showing/positioning the step.                                                                                                                                                                                                         |

## Conclusion

None of the three can bring an off-screen node into view out of the box — all were designed around
standard page scrolling, not a transform-driven canvas. But two of the three ship a native async
pre-show hook that sidesteps the problem entirely: Shepherd's `beforeShowPromise` and react-joyride's
`before` (in the installed 3.2.0). driver.js has no equivalent hook — achieving the same result there
requires intercepting a step-lifecycle callback (`popover.onNextClick`) and manually deferring the
advance, rather than using a mechanism designed for this. All three approaches were implemented and
verified working; see
[`off-screen-node-tour-poc-comparison.md`](./off-screen-node-tour-poc-comparison.md).
