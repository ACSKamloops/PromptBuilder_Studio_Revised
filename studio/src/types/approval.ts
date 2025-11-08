export type ApprovalTaskStatus = "pending" | "approved" | "rejected";

export interface ApprovalTask {
  id: string;
  runId: string;
  nodeId: string;
  label: string;
  assignees: string[];
  slaHours: number;
  autoApprove: boolean;
  notes?: string;
  status: ApprovalTaskStatus;
  submittedAt: string;
  resolvedAt?: string;
  decision?: string;
}
