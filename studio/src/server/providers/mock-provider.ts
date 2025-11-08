import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { LlmProvider, ProviderRunResult, RunStreamEvent, TokenUsage } from "./types";
import { enqueueApprovals } from "@/server/approval-inbox";

function estimateUsage(spec: PromptSpec): TokenUsage {
  const promptChars = JSON.stringify(spec.nodes).length + JSON.stringify(spec.edges).length;
  const completionChars = spec.nodes.length * 480; // rough stub
  const promptTokens = Math.max(1, Math.round(promptChars / 4));
  const completionTokens = Math.max(1, Math.round(completionChars / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const startedAt = new Date();
    const graphResult = await executeLangGraph(spec);
    const completedAt = new Date();
    const usage = estimateUsage(spec);
    const latencyMs = completedAt.getTime() - startedAt.getTime();
    const costUsd = usage.totalTokens * 0.000002; // stub pricing

    const metrics = [
      {
        id: "latency",
        label: "Latency",
        value: `${latencyMs} ms`,
        detail: "Target ≤ 3500 ms",
      },
      {
        id: "tokens",
        label: "Total tokens",
        value: usage.totalTokens.toLocaleString(),
        detail: `${usage.promptTokens.toLocaleString()} prompt · ${usage.completionTokens.toLocaleString()} completion`,
      },
      {
        id: "cost",
        label: "Estimated cost",
        value: `$${costUsd.toFixed(4)}`,
        detail: "Stub pricing ($0.002 / 1K tokens)",
      },
    ];

    const benchmarks = [
      {
        id: "deep-research-mini",
        name: "DeepResearch@mini",
        score: "92 (pass)",
        tier: "gold" as const,
        delta: "+3 vs. baseline",
      },
      {
        id: "truthfulqa",
        name: "TruthfulQA",
        score: "84",
        tier: "silver" as const,
        delta: "+1 vs. last run",
      },
    ];

    const provenance = graphResult.manifest.blocks.map((block) => {
      const sources: { label: string; url?: string }[] = [];
      if (Array.isArray(block.output.compositionSteps)) {
        sources.push(
          ...block.output.compositionSteps.map((step, idx) => ({
            label: `${idx + 1}. ${step}`,
          })),
        );
      }
      if (Array.isArray(block.output.combinesWith)) {
        sources.push(
          ...block.output.combinesWith.map((ref) => ({
            label: ref,
          })),
        );
      }
      if (block.output.paramsUsed && Object.keys(block.output.paramsUsed).length > 0 && sources.length === 0) {
        sources.push(
          ...Object.keys(block.output.paramsUsed).map((param) => ({
            label: `param:${param}`,
          })),
        );
      }
      return {
        nodeId: block.id,
        block: block.block,
        verdict: block.output.failureModes ? ("warning" as const) : ("ok" as const),
        summary:
          block.output.guidance?.split("\n")[0] ??
          block.output.note ??
          `Executed ${block.block}`,
        sources: sources.length > 0 ? sources : undefined,
      };
    });

    const runResult: ProviderRunResult = {
      runId: graphResult.runId,
      startedAt: graphResult.receivedAt,
      completedAt: completedAt.toISOString(),
      latencyMs,
      costUsd,
      usage,
      manifest: graphResult.manifest,
      message: graphResult.message,
      analytics: {
        metrics,
        benchmarks,
        provenance,
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
    yield { type: "run_completed", data: result };
  }
}
