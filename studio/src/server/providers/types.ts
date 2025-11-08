import type { PromptSpec } from "@/lib/promptspec";
import type { LangGraphRunResult } from "@/lib/runtime/langgraph-runner";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  costUsd: number;
  usage: TokenUsage;
  manifest: LangGraphRunResult["manifest"];
  message: string;
}

export type RunStreamEvent =
  | { type: "run_started"; data: { nodeCount: number; edgeCount: number } }
  | { type: "node_started"; data: { id: string; label: string; index: number } }
  | { type: "node_completed"; data: { id: string; ok: boolean } }
  | { type: "token"; data: { nodeId: string; token: string } }
  | { type: "log"; data: { level: "info" | "warn" | "error"; message: string } }
  | { type: "run_completed"; data: ProviderRunResult }
  | { type: "error"; error: string };

export interface LlmProvider {
  readonly name: string;
  run(spec: PromptSpec): Promise<ProviderRunResult>;
  stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent, void, unknown>;
}

