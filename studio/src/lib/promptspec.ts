import { blockCatalog } from "@/data/block-catalog";
import type { FlowEdge, FlowPreset } from "@/types/flow";
import type { PromptMetadata } from "@/types/prompt-metadata";

export interface PromptSpecNode {
  id: string;
  type: string;
  block: string;
  metadataId?: string;
  title?: string;
  category?: string;
  params: Record<string, unknown>;
  sourcePath?: string;
}

export interface PromptSpecEdgeGateDecision {
  selected?: boolean;
  rationale?: string;
  metrics?: {
    complexityScore?: number;
    tokenEstimate?: number;
    latencyEstimate?: number;
  };
}

export interface PromptSpecEdgeGate extends Omit<NonNullable<FlowEdge["gate"]>, "type"> {
  type: "reason.hybrid";
  decision?: PromptSpecEdgeGateDecision;
}

export interface PromptSpecEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  kind?: FlowEdge["kind"];
  condition?: string;
  branch?: string;
  gate?: PromptSpecEdgeGate;
}

export interface PromptSpec {
  version: "promptspec/v1";
  flow: {
    id: string;
    name: string;
    description: string;
  };
  nodes: PromptSpecNode[];
  edges: PromptSpecEdge[];
}

export function buildPromptSpec(
  preset: FlowPreset,
  paramsByNode: Record<string, Record<string, unknown>>,
  metadataMap: Map<string, PromptMetadata>,
): PromptSpec {
  const nodes: PromptSpecNode[] = preset.nodeIds.map((nodeId) => {
    const baseId = nodeId.includes("#") ? nodeId.split("#")[0] : nodeId;
    const descriptor = blockCatalog.find((block) => block.id === baseId);
    const metadata =
      (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
      metadataMap.get(baseId);

    return {
      id: nodeId,
      type: baseId,
      block: descriptor?.name ?? metadata?.title ?? baseId,
      metadataId: metadata?.id ?? descriptor?.metadataId,
      title: metadata?.title,
      category: descriptor?.category ?? metadata?.category,
      params: paramsByNode[nodeId] ?? {},
      sourcePath: metadata?.relativePath,
    };
  });

  const edges: PromptSpecEdge[] = [];
  if (preset.edges && preset.edges.length > 0) {
    let mappedIndex = 0;
    for (const edge of preset.edges) {
      if (!isValidFlowEdge(edge, preset.nodeIds)) continue;
      edges.push(mapFlowEdgeToPromptSpec(edge, mappedIndex));
      mappedIndex += 1;
    }
  }

  if (edges.length === 0) {
    for (let i = 0; i < preset.nodeIds.length - 1; i += 1) {
      edges.push({
        id: `${preset.nodeIds[i]}→${preset.nodeIds[i + 1]}`,
        from: preset.nodeIds[i],
        to: preset.nodeIds[i + 1],
        kind: "default",
      });
    }
  }

  return {
    version: "promptspec/v1",
    flow: {
      id: preset.id,
      name: preset.name,
      description: preset.description,
    },
    nodes,
    edges,
  };
}

function mapFlowEdgeToPromptSpec(edge: FlowEdge, index: number): PromptSpecEdge {
  const source = edge.source;
  const target = edge.target;
  return {
    id: edge.label ? `${source}→${target}:${edge.label}` : `${source}→${target}#${index + 1}`,
    from: source,
    to: target,
    label: edge.label,
    kind: edge.kind ?? (edge.branch ? "branch" : "default"),
    condition: edge.condition,
    branch: edge.branch ?? edge.gate?.branch,
    gate: edge.gate
      ? {
          type: "reason.hybrid",
          branch: edge.gate.branch,
          thresholds: edge.gate.thresholds,
        }
      : undefined,
  };
}

function isValidFlowEdge(edge: FlowEdge | undefined, nodeIds: string[]): edge is FlowEdge {
  if (!edge || typeof edge.source !== "string" || typeof edge.target !== "string") {
    return false;
  }
  if (!nodeIds.includes(edge.source) || !nodeIds.includes(edge.target)) {
    return false;
  }
  return true;
}
