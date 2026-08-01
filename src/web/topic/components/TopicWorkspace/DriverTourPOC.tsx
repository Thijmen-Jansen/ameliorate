/**
 * Isolated proof-of-concept for using driver.js as an onboarding tour engine, kept fully separate
 * from the real `@reactour/tour`-based tutorial system (see `tutorial.ts`/`TourSetter.tsx`).
 *
 * Goal: prove that driver.js can highlight elements inside the React Flow diagram, which are
 * dynamic/user-created and only exist in the DOM once the diagram has rendered a node.
 */

import { Explore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { DriveStep, driver } from "driver.js";

import "driver.js/dist/driver.css";

const findFirstNodeSelector = (): string | null => {
  const firstNodeElement = document.querySelector('[data-tour^="node-"]');
  const dataTour = firstNodeElement?.getAttribute("data-tour");
  return dataTour ? `[data-tour="${dataTour}"]` : null;
};

export const startDriverPOCTour = () => {
  const nodeSelector = findFirstNodeSelector();
  if (!nodeSelector) {
    console.warn("Driver.js POC: no diagram nodes found to highlight, skipping that step.");
  }

  const steps: DriveStep[] = [
    {
      element: '[data-tour="poc-static-text"]',
      popover: {
        title: "Driver.js POC",
        description: "This is a driver.js-powered popover highlighting some static page text.",
      },
    },
    ...(nodeSelector
      ? [
          {
            element: nodeSelector,
            popover: {
              title: "A node in the diagram",
              description:
                "This is a node inside the React Flow diagram, highlighted via a data-tour attribute set on the node itself.",
            },
          },
        ]
      : []),
  ];

  driver({ showProgress: true, steps }).drive();
};

export const DriverTourPOCButton = () => {
  return (
    <div className="absolute right-2 bottom-2 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text">Driver.js POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<Explore />}
        onClick={startDriverPOCTour}
      >
        Driver.js Tour (POC)
      </Button>
    </div>
  );
};
