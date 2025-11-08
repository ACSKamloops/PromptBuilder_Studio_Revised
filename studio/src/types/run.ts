import type {
  BenchmarkSuite,
  CompositionSnapshot,
  LangGraphRunBlock,
  NodeArtifact,
} from "@/lib/runtime/langgraph-runner";
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
  artifacts: Record<string, NodeArtifact>;
  composition?: CompositionSnapshot;
}

export interface RunRecord {
  runId: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  costUsd: number;
  usage: TokenUsage;
  manifest: RunManifest;
  benchmarks: BenchmarkSuite;
  logs: string[];
  message: string;
}

