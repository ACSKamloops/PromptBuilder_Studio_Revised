export type BlockCategory =
  | "Mandate"
  | "Grounding"
  | "Verification"
  | "Structure"
  | "Strategy"
  | "Output"
  | "Evaluation"
  | string;

export interface BlockDescriptor {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;
  status: "available" | "planned";
  metadataId?: string;
  references?: string[];
}

export const blockCatalog: BlockDescriptor[] = [
  {
    id: "system-mandate",
    name: "System Mandate",
    category: "Mandate",
    description:
      "Define the analyst persona, tone, and core non-negotiables for the session.",
    status: "available",
    metadataId: "chain-of-thought",
    references: ["prompts/chain-of-thought.yaml"],
  },
  {
    id: "user-task",
    name: "User Task",
    category: "Mandate",
    description:
      "Capture the primary objective, audience, and deliverables required.",
    status: "available",
    metadataId: "deep-research-playbook",
    references: ["prompts/deep-research-playbook.yaml"],
  },
  {
    id: "exclusion-check",
    name: "Exclusion Check",
    category: "Grounding",
    description:
      "Filter candidates against the exclusion list to enforce novelty and scope guards.",
    status: "available",
    metadataId: "deep-research-playbook",
    references: ["prompts/deep-research-playbook.yaml"],
  },
  {
    id: "rag-retriever",
    name: "RAG Retriever",
    category: "Grounding",
    description:
      "Pull authoritative context from indexed corpora with citations for downstream nodes.",
    status: "available",
    metadataId: "rag-grounded",
    references: ["prompts/rag-grounded.yaml"],
  },
  {
    id: "graphrag",
    name: "GraphRAG",
    category: "Grounding",
    description:
      "Summarise and reason over knowledge graphs extracted from the corpus (planned).",
    status: "planned",
    metadataId: "graph-rag",
    references: [],
  },
  {
    id: "cov",
    name: "Chain of Verification",
    category: "Verification",
    description:
      "Draft → plan → execute → finalise verification steps for each factual claim.",
    status: "available",
    metadataId: "chain-of-verification",
    references: ["prompts/chain-of-verification.yaml"],
  },
  {
    id: "rsip",
    name: "RSIP Loop",
    category: "Verification",
    description:
      "Iterative generate → evaluate → improve loop with rotating acceptance criteria.",
    status: "planned",
    metadataId: "recursive-self-improvement",
    references: ["prompts/recursive-self-improvement.yaml"],
  },
  {
    id: "approval-gate",
    name: "Approval Gate (HITL)",
    category: "HITL",
    description: "Pause the flow and route work to human reviewers with SLAs and notes.",
    status: "available",
  },
  {
    id: "spoc",
    name: "SPOC Self-Check",
    category: "Verification",
    description:
      "Single-pass proposer+verifier execution for models with intrinsic verification (planned).",
    status: "planned",
    metadataId: "spoc-cue",
    references: ["prompts/spoc-cue.yaml"],
  },
  {
    id: "table-formatter",
    name: "Table Formatter",
    category: "Output",
    description:
      "Render structured deliverables such as funding tables with citations and rationale.",
    status: "available",
    metadataId: "thinking-with-tables",
    references: ["prompts/thinking-with-tables.yaml"],
  },
  {
    id: "psa",
    name: "Prompt Sensitivity Analysis",
    category: "Evaluation",
    description:
      "Run perturbation sweeps to measure prompt robustness (planned).",
    status: "planned",
    metadataId: "psa-sweep",
    references: [],
  },
];

export const deepResearchFlow = {
  id: "deep-research",
  name: "Deep Research (RAG + CoV)",
  description:
    "Baseline playbook: System Mandate → User Task → RAG → Exclusion Check → CoV → Table Formatter.",
  nodeIds: [
    "system-mandate",
    "user-task",
    "rag-retriever",
    "exclusion-check",
    "cov",
    "table-formatter",
  ],
};
