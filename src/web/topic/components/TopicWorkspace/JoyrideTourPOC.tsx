/**
 * Isolated proof-of-concept for using react-joyride as an onboarding tour engine, kept fully
 * separate from both the real `@reactour/tour`-based tutorial system (see
 * `tutorial.ts`/`TourSetter.tsx`) and the driver.js POC (see `DriverTourPOC.tsx`).
 *
 * Goal: prove that react-joyride can highlight elements inside the React Flow diagram, which are
 * dynamic/user-created and only exist in the DOM once the diagram has rendered a node. Reuses the
 * same `data-tour="node-<id>"` attribute plumbed onto nodes for the driver.js POC (see
 * `docs/reports/driverjs-node-targeting.md`) — that plumbing is app-level, not library-specific.
 */

import { TravelExplore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { type Step, useJoyride } from "react-joyride";

const steps: Step[] = [
  {
    target: '[data-tour="poc-static-text-joyride"]',
    title: "React Joyride POC",
    content: "This is a react-joyride-powered popover highlighting some static page text.",
  },
  {
    // prefix match, same as the driver.js POC - grabs whichever node happens to be rendered, and
    // is re-resolved (with a built-in wait/mutation-observer) when this step becomes active, so it
    // works even if no node exists yet at tour-start time.
    target: '[data-tour^="node-"]',
    title: "A node in the diagram",
    content:
      "This is a node inside the React Flow diagram, highlighted via the same data-tour attribute used by the driver.js POC.",
  },
];

export const JoyrideTourPOCButton = () => {
  const { controls, Tour } = useJoyride({
    steps,
    continuous: true,
    options: { showProgress: true },
  });

  return (
    <div className="absolute right-2 bottom-16 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text-joyride">React Joyride POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<TravelExplore />}
        onClick={() => controls.start()}
      >
        React Joyride Tour (POC)
      </Button>

      {Tour}
    </div>
  );
};
