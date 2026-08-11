/**
 * Isolated proof-of-concept for bringing an off-screen React Flow node into view as part of a
 * driver.js tour step, kept fully separate from the real `@reactour/tour`-based tutorial system (see
 * `tutorial.ts`/`TourSetter.tsx`), the other tour-library POCs (see `DriverTourPOC.tsx`/
 * `JoyrideTourPOC.tsx`/`ShepherdTourPOC.tsx`), and its off-screen siblings
 * (`OffscreenShepherdTourPOC.tsx`/`OffscreenJoyrideTourPOC.tsx`).
 *
 * Goal: prove that a tour step can pan a transform-based React Flow canvas to reveal a node that's
 * currently panned outside the viewport, before driver.js positions its popover against it.
 *
 * Unlike Shepherd's `beforeShowPromise`/react-joyride's `before` hook, driver.js has no documented
 * async pre-show hook (per `docs/reports/off-screen-node-targeting.md`) - every hook in its `Config`/
 * `Popover`/`DriveStep` types is synchronous (`(element, step, opts) => void`). Reading driver.js's
 * bundled source (`node_modules/driver.js/dist/driver.js.iife.js`) shows that when a step's
 * `popover.onNextClick` is set, its "Next" button click handler calls *only* `onNextClick` with no
 * fallback advance - so `onNextClick` fully replaces the default `moveNext()` call. That's used here
 * as the gate: the intro step's `onNextClick` pans the viewport back and calls `opts.driver.moveNext()`
 * itself only once that pan finishes, mirroring what `beforeShowPromise`/`before` do natively in the
 * other two libraries.
 *
 * Bonus: driver.js's own reveal call (`element.scrollIntoView(...)`) is skipped internally whenever
 * the target is already fully within the viewport by the time it runs. Because `moveNext()` isn't
 * called until after our own pan-back finishes, the node is already on-screen by then, so driver.js's
 * built-in (otherwise broken, transform-blind) scroll-into-view becomes a no-op automatically - no
 * config flag needed to suppress it.
 *
 * Like the other off-screen POCs, this must be rendered inside `<ReactFlowProvider>` (i.e. from within
 * `Diagram.tsx`, not `TopicWorkspace.tsx`), because it needs `useReactFlow()` to pan the viewport and
 * look up node positions.
 */

import { Explore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useReactFlow, useStore } from "@xyflow/react";
import { DriveStep, driver } from "driver.js";

import "driver.js/dist/driver.css";

import { ReactFlowNode } from "@/web/topic/utils/flowUtils";

const findFirstNodeId = (): string | null => {
  const firstNodeElement = document.querySelector('[data-tour^="node-"]');
  const dataTour = firstNodeElement?.getAttribute("data-tour");
  return dataTour ? dataTour.replace(/^node-/, "") : null;
};

export const OffscreenDriverTourPOCButton = () => {
  const { getNode, getViewport, setViewport, fitView } = useReactFlow();
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);

  const startOffscreenDriverTourPOC = () => {
    const nodeId = findFirstNodeId();
    const node = nodeId ? (getNode(nodeId) as ReactFlowNode | undefined) : undefined;
    if (!node) {
      console.warn(
        "Off-screen node tour POC (driver.js): no diagram nodes found to target, skipping.",
      );
      return;
    }

    // Pan far enough away that the node's screen position lands multiple viewport-widths/heights
    // outside the visible area, regardless of current zoom or where the diagram happens to be laid
    // out - genuine, visible proof the node is off-screen before the tour starts.
    const viewport = getViewport();
    void setViewport(
      {
        x: -2 * viewportWidth - node.position.x * viewport.zoom,
        y: -2 * viewportHeight - node.position.y * viewport.zoom,
        zoom: viewport.zoom,
      },
      { duration: 300 },
    );

    const steps: DriveStep[] = [
      {
        element: '[data-tour="poc-static-text-offscreen-driver"]',
        popover: {
          title: "Off-Screen Node Tour POC (driver.js)",
          description:
            "The diagram just panned away from a node so it's genuinely off-screen. Clicking Next pans the viewport back before highlighting it.",
          // driver.js has no async pre-show hook, so `onNextClick` replaces the default advance
          // entirely: pan back, then advance only once that finishes.
          onNextClick: (_element, _step, opts) => {
            void (async () => {
              await fitView({ nodes: [node], duration: 400 });
              opts.driver.moveNext();
            })();
          },
        },
      },
      {
        element: `[data-tour="node-${node.id}"]`,
        popover: {
          title: "Back in view",
          description:
            "The viewport panned back to include this node before the popover was positioned.",
        },
      },
    ];

    driver({ showProgress: true, steps }).drive();
  };

  return (
    <div className="absolute right-2 bottom-52 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text-offscreen-driver">Off-Screen Node Tour POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<Explore />}
        onClick={startOffscreenDriverTourPOC}
      >
        Off-Screen Node Tour (driver.js POC)
      </Button>
    </div>
  );
};
