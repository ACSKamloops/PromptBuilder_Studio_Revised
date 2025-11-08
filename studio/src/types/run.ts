import type { LangGraphRunBlock } from "@/lib/runtime/langgraph-runner";
import type { HybridDecisionTelemetry } from "@/lib/runtime/hybrid-controller";
import type { PromptSpec } from "@/lib/promptspec";

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
  gatingDecisions: HybridDecisionTelemetry[];
  message: string;
}

