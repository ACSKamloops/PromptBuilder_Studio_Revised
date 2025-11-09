import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { enqueueApprovals } from "@/server/approval-inbox";
import { LlmProvider, ProviderRunResult, RunStreamEvent } from "./types";

export class LangGraphProvider implements LlmProvider {
  readonly name = "langgraph";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const graphResult = await executeLangGraph(spec);
    const tokenTotals = graphResult.metrics?.totals ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: graphResult.latencyMs ?? 0,
    };
    const usage = {
      promptTokens: tokenTotals.promptTokens,
      completionTokens: tokenTotals.completionTokens,
      totalTokens: tokenTotals.totalTokens,
    };
    const latencyMs = graphResult.latencyMs ?? tokenTotals.latencyMs ?? 0;
    const costUsd = usage.totalTokens * 0.0000025; // illustrative stub pricing

    const runResult: ProviderRunResult = {
      runId: graphResult.runId,
      startedAt: graphResult.startedAt ?? graphResult.receivedAt,
      completedAt: graphResult.completedAt ?? new Date().toISOString(),
      latencyMs,
      costUsd,
      usage,
      manifest: graphResult.manifest,
      verification: graphResult.verification,
      gatingDecisions: graphResult.gatingDecisions,
      benchmarks: graphResult.benchmarks,
      metrics: graphResult.metrics,
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
    if (result.metrics) {
      yield { type: "metrics", data: { runId: result.runId, metrics: result.metrics } };
    }
    yield { type: "run_completed", data: result };
  }
}
