import ELK from "elkjs/lib/elk.bundled.js";
import type { FlowPreset } from "@/types/flow";

const elk = new ELK();

interface Position {
  x: number;
  y: number;
}

export async function computeElkLayout(
  flow: FlowPreset,
  defaultPositions: Record<string, Position>,
): Promise<Record<string, Position>> {
  try {
    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
        "elk.spacing.nodeNode": "48",
      },
      children: flow.nodeIds.map((id) => ({
        id,
        width: 220,
        height: 120,
      })),
      edges: flow.nodeIds.slice(0, -1).map((source, index) => ({
        id: `${source}->${flow.nodeIds[index + 1]}`,
        sources: [source],
        targets: [flow.nodeIds[index + 1]],
      })),
    };

    const layout = await elk.layout(graph);
    const result: Record<string, Position> = { ...defaultPositions };
    if (layout.children) {
      for (const child of layout.children) {
        if (typeof child.x === "number" && typeof child.y === "number") {
          result[child.id] = { x: child.x, y: child.y };
        }
      }
    }
    return result;
  } catch (error) {
    console.warn("ELK layout failed, falling back to defaults", error);
    return defaultPositions;
  }
}
