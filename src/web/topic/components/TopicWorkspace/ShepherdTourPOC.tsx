/**
 * Isolated proof-of-concept for using Shepherd.js as an onboarding tour engine, kept fully
 * separate from the real `@reactour/tour`-based tutorial system (see
 * `tutorial.ts`/`TourSetter.tsx`) and the driver.js/react-joyride POCs (see
 * `DriverTourPOC.tsx`/`JoyrideTourPOC.tsx`).
 *
 * Goal: prove that Shepherd.js can highlight elements inside the React Flow diagram, which are
 * dynamic/user-created and only exist in the DOM once the diagram has rendered a node. Reuses the
 * same `data-tour="node-<id>"` attribute plumbed onto nodes for the driver.js POC (see
 * `docs/reports/driverjs-node-targeting.md`) — that plumbing is app-level, not library-specific.
 */

import { Route } from "@mui/icons-material";
import { Button } from "@mui/material";
import Shepherd from "shepherd.js";

import "shepherd.js/dist/css/shepherd.css";

const findFirstNodeSelector = (): string | null => {
  const firstNodeElement = document.querySelector('[data-tour^="node-"]');
  const dataTour = firstNodeElement?.getAttribute("data-tour");
  return dataTour ? `[data-tour="${dataTour}"]` : null;
};

export const startShepherdPOCTour = () => {
  const nodeSelector = findFirstNodeSelector();
  if (!nodeSelector) {
    console.warn("Shepherd.js POC: no diagram nodes found to highlight, skipping that step.");
  }

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      scrollTo: true,
    },
  });

  tour.addStep({
    id: "static-text",
    title: "Shepherd.js POC",
    text: "This is a Shepherd.js-powered popover highlighting some static page text.",
    attachTo: { element: '[data-tour="poc-static-text-shepherd"]', on: "top" },
    buttons: [
      {
        text: nodeSelector ? "Next" : "Done",
        action: () => (nodeSelector ? tour.next() : tour.complete()),
      },
    ],
  });

  if (nodeSelector) {
    tour.addStep({
      id: "diagram-node",
      title: "A node in the diagram",
      text: "This is a node inside the React Flow diagram, highlighted via a data-tour attribute set on the node itself.",
      attachTo: { element: nodeSelector, on: "bottom" },
      buttons: [{ text: "Done", action: () => tour.complete() }],
    });
  }

  void tour.start();
};

export const ShepherdTourPOCButton = () => {
  return (
    <div className="absolute right-2 bottom-28 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text-shepherd">Shepherd.js POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<Route />}
        onClick={startShepherdPOCTour}
      >
        Shepherd.js Tour (POC)
      </Button>
    </div>
  );
};
