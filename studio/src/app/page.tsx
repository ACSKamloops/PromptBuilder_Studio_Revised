import { loadPromptLibrary } from "@/lib/load-prompts";
import StudioShell from "@/components/studio-shell";
import type { FlowPreset } from "@/types/flow";
import type { PromptMetadata } from "@/types/prompt-metadata";

export default async function HomePage() {
  const metadata = await loadPromptLibrary();
  const presets = buildFlowPresets(metadata);
  const initialPresetId = presets[0]?.id ?? "baseline-deep-research";

  return <StudioShell library={metadata} presets={presets} initialPresetId={initialPresetId} />;
}

function buildFlowPresets(metadata: PromptMetadata[]): FlowPreset[] {
  const baseline: FlowPreset = {
    id: "baseline-deep-research",
    name: "Baseline · Deep Research",
    description:
      "System Mandate → User Task → RAG Retriever → Exclusion Check → Chain of Verification → Table Formatter.",
    nodeIds: [
      "system-mandate",
      "user-task",
      "rag-retriever",
      "exclusion-check",
      "cov",
      "table-formatter",
    ],
    sourcePath: "baseline",
  };

  const compositionPresets = metadata
    .filter((item) => item.kind === "composition" && item.composition_steps?.length)
    .map<FlowPreset>((composition) => ({
      id: `composition-${composition.id}`,
      name: composition.title,
      description:
        composition.when_to_use ??
        composition.failure_modes ??
        "Starter composition flow from prompt-library-starter.",
      nodeIds: composition.composition_steps ?? [],
      sourcePath: composition.relativePath,
    }));

  return [baseline, ...compositionPresets];
}
