import type { PromptSpec } from "@/lib/promptspec";
import type { ProviderRunResult } from "@/server/providers";
import type { JudgePanelDecision, JudgeVerdict } from "@/types/approval";

interface JudgeAgentConfig {
  id: string;
  name: string;
  focus: string;
}

const JUDGE_AGENTS: JudgeAgentConfig[] = [
  { id: "governance-sentinel", name: "Governance Sentinel", focus: "Safety & compliance posture" },
  { id: "quality-analyst", name: "Quality Analyst", focus: "Structure, completeness & SSR" },
  { id: "provenance-auditor", name: "Provenance Auditor", focus: "Verification & provenance" },
];

export function evaluateRunWithJudges(
  spec: PromptSpec,
  run: ProviderRunResult,
): JudgePanelDecision {
  const blocks = run.manifest.blocks;
  const confidences = blocks
    .map((block) => block.artifact?.metrics.confidence ?? 0)
    .filter((value) => value > 0);
  const averageConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0.85;
  const ssr = run.benchmarks?.ssr?.ratio ?? 0;
  const verification = run.benchmarks?.verificationEfficacy?.ratio ?? 0;
  const approvalNodes = spec.nodes.filter((node) => node.id.includes("approval"));

  const judges: JudgeVerdict[] = JUDGE_AGENTS.map((agent) => {
    switch (agent.id) {
      case "governance-sentinel": {
        const confidence = clamp(0.55 + ssr * 0.45);
        const verdict = decideVerdict(ssr, 0.9, 0.75);
        return {
          agentId: agent.id,
          name: agent.name,
          focus: agent.focus,
          verdict,
          confidence,
          rationale:
            verdict === "approve"
              ? `Flow executed ${Math.round(ssr * 100)}% of planned steps.`
              : `Step success rate below threshold (${Math.round(ssr * 100)}%).`,
        };
      }
      case "quality-analyst": {
        const confidence = clamp(0.5 + averageConfidence * 0.5);
        const verdict = decideVerdict(averageConfidence, 0.88, 0.8);
        return {
          agentId: agent.id,
          name: agent.name,
          focus: agent.focus,
          verdict,
          confidence,
          rationale:
            verdict === "approve"
              ? `Node confidence averages ${(averageConfidence * 100).toFixed(1)}%.`
              : "Detected nodes under confidence target; requires human assessment.",
        };
      }
      case "provenance-auditor": {
        const confidence = clamp(0.6 + verification * 0.4);
        const verdict = decideVerdict(verification, 0.85, 0.7);
        const rationaleParts = [
          `Verification efficacy ${(verification * 100).toFixed(1)}%`,
        ];
        if (approvalNodes.length > 0) {
          rationaleParts.push(`${approvalNodes.length} approval gate(s) in flow.`);
        }
        return {
          agentId: agent.id,
          name: agent.name,
          focus: agent.focus,
          verdict,
          confidence,
          rationale: rationaleParts.join(" · "),
        };
      }
      default:
        return {
          agentId: agent.id,
          name: agent.name,
          focus: agent.focus,
          verdict: "flag",
          confidence: 0.5,
          rationale: "Fallback evaluation",
        };
    }
  });

  const aggregateConfidence = Number(
    (
      judges.reduce((sum, judge) => sum + judge.confidence, 0) /
      (judges.length || 1)
    ).toFixed(3),
  );
  const nonApprove = judges.find((judge) => judge.verdict !== "approve");
  const autoApproved = !nonApprove && aggregateConfidence >= 0.88;

  const evaluationSummary = autoApproved
    ? "Automated judge network approved the run with high confidence."
    : nonApprove
    ? `${nonApprove.name} flagged the run (${nonApprove.focus.toLowerCase()}) — awaiting human decision.`
    : "Automated judge network requires human confirmation due to confidence threshold.";

  const escalationReason = autoApproved
    ? undefined
    : nonApprove
    ? `${nonApprove.name} verdict: ${nonApprove.verdict}`
    : "Panel confidence below auto-approval threshold.";

  return {
    autoApproved,
    aggregateConfidence,
    evaluationSummary,
    escalationReason,
    judges,
  };
}

function decideVerdict(value: number, approveThreshold: number, flagThreshold: number): JudgeVerdict["verdict"] {
  if (value >= approveThreshold) return "approve";
  if (value >= flagThreshold) return "flag";
  return "reject";
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.min(0.99, Math.max(0.01, Number(value.toFixed(3))));
}
