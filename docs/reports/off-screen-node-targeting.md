# Off-Screen Node Targeting: driver.js vs. react-joyride vs. Shepherd.js

Follow-up to [`onboarding-library-comparison.md`](./onboarding-library-comparison.md). Scope: can
each library, using only its own built-in features, highlight a node that's currently panned outside
the visible viewport by bringing it into view itself? UserTour is excluded (not being pursued
further).

## Why this is hard for any of them

React Flow pans its canvas via a CSS `transform` on `.react-flow__viewport`, not native
`scrollTop`/`scrollLeft` on a scrollable container. All three libraries' "scroll target into view"
features are built around `scrollIntoView()` / adjusting a scrollable ancestor's scroll offset — a
model React Flow doesn't use. This wasn't tested hands-on in any of the three node-targeting POCs
(the target node was already on-screen in each), so the findings below are read from each library's
own docs/types, not verified against an actually-off-screen node.

## Per-library findings

| Library | Built-in reveal mechanism | Verdict for a React Flow canvas |
|---|---|---|
| **driver.js** | Default scroll-to-step behavior | Assumes a scrollable ancestor — won't move a transform-based canvas. No override hook documented. |
| **react-joyride** | `scrollTo`/`scrollOffset`, plus a `MutationObserver` wait for late-mounted targets | Same scrollable-ancestor assumption. The `MutationObserver` only solves the target not existing *yet* in the DOM — it doesn't help when the target exists but is panned off-screen. |
| **Shepherd.js** | `scrollTo`/`scrollToHandler` | Same default assumption, **but** `scrollToHandler` is a documented override point for substituting custom reveal logic in place of the default scroll call — the only one of the three with a purpose-built extension point for this. |

## Conclusion

None of the three can bring an off-screen node into view out of the box — all were designed around
standard page scrolling, not a transform-driven canvas. Shepherd.js is the best-positioned of the
three, since `scrollToHandler` gives a named, documented place to plug in different reveal logic.
driver.js and react-joyride have no equivalent hook; the same result there would require intercepting
a step-lifecycle callback (e.g. `beforeStep`/`onNext`) instead of a mechanism designed for this.
