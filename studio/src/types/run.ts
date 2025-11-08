import type { LangGraphRunBlock } from "@/lib/runtime/langgraph-runner";
import type { PromptSpec } from "@/lib/promptspec";
import type { LangGraphVerificationSummary } from "@/lib/runtime/langgraph-runner";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RunManifest {
  flow: PromptSpec["flow"];
  nodeCount: number;
  edgeCount: number;
  blocks: LangGraphRunBlock[];
}

export interface RunRecord {
  runId: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  costUsd: number;
  usage: TokenUsage;
  manifest: RunManifest;
  verification?: LangGraphVerificationSummary;
  message: string;
}
