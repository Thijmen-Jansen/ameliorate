# UserTour POC: Reliable CSS Targeting for React Flow Nodes

Experiment report — `driverJS-POC` branch.

> **This report is different from the other three in this series.** driver.js, react-joyride, and
> Shepherd.js are all pure client-side libraries: `npm install`, write a `steps` array in code, done.
> UserTour turned out to be a **hosted onboarding platform** (with an open-source, self-hostable
> backend) — flows are normally authored in an external dashboard against a project/environment ID,
> not defined as a code array. There's no free-tier account or local backend set up for this repo, so
> this POC could not be run or verified end-to-end. Everything below is a documentation-based
> analysis (see links throughout), and **no code was installed or added to the app** — no
> `package.json` change, no new component, nothing mounted in `TopicWorkspace.tsx`. Treat the scoring
> at the bottom accordingly: it reflects researched/expected effort, not hands-on-verified effort like
> the other three reports.

## Goal

Determine whether [UserTour](https://usertour.io) could be used the same way as the other three POCs
in this series to highlight elements inside this app's onboarding UI, with the same hard/interesting
case: **nodes inside the React Flow diagram**. See
[`docs/reports/driverjs-node-targeting.md`](./driverjs-node-targeting.md),
[`docs/reports/react-joyride-node-targeting.md`](./react-joyride-node-targeting.md), and
[`docs/reports/shepherdjs-node-targeting.md`](./shepherdjs-node-targeting.md) for the first three.

## Problem

Diagram nodes are dynamic and user-created, so there's no ID known ahead of time. The earlier POCs
solved this once, at the app level: `EditableNode`/`FlowNode` stamp a stable
`data-tour="node-<id>"` attribute directly onto the rendered node element, queryable via a prefix
match (`[data-tour^="node-"]`). The question for this POC was whether that same plumbing/selector
could be handed to UserTour the same way it was handed to the other three libraries.

## Investigation

1. **The npm package isn't the tour engine.** `npm view usertour.js` describes it as `"Async loader
   for Usertour.js"`. Its
   [installation docs](https://docs.usertour.io/developers/usertourjs-reference/installation.md) and
   [overview docs](https://docs.usertour.io/developers/usertourjs-reference/overview.md) confirm this:
   `usertour.js` is a thin wrapper (`deps: none`, tiny footprint) that queues calls until it
   asynchronously loads the real SDK from UserTour's CDN — "a small footprint (less than 16 KB
   gzipped)" that "loads UI components only when needed." The actual step/flow definitions are not
   part of this package at all.

2. **Where do steps/targets actually get defined?** Per the
   [element-selection guide](https://docs.usertour.io/how-to-guides/selecting-elements.md), targeting
   is done in UserTour's dashboard, primarily via **OpenPicker**, a browser extension that lets someone
   click an element on the live page to generate a CSS selector, with a secondary option to hand-type a
   selector into the same field. Notably, the docs explicitly recommend the same pattern this repo
   already uses: *"use dedicated `data-*` attributes... as stable hooks rather than relying on
   auto-generated structural selectors"* — meaning the existing `data-tour="node-<id>"` attribute is
   exactly the kind of hook UserTour's own docs recommend. However, the docs don't describe any
   mechanism for elements that don't exist yet at flow-authoring time (no documented equivalent to
   react-joyride's `MutationObserver`-based wait), and give no indication that a *prefix* match
   (`[data-tour^="node-"]`) is treated any differently from an exact match — it would need to be
   hand-typed into the picker's selector field to test, which isn't possible without a live dashboard.

3. **How is a tour actually triggered from code?** The
   [`start()` reference](https://docs.usertour.io/developers/usertourjs-reference/content/start.md)
   takes a `contentId` — an opaque ID copied from the dashboard URL
   (`/env/{envId}/{contentType}/{contentId}/detail`) — plus flags like `once`/`continue`. It does
   **not** accept a CSS selector or step definitions at call time; it just replays whatever was
   already configured for that `contentId` in the dashboard. This is a fundamentally different shape
   than `driver({ steps }).drive()`, `useJoyride({ steps })`, or `new Shepherd.Tour().addStep({...})`
   — those three all define *what* to highlight in application code; UserTour only lets code decide
   *when* to replay something someone already built visually.

4. **Self-hosting exists but is real infrastructure.** UserTour's backend is open source and can be
   self-hosted via Docker Compose (per the
   [self-hosting guide](https://docs.usertour.io/open-source/self-hosting.md)), but that means running
   an app server, PostgreSQL, and Redis — three containers, an `.env` file, and an admin setup flow —
   just to get a dashboard where flows can be authored, before any `data-tour` selector could even be
   typed in. That's meaningfully more than `npm install` before writing the first line of integration
   code.

## What integration would look like (illustrative — not applied to this repo)

Based purely on the docs, the equivalent of the other POCs' trigger buttons would look roughly like
this. This snippet was **not** added to the codebase, has **not** been type-checked, linted, or run —
it exists here only to show the shape of the integration:

```tsx
// Illustrative only — not part of this repo. Requires a real ENV_ID from a UserTour
// account/self-hosted instance, and a flow already built in the dashboard targeting
// `[data-tour^="node-"]` (typed in by hand, since prefix matches aren't picker-generated).

import usertour from "usertour.js";

useEffect(() => {
  usertour.init("ENV_ID_PLACEHOLDER", { userInfo: { id: sessionUser?.username } });
}, [sessionUser?.username]);

const startUsertourPOCTour = () => {
  usertour.start("CONTENT_ID_PLACEHOLDER"); // ID copied from the UserTour dashboard URL
};
```

Unlike the other three POCs, there is no `steps` array, no selector string, and no popover copy in
this code at all — both live entirely in the external dashboard, referenced only by the opaque
`CONTENT_ID_PLACEHOLDER`.

## Why the existing plumbing would probably still be reliable

The `data-tour="node-<id>"` attribute added for the driver.js POC is still the right shape of hook —
UserTour's own docs recommend exactly this pattern over auto-generated structural selectors. The open
question this POC could not resolve without a live account is narrower than for the other three
libraries: not "does the attribute work," but "does UserTour's dashboard-side selector engine support
a `^=` prefix match the same way `document.querySelector` does," and "what happens if the matched
node isn't mounted yet when the flow's step is reached." Neither is answered in the public docs.

## Code changes

None. No package was installed, and no files in this repo were modified for this experiment — see
the callout at the top of this report for why.

## Verification

**Not performed.** There is no UserTour account or self-hosted instance configured for this repo, so
no tour was ever actually triggered or highlighted against a live diagram node. All conclusions above
come from UserTour's public documentation (linked inline), not from running code.

## Implementation Effort & Difficulty

### Criteria

Same criteria and scoring scale used for the driver.js, react-joyride, and Shepherd.js POCs, so
results stay nominally comparable — though see the caveat below. Each is rated **1 (trivial) – 5
(very difficult)**.

| # | Criterion | What it measures |
|---|---|---|
| 1 | **Setup effort** | Installing the package, importing its CSS/JS, and getting *one* highlight working from a cold start. |
| 2 | **Dynamic element targeting** | Marginal work to reliably target an element that doesn't exist at build time (like a diagram node), *given the `data-tour` plumbing already exists*. |
| 3 | **Framework integration friction** | How naturally the library's API fits React's render cycle — imperative call vs. component/hook, ref handling, cleanup on unmount, re-render safety. |
| 4 | **Styling/theming effort** | Work needed to make the tour's popover/overlay visually match the app (colors, fonts, spacing) rather than looking like a stock default. |
| 5 | **TypeScript support** | Completeness/accuracy of shipped or `@types` definitions — did types need casting, `any`, or manual augmentation? |
| 6 | **API surface / learning curve** | How much documentation reading was needed before the first working step, and how large/consistent the config API is. |
| 7 | **Bundle size / dependencies** | Footprint added to the app (package size, transitive dependencies). |

**Caveat on comparability:** for the other three POCs, every score came from actually writing,
type-checking, linting, and manually verifying working code. For UserTour, every score below is
inferred from documentation only — there was no code to hit friction against. Scores here are
directionally reasonable but carry meaningfully less confidence than the other three reports, and
should be re-checked against a real account/instance before being relied on for a library decision.

### Score: UserTour (documentation-based estimate)

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Setup effort | **4** | Not comparable to an `npm install`. Requires either a hosted account (project/environment setup) or self-hosting three Docker containers (app, Postgres, Redis) per the [self-hosting guide](https://docs.usertour.io/open-source/self-hosting.md), *then* authoring at least one flow in the dashboard, before anything can be triggered from code at all. |
| 2 | Dynamic element targeting | **3** | The existing `data-tour="node-<id>"` attribute is exactly the pattern UserTour's own docs recommend, and manual CSS selectors (not just picker-generated ones) are supported — but authoring happens in an external dashboard, not code, and there's no documented wait/retry behavior for elements that don't exist yet at flow-build time, unlike react-joyride's `MutationObserver` approach. |
| 3 | Framework integration friction | **2** | `init()`/`start(contentId)` are simple imperative calls, similar in shape to driver.js/Shepherd.js — trivial to trigger from a plain `onClick` or top-level effect. Scored comparably low because there's almost nothing React-specific to fight (no steps/refs/state to wire from the component side at all — that's also *why* criterion 6 is higher: the simplicity here is because so much has moved outside of code). |
| 4 | Styling/theming effort | **3** | Theming happens through a visual dashboard editor (colors, fonts, brand kit) rather than CSS overrides in code — potentially zero-code for a team happy to reuse UserTour's editor, but re-entering the app's exact Tailwind/MUI design tokens by hand in a separate visual tool is real, recurring effort compared to pointing a `styles`/`popoverClass` prop at existing CSS. |
| 5 | TypeScript support | **3** | Docs for the `usertour.js` loader package don't mention bundled types. A separate `@usertour/types` package exists on npm ("TypeScript type definitions and enums shared across the UserTour project"), but its applicability to the client-side loader specifically isn't documented — this is a genuine unknown rather than a confirmed gap, hence the middling, low-confidence score. |
| 6 | API surface / learning curve | **3** | The JS-facing API itself is the smallest of all four (`init`/`identify`/`group`/`track`/`start`/`endAll`) — smaller than driver.js's single factory function in spirit. But nearly all the real learning curve sits outside the SDK: the dashboard's flow builder, the OpenPicker extension workflow, environments/content IDs, and (if self-hosting) the deployment topology — a much larger conceptual surface than any of the three code-only libraries, even though there's less code to write. |
| 7 | Bundle size / dependencies | **1** | The npm loader package itself has zero dependencies; the real SDK is documented as under 16KB gzipped and loads UI pieces on demand from a CDN — a footprint competitive with driver.js's, and lighter than react-joyride's or Shepherd.js's. |

**Total: 19 / 35** — **Overall difficulty: Medium** (driven almost entirely by criterion 1's
infrastructure/account requirement and criterion 6's external-platform learning curve, not by code
complexity — the actual JS API is the simplest of the four).

**Time spent:** roughly 20–30 minutes of documentation research; effectively 0 minutes of hands-on
coding, debugging, or browser verification, since there was no live account or self-hosted instance to
exercise. This is qualitatively different time than the other three reports logged, which was almost
entirely hands-on.

## Comparing all four libraries in this series

| Library | Total score | Overall difficulty | Bundle footprint | Integration style |
|---|---|---|---|---|
| [driver.js](./driverjs-node-targeting.md) | 9 / 35 | Low | ~5KB, zero deps | Imperative, code-defined steps |
| [react-joyride](./react-joyride-node-targeting.md) | 13 / 35 | Low–Medium | ~30KB, 9 deps | Hook (`useJoyride`), code-defined steps |
| [Shepherd.js](./shepherdjs-node-targeting.md) | 13 / 35 | Low–Medium | ~42KB uncompressed, 2 deps | Imperative, code-defined steps |
| UserTour | 19 / 35 *(unverified)* | Medium | <16KB gzipped (loader ~0 deps) | Hosted platform; code only triggers dashboard-authored content |

The first three are all "bring your own React app, define steps in code" libraries and land in a
similar difficulty band. UserTour is architecturally the odd one out: its runtime footprint is
actually the smallest of the four, but it trades code-level control (and this repo's ability to
verify it without external infrastructure) for a visual, non-technical flow-authoring workflow — a
reasonable tradeoff for some teams, but a different kind of tool than the other three, and not
directly comparable on difficulty without an account or self-hosted instance to test against.
