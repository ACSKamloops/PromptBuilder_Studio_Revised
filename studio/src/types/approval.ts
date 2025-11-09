export type ApprovalTaskStatus = "pending" | "approved" | "rejected";

export type JudgeVerdictOutcome = "approve" | "flag" | "reject";

export interface JudgeVerdict {
  agentId: string;
  name: string;
  focus: string;
  verdict: JudgeVerdictOutcome;
  confidence: number;
  rationale: string;
}

export interface JudgePanelDecision {
  autoApproved: boolean;
  aggregateConfidence: number;
  evaluationSummary: string;
  escalationReason?: string;
  judges: JudgeVerdict[];
}

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
  judges: JudgeVerdict[];
  aggregateConfidence: number;
  evaluationSummary: string;
  escalated: boolean;
  escalationReason?: string;
}
