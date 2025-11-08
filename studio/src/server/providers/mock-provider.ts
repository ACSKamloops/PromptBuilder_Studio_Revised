import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import type { LangGraphRunBlock } from "@/lib/runtime/langgraph-runner";
import { enqueueApprovals } from "@/server/approval-inbox";
import { LlmProvider, ProviderRunResult, RunStreamEvent, TokenUsage } from "./types";

function aggregateUsage(blocks: LangGraphRunBlock[]): TokenUsage {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const block of blocks) {
    promptTokens += block.artifact?.metrics.tokens.prompt ?? 0;
    completionTokens += block.artifact?.metrics.tokens.completion ?? 0;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

function calculateCost(usage: TokenUsage): number {
  return Number((usage.totalTokens * 0.0000025).toFixed(6));
}

function createRunResult(
  graphResult: Awaited<ReturnType<typeof executeLangGraph>>,
  completedAt: Date,
): ProviderRunResult {
  const usage = aggregateUsage(graphResult.manifest.blocks);
  const startedAt = new Date(graphResult.receivedAt);
  const latencyMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

  return {
    runId: graphResult.runId,
    startedAt: graphResult.receivedAt,
    completedAt: completedAt.toISOString(),
    latencyMs,
    costUsd: calculateCost(usage),
    usage,
    manifest: graphResult.manifest,
    benchmarks: graphResult.benchmarks,
    logs: graphResult.logs,
    message: graphResult.message,
  };
}

function chunkText(text: unknown): string[] {
  if (typeof text !== "string") {
    try {
      text = JSON.stringify(text ?? "");
    } catch {
      text = String(text ?? "");
    }
  }
  const normalized = (text as string).trim();
  if (!normalized) return [];
  const size = 72;
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += size) {
    chunks.push(normalized.slice(i, i + size));
  }
  return chunks;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async run(spec: PromptSpec): Promise<ProviderRunResult> {
    const graphResult = await executeLangGraph(spec);
    const completedAt = new Date();
    const runResult = createRunResult(graphResult, completedAt);
    enqueueApprovals(spec, runResult);
    return runResult;
  }

  async *stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent> {
    const graphResult = await executeLangGraph(spec);
    const completedAt = new Date();
    const runResult = createRunResult(graphResult, completedAt);
    enqueueApprovals(spec, runResult);

    yield {
      type: "run_started",
      data: { nodeCount: spec.nodes.length, edgeCount: spec.edges.length },
    };

    let index = 0;
    for (const block of graphResult.manifest.blocks) {
      yield { type: "node_started", data: { id: block.id, label: block.block, index } };
      const summary = block.artifact.outputs.summary ?? block.artifact.logs[0] ?? block.block;
      for (const token of chunkText(summary)) {
        yield { type: "token", data: { nodeId: block.id, token } };
        await delay(12);
      }
      yield { type: "node_completed", data: { id: block.id, ok: true, artifact: block.artifact } };
      index += 1;
    }

    for (const message of graphResult.logs) {
      yield { type: "log", data: { level: "info", message } };
    }

    yield { type: "run_completed", data: runResult };
  }
}
