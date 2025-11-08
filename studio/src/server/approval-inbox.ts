import type { PromptSpec } from "@/lib/promptspec";
import type { ProviderRunResult } from "@/server/providers";
import type { ApprovalTask } from "@/types/approval";

const tasks: ApprovalTask[] = [];

export function enqueueApprovals(spec: PromptSpec, run: ProviderRunResult) {
  const approvalNodes = spec.nodes.filter((node) => node.id.split("#")[0] === "approval-gate");
  for (const node of approvalNodes) {
    const params = node.params ?? {};
    const assignees = Array.isArray(params.approval_assignees)
      ? (params.approval_assignees as string[]).filter(Boolean)
      : [];
    const slaHours = typeof params.approval_slaHours === "number" ? params.approval_slaHours : 0;
    const autoApprove = Boolean(params.approval_autoApprove);
    const notes = typeof params.approval_notes === "string" ? params.approval_notes : undefined;
    const task: ApprovalTask = {
      id: `${run.runId}-${node.id}`,
      runId: run.runId,
      nodeId: node.id,
      label: node.block,
      assignees,
      slaHours,
      autoApprove,
      notes,
      status: autoApprove ? "approved" : "pending",
      submittedAt: new Date().toISOString(),
      resolvedAt: autoApprove ? new Date().toISOString() : undefined,
      decision: autoApprove ? "Auto-approved" : undefined,
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
