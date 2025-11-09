import type { PromptSpec } from "@/lib/promptspec";
import type { ExecutionMetrics } from "@/types/run-metrics";
import type { RunRecord } from "@/types/run";

export type ProviderRunResult = RunRecord;

export type RunStreamEvent =
  | { type: "run_started"; data: { nodeCount: number; edgeCount: number } }
  | { type: "node_started"; data: { id: string; label: string; index: number } }
  | { type: "node_completed"; data: { id: string; ok: boolean } }
  | { type: "token"; data: { nodeId: string; token: string } }
  | { type: "log"; data: { level: "info" | "warn" | "error"; message: string } }
  | { type: "metrics"; data: { runId: string; metrics: ExecutionMetrics } }
  | { type: "run_completed"; data: ProviderRunResult }
  | { type: "error"; error: string };

export interface LlmProvider {
  readonly name: string;
  run(spec: PromptSpec): Promise<ProviderRunResult>;
  stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent, void, unknown>;
}
