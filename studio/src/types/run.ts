import type { LangGraphRunBlock, LangGraphVerificationSummary } from "@/lib/runtime/langgraph-runner";
import type { PromptSpec } from "@/lib/promptspec";
import type { HybridDecisionTelemetry } from "@/lib/runtime/hybrid-controller";

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
  complexityScore: number;
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
  gatingDecisions?: HybridDecisionTelemetry[];
  message: string;
}
