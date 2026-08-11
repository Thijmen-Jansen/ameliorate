/**
 * Isolated proof-of-concept for bringing an off-screen React Flow node into view as part of a
 * react-joyride tour step, kept fully separate from the real `@reactour/tour`-based tutorial system
 * (see `tutorial.ts`/`TourSetter.tsx`), the other tour-library POCs (see `DriverTourPOC.tsx`/
 * `JoyrideTourPOC.tsx`/`ShepherdTourPOC.tsx`), and its off-screen siblings
 * (`OffscreenShepherdTourPOC.tsx`/`OffscreenDriverTourPOC.tsx`).
 *
 * Goal: prove that a tour step can pan a transform-based React Flow canvas to reveal a node that's
 * currently panned outside the viewport, before react-joyride positions its tooltip against it.
 *
 * `docs/reports/off-screen-node-targeting.md` originally concluded react-joyride had no extension
 * point for this, but that was checked against an older version - the installed 3.2.0 (see
 * `package.json`) is a full rewrite with a step-level `before` hook
 * (`before?: (data: TourData) => Promise<void>`) that the tour explicitly awaits before showing the
 * step, a direct equivalent of Shepherd's `beforeShowPromise`. There's also a step-level `skipScroll`
 * option to explicitly disable react-joyride's own scroll-based reveal (which, like the other two
 * libraries', assumes a scrollable ancestor and doesn't work against React Flow's transform-based
 * canvas) rather than relying on it becoming a no-op incidentally.
 *
 * One wrinkle specific to this library: `useJoyride`'s `steps` are declared at render time, but which
 * node to target (and its position, needed for the pan math) is only known once the button is clicked
 * - same timing as the other two POCs, but those build their tour object imperatively inside the click
 * handler, while react-joyride's steps are a hook input. Solved with a ref: the click handler resolves
 * the node and stores it in `targetNodeRef` before starting the tour, and the node step's `target`
 * (function form) and `before` hook both read from that ref lazily when the step actually shows.
 *
 * Like the other off-screen POCs, this must be rendered inside `<ReactFlowProvider>` (i.e. from within
 * `Diagram.tsx`, not `TopicWorkspace.tsx`), because it needs `useReactFlow()` to pan the viewport and
 * look up node positions.
 */

import { TravelExplore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useReactFlow, useStore } from "@xyflow/react";
import { useRef } from "react";
import { type Step, useJoyride } from "react-joyride";

import { ReactFlowNode } from "@/web/topic/utils/flowUtils";

const findFirstNodeId = (): string | null => {
  const firstNodeElement = document.querySelector('[data-tour^="node-"]');
  const dataTour = firstNodeElement?.getAttribute("data-tour");
  return dataTour ? dataTour.replace(/^node-/, "") : null;
};

export const OffscreenJoyrideTourPOCButton = () => {
  const { getNode, getViewport, setViewport, fitView } = useReactFlow();
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);

  // Holds the node resolved at click-time, since `steps` is a hook input declared at render time but
  // the target node is only known once the button is clicked - see file docstring.
  const targetNodeRef = useRef<ReactFlowNode | null>(null);

  const steps: Step[] = [
    {
      target: '[data-tour="poc-static-text-offscreen-joyride"]',
      title: "Off-Screen Node Tour POC (react-joyride)",
      content:
        "The diagram just panned away from a node so it's genuinely off-screen. The next step pans the viewport back before highlighting it.",
    },
    {
      target: () => {
        const node = targetNodeRef.current;
        return node ? document.querySelector<HTMLElement>(`[data-tour="node-${node.id}"]`) : null;
      },
      title: "Back in view",
      content: "The viewport panned back to include this node before the tooltip was positioned.",
      skipScroll: true, // avoid react-joyride's own scroll-based reveal racing our fitView pan
      before: async () => {
        const node = targetNodeRef.current;
        if (node) await fitView({ nodes: [node], duration: 400 });
      },
    },
  ];

  const { controls, Tour } = useJoyride({
    steps,
    continuous: true,
    options: { showProgress: true },
  });

  const startOffscreenJoyrideTourPOC = () => {
    const nodeId = findFirstNodeId();
    const node = nodeId ? (getNode(nodeId) as ReactFlowNode | undefined) : undefined;
    if (!node) {
      console.warn(
        "Off-screen node tour POC (react-joyride): no diagram nodes found to target, skipping.",
      );
      return;
    }
    // eslint-disable-next-line functional/immutable-data -- refs are meant to be mutated directly
    targetNodeRef.current = node;

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

    controls.start();
  };

  return (
    <div className="absolute right-2 bottom-64 z-10 flex items-center gap-2">
      <span data-tour="poc-static-text-offscreen-joyride">Off-Screen Node Tour POC demo text</span>

      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<TravelExplore />}
        onClick={startOffscreenJoyrideTourPOC}
      >
        Off-Screen Node Tour (react-joyride POC)
      </Button>

      {Tour}
    </div>
  );
};
