import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { LlmProvider, ProviderRunResult, RunStreamEvent } from "./types";
import { enqueueApprovals } from "@/server/approval-inbox";

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const graphResult = await executeLangGraph(spec);
    const usage = {
      promptTokens: graphResult.metrics.totals.promptTokens,
      completionTokens: graphResult.metrics.totals.completionTokens,
      totalTokens: graphResult.metrics.totals.totalTokens,
    };
    const latencyMs = graphResult.latencyMs;
    const costUsd = usage.totalTokens * 0.000002; // stub pricing

    const runResult: ProviderRunResult = {
      runId: graphResult.runId,
      startedAt: graphResult.startedAt,
      completedAt: graphResult.completedAt,
      latencyMs,
      costUsd,
      usage,
      manifest: graphResult.manifest,
      message: graphResult.message,
      metrics: graphResult.metrics,
      promptMetrics: {
        promptId: graphResult.manifest.flow.id,
        promptName: graphResult.manifest.flow.name,
        runCount: 1,
        lastRunId: graphResult.runId,
        lastUpdated: graphResult.completedAt,
        latency: {
          count: 1,
          mean: latencyMs,
          variance: 0,
          standardDeviation: 0,
          min: latencyMs,
          max: latencyMs,
          last: latencyMs,
        },
        tokens: {
          prompt: {
            count: 1,
            mean: usage.promptTokens,
            variance: 0,
            standardDeviation: 0,
            min: usage.promptTokens,
            max: usage.promptTokens,
            last: usage.promptTokens,
          },
          completion: {
            count: 1,
            mean: usage.completionTokens,
            variance: 0,
            standardDeviation: 0,
            min: usage.completionTokens,
            max: usage.completionTokens,
            last: usage.completionTokens,
          },
          total: {
            count: 1,
            mean: usage.totalTokens,
            variance: 0,
            standardDeviation: 0,
            min: usage.totalTokens,
            max: usage.totalTokens,
            last: usage.totalTokens,
          },
        },
      },
    };
    enqueueApprovals(spec, runResult);
    return runResult;
  }

  async *stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent> {
    yield { type: "run_started", data: { nodeCount: spec.nodes.length, edgeCount: spec.edges.length } };
    let index = 0;
    for (const node of spec.nodes) {
      yield { type: "node_started", data: { id: node.id, label: node.block, index } };
      await new Promise((resolve) => setTimeout(resolve, 35));
      yield { type: "node_completed", data: { id: node.id, ok: true } };
      index += 1;
    }
    const result = await this.run(spec);
    yield { type: "metrics", data: { runId: result.runId, metrics: result.metrics } };
    yield { type: "run_completed", data: result };
  }
}
