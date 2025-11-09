import type { PromptSpec } from "@/lib/promptspec";
import type { JudgePanelDecision, JudgeVerdict } from "@/types/approval";
import type { RunRecord } from "@/types/run";

interface JudgeAgentConfig {
  id: string;
  name: string;
  focus: string;
  approveThreshold: number;
  flagThreshold: number;
}

const JUDGE_AGENTS: JudgeAgentConfig[] = [
  {
    id: "governance-sentinel",
    name: "Governance Sentinel",
    focus: "Safety & compliance posture",
    approveThreshold: 0.9,
    flagThreshold: 0.75,
  },
  {
    id: "quality-analyst",
    name: "Quality Analyst",
    focus: "Structure, completeness & SSR",
    approveThreshold: 0.88,
    flagThreshold: 0.78,
  },
  {
    id: "provenance-auditor",
    name: "Provenance Auditor",
    focus: "Verification & provenance",
    approveThreshold: 0.85,
    flagThreshold: 0.7,
  },
];

export function evaluateRunWithJudges(spec: PromptSpec, run: RunRecord): JudgePanelDecision {
  const approvalNodes = spec.nodes.filter((node) => node.id.split("#")[0] === "approval-gate");
  const nodeConfidences = run.manifest.blocks
    .map((block) => block.output.verifier?.confidence ?? 0)
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageConfidence =
    nodeConfidences.length > 0
      ? clamp(nodeConfidences.reduce((sum, value) => sum + value, 0) / nodeConfidences.length)
      : 0.82;
  const ssrRatio =
    run.benchmarks?.ssr?.ratio ??
    clamp(run.manifest.blocks.length / Math.max(1, run.manifest.nodeCount ?? run.manifest.blocks.length));
  const verificationRatio =
    run.benchmarks?.verificationEfficacy?.ratio ??
    (run.verification && run.verification.blocks.length > 0
      ? clamp(
          (run.verification.blocks.length - run.verification.totalInterventions) / run.verification.blocks.length,
        )
      : 0.85);

  const judges: JudgeVerdict[] = JUDGE_AGENTS.map((agent) => {
    switch (agent.id) {
      case "governance-sentinel": {
        const confidence = clamp(0.55 + ssrRatio * 0.45);
        return buildVerdict(agent, ssrRatio, confidence, `Flow executed ${(ssrRatio * 100).toFixed(1)}% of planned steps.`);
      }
      case "quality-analyst": {
        const confidence = clamp(0.5 + averageConfidence * 0.5);
        return buildVerdict(
          agent,
          averageConfidence,
          confidence,
          `Node confidence averages ${(averageConfidence * 100).toFixed(1)}%.`,
        );
      }
      case "provenance-auditor": {
        const confidence = clamp(0.6 + verificationRatio * 0.4);
        const rationaleParts = [`Verification efficacy ${(verificationRatio * 100).toFixed(1)}%`];
        if (approvalNodes.length > 0) {
          rationaleParts.push(`${approvalNodes.length} approval gate(s) in flow.`);
        }
        return buildVerdict(agent, verificationRatio, confidence, rationaleParts.join(" · "));
      }
      default: {
        return {
          agentId: agent.id,
          name: agent.name,
          focus: agent.focus,
          verdict: "flag",
          confidence: 0.5,
          rationale: "Fallback judge path",
        };
      }
    }
  });

  const aggregateConfidence = clamp(
    judges.reduce((sum, judge) => sum + judge.confidence, 0) / Math.max(1, judges.length),
  );
  const blockingJudge = judges.find((judge) => judge.verdict !== "approve");
  const autoApproved = !blockingJudge && aggregateConfidence >= 0.88;

  const evaluationSummary = autoApproved
    ? "Automated judge network approved the run with high confidence."
    : blockingJudge
    ? `${blockingJudge.name} flagged the run (${blockingJudge.focus.toLowerCase()}).`
    : "Judges require human confirmation due to confidence threshold.";

  const escalationReason = autoApproved
    ? undefined
    : blockingJudge
    ? `${blockingJudge.name} verdict: ${blockingJudge.verdict}`
    : "Panel confidence below auto-approval threshold.";

  return {
    autoApproved,
    aggregateConfidence,
    evaluationSummary,
    escalationReason,
    judges,
  };
}

function buildVerdict(
  agent: JudgeAgentConfig,
  ratio: number,
  confidence: number,
  rationale: string,
): JudgeVerdict {
  const verdict = decideVerdict(ratio, agent.approveThreshold, agent.flagThreshold);
  return {
    agentId: agent.id,
    name: agent.name,
    focus: agent.focus,
    verdict,
    confidence,
    rationale,
  };
}

function decideVerdict(value: number, approveThreshold: number, flagThreshold: number): JudgeVerdict["verdict"] {
  if (value >= approveThreshold) return "approve";
  if (value >= flagThreshold) return "flag";
  return "reject";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.99, Math.max(0.01, Number(value.toFixed(3))));
}
