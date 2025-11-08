import type { PromptSpec } from "@/lib/promptspec";
import type { NodeArtifact } from "@/lib/runtime/langgraph-runner";
import type { RunRecord, TokenUsage } from "@/types/run";

export type { TokenUsage };

export type ProviderRunResult = RunRecord;

export type RunStreamEvent =
  | { type: "run_started"; data: { nodeCount: number; edgeCount: number } }
  | { type: "node_started"; data: { id: string; label: string; index: number } }
  | { type: "node_completed"; data: { id: string; ok: boolean; artifact?: NodeArtifact } }
  | { type: "token"; data: { nodeId: string; token: string } }
  | { type: "log"; data: { level: "info" | "warn" | "error"; message: string } }
  | { type: "run_completed"; data: ProviderRunResult }
  | { type: "error"; error: string };

export interface LlmProvider {
  readonly name: string;
  run(spec: PromptSpec): Promise<ProviderRunResult>;
  stream(spec: PromptSpec): AsyncGenerator<RunStreamEvent, void, unknown>;
}

