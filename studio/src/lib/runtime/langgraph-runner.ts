import { blockCatalog } from "@/data/block-catalog";
import type { PromptSpec } from "@/lib/promptspec";
import type {
  AudioTimelinePayload,
  ModalityRequirement,
  ModalityState,
  PromptMetadata,
  SceneGraphPayload,
  VideoEventGraphPayload,
} from "@/types/prompt-metadata";
import {
  evaluateHybridDecision,
  type HybridDecisionTelemetry,
  computeFlowComplexity,
} from "@/lib/runtime/hybrid-controller";
import { loadPromptLibrary } from "@/lib/load-prompts";
import { RunnableLambda } from "@langchain/core/runnables";

export interface LangGraphRunBlockOutput {
  flowSummary?: string;
  guidance?: string;
  failureModes?: string;
  acceptanceCriteria?: string;
  combinesWith?: string[];
  compositionSteps?: string[];
  paramsUsed?: Record<string, unknown>;
  note?: string;
  gating?: {
    selectedBranch: string;
    rationale: string;
    thresholds: HybridDecisionTelemetry["thresholds"];
    metrics: HybridDecisionTelemetry["metrics"];
  };
}

export interface LangGraphRunBlock {
  id: string;
  block: string;
  params: Record<string, unknown>;
  output: LangGraphRunBlockOutput;
}

export interface LangGraphRunResult {
  runId: string;
  receivedAt: string;
  manifest: {
    flow: PromptSpec["flow"];
    nodeCount: number;
    edgeCount: number;
    blocks: LangGraphRunBlock[];
    complexityScore: number;
  };
  gatingDecisions: HybridDecisionTelemetry[];
  message: string;
}

export async function executeLangGraph(promptSpec: PromptSpec): Promise<LangGraphRunResult> {
  const runId = `langgraph-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const metadataList = await loadPromptLibrary();
  const metadataMap = new Map<string, PromptMetadata>(metadataList.map((item) => [item.id, item]));

  const runnable = buildRunnableFromSpec(promptSpec, metadataMap);
  const outputs: LangGraphRunBlock[] = [];
  const gatingDecisions: HybridDecisionTelemetry[] = [];
  const complexityScore = computeFlowComplexity(promptSpec);

  for (let index = 0; index < promptSpec.nodes.length; index += 1) {
    const node = promptSpec.nodes[index];
    const result = await runnable.invoke({ node });
    let enrichedOutput = result;

    if (node.type === "reason.hybrid") {
      const decision = evaluateHybridDecision(promptSpec, index);
      gatingDecisions.push(decision);
      enrichedOutput = {
        ...result,
        note: decision.rationale || `Hybrid router selected ${decision.selectedBranch} branch.`,
        gating: {
          selectedBranch: decision.selectedBranch,
          rationale: decision.rationale,
          thresholds: decision.thresholds,
          metrics: decision.metrics,
        },
      };
    }

    outputs.push({
      id: node.id,
      block: node.block,
      params: node.params,
      output: enrichedOutput,
    });
  }

  return {
    runId,
    receivedAt: timestamp,
    manifest: {
      flow: promptSpec.flow,
      nodeCount: promptSpec.nodes.length,
      edgeCount: promptSpec.edges.length,
      blocks: outputs,
      complexityScore,
    },
    gatingDecisions,
    message: "Executed via LangGraph runnable stub. Replace with a full graph runtime to call real models.",
  };
}

function buildRunnableFromSpec(
  promptSpec: PromptSpec,
  metadataMap: Map<string, PromptMetadata>,
) {
  const flowSummary = `${promptSpec.flow.name} (${promptSpec.nodes.length} nodes)`;
  return RunnableLambda.from<{ node: PromptSpec["nodes"][number] }, LangGraphRunBlockOutput>(
    async ({ node }) => {
      const metadata = node.metadataId ? metadataMap.get(node.metadataId) : undefined;
      return {
        flowSummary,
        guidance: metadata?.when_to_use,
        failureModes: metadata?.failure_modes,
        acceptanceCriteria: metadata?.acceptance_criteria,
        combinesWith: metadata?.combines_with,
        compositionSteps: metadata?.composition_steps,
        paramsUsed: node.params,
        note: `Stubbed execution for ${node.block}`,
      };
    },
  );
}
