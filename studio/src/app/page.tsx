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
      "System Mandate → User Task → Hybrid Router → (Fast Table) ∥ (RAG → Exclusion → CoV) → Table Formatter.",
    nodeIds: [
      "system-mandate",
      "user-task",
      "reason.hybrid",
      "rag-retriever",
      "exclusion-check",
      "cov",
      "table-formatter",
    ],
    edges: [
      { source: "system-mandate", target: "user-task", label: "role & scope" },
      { source: "user-task", target: "reason.hybrid", label: "task complexity" },
      {
        source: "reason.hybrid",
        target: "table-formatter",
        label: "fast synthesis",
        kind: "branch",
        branch: "fast",
        gate: {
          type: "reason.hybrid",
          branch: "fast",
          thresholds: { maxComplexity: 6, maxTokens: 2400, maxLatencyMs: 4000 },
        },
      },
      {
        source: "reason.hybrid",
        target: "rag-retriever",
        label: "deliberate research",
        kind: "branch",
        branch: "deliberate",
        gate: {
          type: "reason.hybrid",
          branch: "deliberate",
          thresholds: { maxComplexity: 24, maxTokens: 12000, maxLatencyMs: 16000 },
        },
      },
      { source: "rag-retriever", target: "exclusion-check", label: "retrieved text" },
      { source: "exclusion-check", target: "cov", label: "filtered items" },
      { source: "cov", target: "table-formatter", label: "verified output" },
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
