import { blockCatalog, type BlockDescriptor } from "@/data/block-catalog";
import type { PromptMetadata } from "@/types/prompt-metadata";

export function resolveBlockDescriptor(
  blockId: string,
  metadataMap: Map<string, PromptMetadata>,
): BlockDescriptor | undefined {
  const descriptor = blockCatalog.find((block) => block.id === blockId);
  if (descriptor) {
    return descriptor;
  }

  const metadata = metadataMap.get(blockId);
  if (!metadata) {
    return undefined;
  }

  return {
    id: blockId,
    name: metadata.title ?? blockId,
    category: metadata.category ?? "Structure",
    description:
      metadata.when_to_use ??
      metadata.failure_modes ??
      "Prompt loaded from library metadata.",
    status: "available",
    metadataId: metadata.id,
    references: metadata.relativePath ? [metadata.relativePath] : undefined,
    modalities: metadata.modalities,
  };
}
