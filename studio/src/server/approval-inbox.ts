import type { PromptSpec } from "@/lib/promptspec";
import type { ProviderRunResult } from "@/server/providers";
import { evaluateRunWithJudges } from "@/server/judge-network";
import type { ApprovalTask } from "@/types/approval";

const tasks: ApprovalTask[] = [];

export function enqueueApprovals(spec: PromptSpec, run: ProviderRunResult) {
  const judgeDecision = evaluateRunWithJudges(spec, run);
  const approvalNodes = spec.nodes.filter((node) => node.id.split("#")[0] === "approval-gate");
  for (const node of approvalNodes) {
    const params = node.params ?? {};
    const assignees = Array.isArray(params.approval_assignees)
      ? (params.approval_assignees as string[]).filter(Boolean)
      : [];
    const slaHours = typeof params.approval_slaHours === "number" ? params.approval_slaHours : 0;
    const manualAutoApprove = Boolean(params.approval_autoApprove);
    const autoApproved = judgeDecision.autoApproved || manualAutoApprove;
    const manualNotes = typeof params.approval_notes === "string" ? params.approval_notes : undefined;
    const submittedAt = new Date().toISOString();
    const resolutionTimestamp = autoApproved ? new Date().toISOString() : undefined;
    const escalationReason = judgeDecision.escalationReason;
    const notes = manualNotes ?? (autoApproved ? undefined : judgeDecision.evaluationSummary);
    const task: ApprovalTask = {
      id: `${run.runId}-${node.id}`,
      runId: run.runId,
      nodeId: node.id,
      label: node.block,
      assignees,
      slaHours,
      autoApprove: autoApproved,
      notes,
      status: autoApproved ? "approved" : "pending",
      submittedAt,
      resolvedAt: resolutionTimestamp,
      decision: autoApproved ? "Approved by automated judge panel" : undefined,
      judges: judgeDecision.judges,
      aggregateConfidence: judgeDecision.aggregateConfidence,
      evaluationSummary: judgeDecision.evaluationSummary,
      escalated: !autoApproved,
      escalationReason,
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
  task.escalated = false;
}
