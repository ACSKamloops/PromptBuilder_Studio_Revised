import type { PromptSpec, PromptSpecEdge } from "@/lib/promptspec";
import { estimateCostUsd, estimateLatencyMs, estimateTokenUsage } from "@/lib/runtime/usage";

export type HybridParams = {
  complexityGate?: string;
  budget?: { tokens?: number };
  latency?: { ms?: number };
  fallback?: string;
};

export interface HybridBranchThreshold {
  branch: string;
  thresholds: {
    maxComplexity?: number;
    maxTokens?: number;
    maxLatencyMs?: number;
  };
}

export interface HybridDecisionTelemetry {
  nodeId: string;
  nodeLabel: string;
  selectedBranch: string;
  fallback: string;
  rationale: string;
  metrics: {
    complexityScore: number;
    tokenEstimate: number;
    latencyEstimate: number;
    estimatedCostUsd: number;
    observedTokens?: number;
    observedLatencyMs?: number;
    observedCostUsd?: number;
  };
  thresholds: {
    tokenBudget: number;
    latencyBudgetMs: number;
    fastComplexity?: number;
  };
  branches: HybridBranchThreshold[];
  timestamp: string;
}

export function evaluateHybridDecision(spec: PromptSpec, nodeIndex: number): HybridDecisionTelemetry {
  const node = spec.nodes[nodeIndex];
  const params = (node?.params ?? {}) as HybridParams;
  const usage = estimateTokenUsage(spec);
  const tokenEstimate = usage.totalTokens;
  const latencyEstimate = estimateLatencyMs(usage);
  const complexityScore = computeFlowComplexity(spec);
  const estimatedCostUsd = estimateCostUsd(usage);

  const complexityGate = String(params.complexityGate ?? "auto").toLowerCase();
  const fallbackStrategy = typeof params.fallback === "string" ? params.fallback : "cot";
  const tokenBudget = typeof params.budget?.tokens === "number" ? params.budget.tokens : 2000;
  const latencyBudget = typeof params.latency?.ms === "number" ? params.latency.ms : 3000;

  const outgoingEdges = spec.edges.filter((edge) => edge.from === node.id);
  const branchEdges = outgoingEdges.filter((edge) =>
    (edge.kind ?? (edge.branch ? "branch" : "default")) !== "default" || edge.gate?.type === "reason.hybrid",
  );

  const branchSummaries = branchEdges.map((edge) => buildBranchSummary(edge));
  const fastBranch = branchSummaries.find((branch) => branch.branch.toLowerCase().includes("fast"));
  const deliberateBranch = branchSummaries.find((branch) => branch.branch.toLowerCase().includes("deliberate"));
  const fallbackBranch = branchSummaries.find((branch) => branch.branch.toLowerCase() === fallbackStrategy);

  let selectedBranch = fastBranch?.branch ?? branchSummaries[0]?.branch ?? "fast";
  const rationale: string[] = [];

  const fastComplexityThreshold =
    fastBranch?.thresholds.maxComplexity ?? Math.max(6, Math.round(spec.nodes.length * 1.2 + spec.edges.length * 0.5));
  const fastTokenThreshold = fastBranch?.thresholds.maxTokens ?? tokenBudget;
  const fastLatencyThreshold = fastBranch?.thresholds.maxLatencyMs ?? latencyBudget;

  if (complexityGate === "fast") {
    selectedBranch = fastBranch?.branch ?? selectedBranch;
    rationale.push("Complexity gate forced the fast branch.");
  } else if (complexityGate === "deliberate") {
    selectedBranch =
      deliberateBranch?.branch ?? deliberateBranchName(deliberateBranch, fallbackBranch, branchSummaries, selectedBranch);
    rationale.push("Complexity gate forced the deliberate branch.");
  } else {
    const triggers: string[] = [];
    if (complexityScore > fastComplexityThreshold) {
      triggers.push(`complexity ${complexityScore.toFixed(2)} > fast threshold ${fastComplexityThreshold}`);
    }
    if (tokenEstimate > Math.min(tokenBudget, fastTokenThreshold)) {
      triggers.push(`tokens ${tokenEstimate} > budget ${Math.min(tokenBudget, fastTokenThreshold)}`);
    }
    if (latencyEstimate > Math.min(latencyBudget, fastLatencyThreshold)) {
      triggers.push(`latency ${latencyEstimate}ms > budget ${Math.min(latencyBudget, fastLatencyThreshold)}ms`);
    }

    if (triggers.length > 0) {
      const branchName =
        deliberateBranch?.branch ?? deliberateBranchName(deliberateBranch, fallbackBranch, branchSummaries, selectedBranch);
      if (branchName) {
        selectedBranch = branchName;
        rationale.push(`Escalated to deliberate branch because ${triggers.join(", ")}.`);
      }
    } else {
      rationale.push("All heuristics within fast thresholds; staying on fast branch.");
    }
  }

  if (!branchSummaries.length) {
    rationale.push("No hybrid branches defined; defaulting to fast execution path.");
  }

  return {
    nodeId: node.id,
    nodeLabel: node.block,
    selectedBranch,
    fallback: fallbackStrategy,
    rationale: rationale.join(" "),
    metrics: {
      complexityScore,
      tokenEstimate,
      latencyEstimate,
      estimatedCostUsd,
    },
    thresholds: {
      tokenBudget,
      latencyBudgetMs: latencyBudget,
      fastComplexity: fastComplexityThreshold,
    },
    branches: branchSummaries,
    timestamp: new Date().toISOString(),
  };
}

export function computeFlowComplexity(spec: PromptSpec): number {
  const nodeScore = spec.nodes.reduce((score, node) => {
    const base = node.type ?? (node.id.includes("#") ? node.id.split("#")[0] : node.id);
    if (base.startsWith("verify")) return score + 3.2;
    if (base.includes("rag")) return score + 2.4;
    if (base.startsWith("reason")) return score + 2.1;
    if (base.startsWith("control")) return score + 1.8;
    if (base.startsWith("refine")) return score + 2.2;
    if (base.startsWith("prompt")) return score + 1.5;
    return score + 1.1;
  }, 0);
  const edgeScore = spec.edges.length * 0.35;
  return Number((nodeScore + edgeScore).toFixed(2));
}

function buildBranchSummary(edge: PromptSpecEdge): HybridBranchThreshold {
  const branchName = deriveBranchName(edge);
  return {
    branch: branchName,
    thresholds: {
      maxComplexity: edge.gate?.thresholds?.maxComplexity,
      maxTokens: edge.gate?.thresholds?.maxTokens,
      maxLatencyMs: edge.gate?.thresholds?.maxLatencyMs,
    },
  };
}

function deriveBranchName(edge: PromptSpecEdge): string {
  return edge.gate?.branch ?? edge.branch ?? edge.label ?? edge.to;
}

function deliberateBranchName(
  deliberateBranch: HybridBranchThreshold | undefined,
  fallbackBranch: HybridBranchThreshold | undefined,
  branches: HybridBranchThreshold[],
  current: string,
): string {
  if (deliberateBranch) return deliberateBranch.branch;
  if (fallbackBranch) return fallbackBranch.branch;
  const alternative = branches.find((branch) => branch.branch !== current);
  return alternative?.branch ?? current;
}
