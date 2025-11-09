import type { PromptSpec } from "@/lib/promptspec";
import type { TokenUsage } from "@/types/run";

export function estimateTokenUsage(spec: PromptSpec): TokenUsage {
  const promptChars = JSON.stringify(spec.nodes).length + JSON.stringify(spec.edges).length;
  const branchPenalty = spec.edges.filter((edge) => edge.kind === "branch").length * 120;
  const completionChars = spec.nodes.length * 480 + branchPenalty;
  const promptTokens = Math.max(1, Math.round(promptChars / 4));
  const completionTokens = Math.max(1, Math.round(completionChars / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export function estimateLatencyMs(usage: TokenUsage): number {
  const latency = Math.round(usage.totalTokens * 12 + usage.promptTokens * 4);
  return Math.max(600, latency);
}

export function estimateCostUsd(usage: TokenUsage): number {
  return Number((usage.totalTokens * 0.000002).toFixed(6));
}
