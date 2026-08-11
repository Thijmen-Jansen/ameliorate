/**
 * Isolated proof-of-concept for bringing an off-screen React Flow node into view as part of a
 * Shepherd.js tour step, kept fully separate from the real `@reactour/tour`-based tutorial system
 * (see `tutorial.ts`/`TourSetter.tsx`), the other tour-library POCs (see `DriverTourPOC.tsx`/
 * `JoyrideTourPOC.tsx`/`ShepherdTourPOC.tsx`), and their off-screen siblings
 * (`OffscreenDriverTourPOC.tsx`/`OffscreenJoyrideTourPOC.tsx`).
 *
 * Goal: prove that a tour step can pan a transform-based React Flow canvas to reveal a node that's
 * currently panned outside the viewport, before Shepherd positions its popover against it. Shepherd's
 * `beforeShowPromise` is a step option purpose-built for this: a function returning a `Promise` that
 * Shepherd awaits before showing/positioning the step. See
 * `docs/reports/off-screen-node-targeting.md` and `docs/plans/off-screen-node-tour-poc-plan.md` for
 * the full research/design behind this mechanism, and `OffscreenDriverTourPOC.tsx`/
 * `OffscreenJoyrideTourPOC.tsx` for how the other two libraries achieve the same result via different
 * mechanisms.
 *
 * Unlike the other three POC buttons, this one must be rendered inside `<ReactFlowProvider>` (i.e.
 * from within `Diagram.tsx`, not `TopicWorkspace.tsx`), because it needs `useReactFlow()` to pan the
 * viewport and look up node positions.
 */

import { Route } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useReactFlow, useStore } from "@xyflow/react";
import Shepherd from "shepherd.js";

import "shepherd.js/dist/css/shepherd.css";

import { ReactFlowNode } from "@/web/topic/utils/flowUtils";

const findFirstNodeId = (): string | null => {
  const firstNodeElement = document.querySelector('[data-tour^="node-"]');
  const dataTour = firstNodeElement?.getAttribute("data-tour");
  return dataTour ? dataTour.replace(/^node-/, "") : null;
};

export const OffscreenShepherdTourPOCButton = () => {
  const { getNode, getViewport, setViewport, fitView } = useReactFlow();
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);

  const startOffscreenShepherdTourPOC = () => {
    const nodeId = findFirstNodeId();
    const node = nodeId ? (getNode(nodeId) as ReactFlowNode | undefined) : undefined;
    if (!node) {
      console.warn("Off-screen node tour POC: no diagram nodes found to target, skipping.");
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

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        // Shepherd's default scroll-based reveal doesn't work against React Flow's transform-based
        // canvas; the diagram-node step below pans the viewport back itself via `beforeShowPromise`.
        scrollTo: false,
      },
    });

    tour.addStep({
      id: "static-text",
      title: "Off-Screen Node Tour POC (Shepherd.js)",
      text: "The diagram just panned away from a node so it's genuinely off-screen. The next step pans the viewport back before highlighting it.",
      attachTo: { element: '[data-tour="poc-static-text-offscreen-shepherd"]', on: "top" },
      buttons: [{ text: "Next", action: () => tour.next() }],
    });

    tour.addStep({
      id: "offscreen-node",
      title: "Back in view",
      text: "The viewport panned back to include this node before the popover was positioned.",
      attachTo: { element: `[data-tour="node-${node.id}"]`, on: "bottom" },
      beforeShowPromise: () => fitView({ nodes: [node], duration: 400 }),
      buttons: [{ text: "Done", action: () => tour.complete() }],
    });

    void tour.start();
  };

  return (
    <div className="absolute right-2 bottom-40 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text-offscreen-shepherd">Off-Screen Node Tour POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<Route />}
        onClick={startOffscreenShepherdTourPOC}
      >
        Off-Screen Node Tour (Shepherd.js POC)
      </Button>
    </div>
  );
};
