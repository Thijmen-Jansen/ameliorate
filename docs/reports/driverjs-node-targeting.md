# Driver.js POC: Reliable CSS Targeting for React Flow Nodes

Experiment report — `driverJS-POC` branch.

## Goal

Prove that [driver.js](https://driverjs.com/) can be used to highlight elements inside this
app's onboarding UI, with the hard/interesting case being **nodes inside the React Flow
diagram**. Diagram nodes are dynamic and user-created, so there's no ID known ahead of time, and
no existing selector was built for targeting them from outside the diagram code.

## Problem

The first attempt at this (before this report was written) tried highlighting a node via a
hardcoded CSS class (`.login`), which didn't correspond to anything in the DOM and never worked.
The real problem to solve: how do you get a **stable, reliable CSS selector** for an arbitrary
node in the diagram, given that nodes are rendered through several component layers?

```
FlowNode  →  StyledEditableNode (Emotion-wrapped)  →  EditableNode  →  rendered <div>
```

## Investigation

1. **Would a plain prop reach the DOM?**
   `StyledEditableNode` is `styled(EditableNode)` — an Emotion wrapper around a *component*, not a
   raw DOM tag. Emotion forwards all props it's given straight through to a wrapped component
   untouched (prop filtering only happens when wrapping a DOM element like `styled.div`). So the
   real question was whether `EditableNode` itself forwards unknown props to its rendered
   element.

2. **`EditableNode`'s `Props` interface didn't spread rest props.**
   `src/web/topic/components/Node/EditableNode.tsx` (originally lines 71–77) destructured only
   `{ node, className, onClick }` — there was no `...rest` spread onto the underlying element.
   Passing an arbitrary `data-tour` prop into `StyledEditableNode` would have been silently
   dropped before reaching any DOM node. This is why an earlier, commented-out attempt
   (`data-tour={"first-node"}` on `FlowNode`) could never have worked, independent of the
   `.login` typo — the attribute had no path to the DOM at all.

3. **Alternative considered: React Flow's own attribute.**
   React Flow already stamps `.react-flow__node[data-id="<node-id>"]` on its node wrapper for
   every node, for free — this would have worked with zero code changes. It was noted as a
   fallback, but an explicit, tour-owned attribute was chosen instead so the selector isn't
   coupled to a third-party library's internal DOM structure (React Flow could change that
   wrapper markup in a future version without warning), and so it reads clearly in the code as
   "this exists for tours."

## Solution

Thread a `dataTour` prop down to the actual rendered node element, rather than relying on an
existing class or a third-party attribute:

- **`EditableNode.tsx`**: added `dataTour?: string` to `Props`, destructured it in
  `EditableNodeBase`, and applied it as `data-tour={dataTour}` directly on `NodeMotionDiv` — the
  actual `motion.div` rendered to the DOM for the node (not a wrapper or portal element).
- **`FlowNode.tsx`**: passed `dataTour={`node-${node.id}`}` into `StyledEditableNode`. `node.id`
  already comes from the diagram store and is guaranteed unique per node, so every node in the
  diagram ends up with its own stable, unique attribute (e.g. `data-tour="node-abc123"`) with no
  extra ID-generation logic required.

## Why this is reliable

The POC doesn't know which specific node will exist in any given topic/playground ahead of time,
so it queries generically using a prefix match rather than a hardcoded ID:

```ts
document.querySelector('[data-tour^="node-"]')
```

This grabs whichever node happens to be rendered. The `node-<id>` naming convention is what makes
a prefix match meaningful and safe (it won't accidentally match unrelated `data-tour` values used
elsewhere, e.g. `poc-static-text`).

This approach is also immune to a separate failure mode discovered while testing a different
target: the app header's title text (`"Ameliorate"`) is hidden below the `xl` Tailwind breakpoint
(`titleClassName="hidden xl:flex"` in `Logo.tsx`), so it has zero dimensions at smaller viewport
widths and driver.js can't meaningfully highlight it. Because the node's `data-tour` attribute is
applied directly by React to an always-rendered element with real dimensions, it doesn't have
this problem.

## Code changes

| File | Change |
|---|---|
| `src/web/topic/components/Node/EditableNode.tsx` | Added `dataTour?: string` prop; rendered as `data-tour={dataTour}` on `NodeMotionDiv`. |
| `src/web/topic/components/Node/FlowNode.tsx` | Passed `dataTour={`node-${node.id}`}` into `StyledEditableNode`; removed a stray leftover `test` CSS class. |
| `src/web/topic/components/TopicWorkspace/DriverTourPOC.tsx` | New, isolated POC file: finds a node via `[data-tour^="node-"]`, builds a 2-step driver.js tour (static demo text → diagram node), exports a floating trigger button. |
| `src/web/topic/components/TopicWorkspace/TopicWorkspace.tsx` | Mounted `<DriverTourPOCButton />` alongside (not replacing) the existing `@reactour/tour`-based tutorial components. |
| `src/web/topic/components/TopicWorkspace/TourSetter.tsx` | Reverted to its original `@reactour/tour` behavior (a driver.js experiment had been pasted directly into this file, disabling the real tutorial system). |

## Verification

- `npm run check-types` — no errors.
- `npx eslint` on all touched files — no errors.
- Manual browser check on the Playground (`/playground`): clicking the "Driver.js Tour (POC)"
  button highlights the demo static text first, then advances to highlight an actual node in the
  diagram, confirming the `data-tour="node-<id>"` selector reliably resolves to a real, visible
  DOM element.

## Implementation Effort & Difficulty

### Criteria

Use these to score every library tried in this experiment, so the results stay comparable.
Each is rated **1 (trivial) – 5 (very difficult)**.

| # | Criterion | What it measures |
|---|---|---|
| 1 | **Setup effort** | Installing the package, importing its CSS/JS, and getting *one* highlight working from a cold start. |
| 2 | **Dynamic element targeting** | Marginal work to reliably target an element that doesn't exist at build time (like a diagram node), *given the `data-tour` plumbing already exists* (see note below). |
| 3 | **Framework integration friction** | How naturally the library's API fits React's render cycle — imperative call vs. component/hook, ref handling, cleanup on unmount, re-render safety. |
| 4 | **Styling/theming effort** | Work needed to make the tour's popover/overlay visually match the app (colors, fonts, spacing) rather than looking like a stock default. |
| 5 | **TypeScript support** | Completeness/accuracy of shipped or `@types` definitions — did types need casting, `any`, or manual augmentation? |
| 6 | **API surface / learning curve** | How much documentation reading was needed before the first working step, and how large/consistent the config API is. |
| 7 | **Bundle size / dependencies** | Footprint added to the app (package size, transitive dependencies). |

**Note on criterion 2:** the `data-tour="node-<id>"` attribute added to `EditableNode`/`FlowNode`
in this experiment is app-level plumbing, not driver.js-specific — once it exists, *any* tour
library can query `[data-tour^="node-"]` for free. Don't re-charge that cost to every library;
only score the marginal work each library needs on top of having a selector available (e.g. does
it need a `ref`/DOM element vs. a CSS string, does it need the element to exist before init runs,
etc.).

### Score: driver.js

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Setup effort | **1** | `npm install driver.js`, one CSS import, `driver({ steps }).drive()` — no provider/context, no wrapping component tree required. |
| 2 | Dynamic element targeting | **2** | Accepts a plain CSS selector string per step and resolves it lazily when that step is shown (`element: string \| Element \| (() => Element)`), so it tolerates nodes that don't exist yet at call time as long as they exist by the time that step is reached. No ref plumbing needed. |
| 3 | Framework integration friction | **2** | Fully imperative (`driver(config).drive()`), not a React component — trivial to trigger from a plain `onClick`, but that also means no built-in React lifecycle integration (no auto-cleanup on unmount, no reactive re-targeting if the app's state changes mid-tour). Fine for this POC's single manual trigger; would need extra wiring for the app's existing auto-start/route-change tutorial logic. |
| 4 | Styling/theming effort | **1** | Default popover styling is clean out of the box; not themed for this POC, but `popoverClass` is available for later. |
| 5 | TypeScript support | **1** | Ships its own `.d.ts` (`driver.js/dist/driver.js.d.ts`), fully typed `Config`/`DriveStep`/`Popover`; no casts or `any` needed anywhere in the POC code. |
| 6 | API surface / learning curve | **1** | Single factory function + a small, flat `steps` array; had a working highlight within minutes once a valid selector existed. |
| 7 | Bundle size / dependencies | **1** | Zero runtime dependencies, ~5KB gzipped. |

**Total: 9 / 35** — **Overall difficulty: Low**

**Time spent:** roughly 30–45 minutes hands-on (excluding the app-level `data-tour` plumbing,
which is a one-time, reusable cost per the note above) — most of it was investigating *why* the
node wasn't targetable (prop-drilling through `EditableNode`), not driver.js itself.
