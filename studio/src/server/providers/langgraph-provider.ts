import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { enqueueApprovals } from "@/server/approval-inbox";
import { LlmProvider, ProviderRunResult, RunStreamEvent, TokenUsage } from "./types";

function estimateUsage(spec: PromptSpec): TokenUsage {
  const promptChars = JSON.stringify(spec.nodes).length + JSON.stringify(spec.edges).length;
  const completionChars = spec.nodes.length * 640; // rough heuristic for proposer+verifier pairs
  const promptTokens = Math.max(1, Math.round(promptChars / 4));
  const completionTokens = Math.max(1, Math.round(completionChars / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export class LangGraphProvider implements LlmProvider {
  readonly name = "langgraph";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const startedAt = new Date();
    const graphResult = await executeLangGraph(spec);
    const completedAt = new Date();
    const usage = estimateUsage(spec);
    const latencyMs = completedAt.getTime() - startedAt.getTime();
    const costUsd = usage.totalTokens * 0.0000025; // illustrative stub pricing

    const runResult: ProviderRunResult = {
      runId: graphResult.runId,
      startedAt: graphResult.receivedAt,
      completedAt: completedAt.toISOString(),
      latencyMs,
      costUsd,
      usage,
      manifest: graphResult.manifest,
      verification: graphResult.verification,
      gatingDecisions: graphResult.gatingDecisions,
      message: graphResult.message,
    };
    enqueueApprovals(spec, runResult);
    return runResult;
  }

  async *stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent> {
    yield { type: "run_started", data: { nodeCount: spec.nodes.length, edgeCount: spec.edges.length } };
    let index = 0;
    for (const node of spec.nodes) {
      yield { type: "node_started", data: { id: node.id, label: node.block, index } };
      await new Promise((resolve) => setTimeout(resolve, 45));
      yield { type: "node_completed", data: { id: node.id, ok: true } };
      index += 1;
    }
    const result = await this.run(spec);
    yield { type: "run_completed", data: result };
  }
}
