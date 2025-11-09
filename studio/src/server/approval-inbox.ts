import type { PromptSpec } from "@/lib/promptspec";
import type { ProviderRunResult } from "@/server/providers";
import { evaluateRunWithJudges } from "@/server/judge-network";
import type { ApprovalTask } from "@/types/approval";

const tasks: ApprovalTask[] = [];

export function enqueueApprovals(spec: PromptSpec, run: ProviderRunResult) {
  const approvalNodes = spec.nodes.filter((node) => node.id.split("#")[0] === "approval-gate");
  if (approvalNodes.length === 0) return;
  const judgeDecision = evaluateRunWithJudges(spec, run);
  for (const node of approvalNodes) {
    const params = node.params ?? {};
    const assignees = Array.isArray(params.approval_assignees)
      ? (params.approval_assignees as string[]).filter(Boolean)
      : [];
    const slaHours = typeof params.approval_slaHours === "number" ? params.approval_slaHours : 0;
    const autoApprove = Boolean(params.approval_autoApprove);
    const notes = typeof params.approval_notes === "string" ? params.approval_notes : undefined;
    const judgeSnapshot = judgeDecision.judges.map((judge) => ({ ...judge }));
    const autoByJudge = judgeDecision.autoApproved;
    const shouldAutoApprove = autoApprove || autoByJudge;
    const escalated = !autoByJudge && !autoApprove;
    const task: ApprovalTask = {
      id: `${run.runId}-${node.id}`,
      runId: run.runId,
      nodeId: node.id,
      label: node.block,
      assignees,
      slaHours,
      autoApprove,
      notes,
      status: shouldAutoApprove ? "approved" : "pending",
      submittedAt: new Date().toISOString(),
      resolvedAt: shouldAutoApprove ? new Date().toISOString() : undefined,
      decision: shouldAutoApprove
        ? autoApprove
          ? "Auto-approved via node settings"
          : "Auto-approved by judge network"
        : undefined,
      judges: judgeSnapshot,
      aggregateConfidence: judgeDecision.aggregateConfidence,
      evaluationSummary: judgeDecision.evaluationSummary,
      escalated,
      escalationReason: escalated ? judgeDecision.escalationReason : undefined,
    };
    tasks.unshift(task);
  }
}

export function listApprovals() {
  return tasks;
}

export function resolveApproval(id: string, action: "approved" | "rejected", decision?: string) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.status = action;
  task.resolvedAt = new Date().toISOString();
  task.decision = decision;
}
