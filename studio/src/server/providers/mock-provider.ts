import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { estimateCostUsd, estimateTokenUsage } from "@/lib/runtime/usage";
import { LlmProvider, ProviderRunResult, RunStreamEvent } from "./types";
import { enqueueApprovals } from "@/server/approval-inbox";

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const startedAt = new Date();
    const graphResult = await executeLangGraph(spec);
    const completedAt = new Date();
    const usage = estimateTokenUsage(spec);
    const latencyMs = completedAt.getTime() - startedAt.getTime();
    const costUsd = estimateCostUsd(usage);
    const gatingDecisions = graphResult.gatingDecisions.map((decision) => ({
      ...decision,
      metrics: {
        ...decision.metrics,
        observedTokens: usage.totalTokens,
        observedLatencyMs: latencyMs,
        observedCostUsd: costUsd,
      },
    }));

    const runResult: ProviderRunResult = {
      runId: graphResult.runId,
      startedAt: graphResult.receivedAt,
      completedAt: completedAt.toISOString(),
      latencyMs,
      costUsd,
      usage,
      manifest: graphResult.manifest,
      gatingDecisions,
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
      await new Promise((resolve) => setTimeout(resolve, 35));
      yield { type: "node_completed", data: { id: node.id, ok: true } };
      index += 1;
    }
    const result = await this.run(spec);
    yield { type: "run_completed", data: result };
  }
}
