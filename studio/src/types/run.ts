import type { LangGraphRunBlock } from "@/lib/runtime/langgraph-runner";
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
}

export type RunBenchmarkTier = "baseline" | "silver" | "gold" | "experimental";

export interface RunMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
  delta?: string;
}

export interface RunBenchmark {
  id: string;
  name: string;
  score: string;
  tier?: RunBenchmarkTier;
  delta?: string;
}

export interface RunProvenanceSource {
  label: string;
  url?: string;
}

export type RunProvenanceVerdict = "ok" | "warning" | "error";

export interface RunProvenanceNode {
  nodeId: string;
  block: string;
  verdict: RunProvenanceVerdict;
  summary: string;
  sources?: RunProvenanceSource[];
}

export interface RunAnalytics {
  metrics: RunMetric[];
  benchmarks: RunBenchmark[];
  provenance: RunProvenanceNode[];
}

export interface RunRecord {
  runId: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  costUsd: number;
  usage: TokenUsage;
  manifest: RunManifest;
  message: string;
  analytics?: RunAnalytics;
}

