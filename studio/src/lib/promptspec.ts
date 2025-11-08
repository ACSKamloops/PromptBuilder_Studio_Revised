import { blockCatalog } from "@/data/block-catalog";
import type { FlowPreset } from "@/types/flow";
import type { PromptMetadata } from "@/types/prompt-metadata";

export interface PromptSpecNode {
  id: string;
  block: string;
  metadataId?: string;
  title?: string;
  params: Record<string, unknown>;
  sourcePath?: string;
}

export interface PromptSpecEdge {
  from: string;
  to: string;
}

export interface PromptSpec {
  version: "promptspec/v1";
  flow: {
    id: string;
    name: string;
    description: string;
    sourcePath?: string;
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
    const descriptor = blockCatalog.find((block) => block.id === nodeId);
    const metadata =
      (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
      metadataMap.get(nodeId);

    return {
      id: nodeId,
      block: descriptor?.name ?? metadata?.title ?? nodeId,
      metadataId: metadata?.id ?? descriptor?.metadataId,
      title: metadata?.title,
      params: paramsByNode[nodeId] ?? {},
      sourcePath: metadata?.relativePath,
    };
  });

  const edges: PromptSpecEdge[] = [];
  for (let i = 0; i < preset.nodeIds.length - 1; i += 1) {
    edges.push({
      from: preset.nodeIds[i],
      to: preset.nodeIds[i + 1],
    });
  }

  return {
    version: "promptspec/v1",
    flow: {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      sourcePath: preset.sourcePath,
    },
    nodes,
    edges,
  };
}
