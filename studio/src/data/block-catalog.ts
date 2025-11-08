export type BlockCategory =
  | "Mandate"
  | "Grounding"
  | "Reasoning"
  | "Verification"
  | "Modality"
  | "Control"
  | "Policy"
  | "HITL"
  | "Structure"
  | "Strategy"
  | "Output"
  | "Evaluation"
  | string;

import type { ModalityRequirement } from "@/types/prompt-metadata";

export type BenchmarkTier = "baseline" | "silver" | "gold" | "experimental";

export interface BlockBenchmark {
  name: string;
  score: string;
  tier?: BenchmarkTier;
  note?: string;
}

export interface BlockDescriptor {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;
  status: "available" | "planned";
  metadataId?: string;
  references?: string[];
  modalities?: ModalityRequirement[];
  guardrails?: string[];
  benchmarks?: BlockBenchmark[];
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
    guardrails: ["Auto-lock citations downstream", "Source allowlist + audit trail"],
    benchmarks: [
      {
        name: "Grounded QA",
        score: "97 (↑5 vs. baseline)",
        tier: "gold",
        note: "Open-book factual sweeps",
      },
    ],
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
    id: "chain-of-thought",
    name: "Chain of Thought",
    category: "Reasoning",
    description: "Step-by-step deliberate reasoning with optional show-your-work outputs.",
    status: "available",
    metadataId: "chain-of-thought",
    references: ["prompts/chain-of-thought.yaml"],
    guardrails: ["Honours refusal policy", "Supports forced show-work toggle"],
    benchmarks: [
      { name: "Reasoning QA", score: "89 (↑9)", tier: "baseline" },
      { name: "ARB Latency", score: "2.1s p95", tier: "silver" },
    ],
  },
  {
    id: "tree-of-thought",
    name: "Tree of Thought",
    category: "Reasoning",
    description: "Generate→evaluate branches to explore multiple solution paths before selection.",
    status: "available",
    metadataId: "tree-of-thought",
    references: ["prompts/tree-of-thought.yaml"],
    guardrails: ["Branch budgets enforced", "Voting trace persisted"],
    benchmarks: [
      { name: "GoT Bench", score: "92 (↑11)", tier: "gold" },
    ],
  },
  {
    id: "graph-of-thought",
    name: "Graph of Thought",
    category: "Reasoning",
    description: "Graph-of-thought orchestration with synthesis merge for complex investigations.",
    status: "available",
    metadataId: "graph-of-thought",
    references: ["prompts/graph-of-thought.yaml"],
    guardrails: ["Rank+merge policy", "Captures synthesis rationale"],
    benchmarks: [
      { name: "DeepResearch@xl", score: "94", tier: "gold" },
    ],
  },
  {
    id: "panel-of-experts",
    name: "Panel of Experts",
    category: "Reasoning",
    description: "Simulate expert personas, debate, and converge on a best recommendation.",
    status: "available",
    metadataId: "panel-of-experts-tot",
    references: ["prompts/panel-of-experts-tot.yaml"],
    guardrails: ["Persona briefs locked", "Consensus check required"],
    benchmarks: [
      { name: "Strategy QA", score: "88", tier: "silver" },
    ],
  },
  {
    id: "multi-perspective-simulation",
    name: "Multi-Perspective Simulation",
    category: "Reasoning",
    description: "Model diverse stakeholder viewpoints then reconcile risks and tradeoffs.",
    status: "available",
    metadataId: "multi-perspective-simulation",
    references: ["prompts/multi-perspective-simulation.yaml"],
    guardrails: ["Requires persona roster", "Flags conflicting evidence"],
    benchmarks: [
      { name: "Scenario Stress", score: "86", tier: "silver" },
    ],
  },
  {
    id: "context-aware-decomposition",
    name: "Context-Aware Decomposition",
    category: "Reasoning",
    description: "Break mandates into structured tasks with grounded context references.",
    status: "available",
    metadataId: "context-aware-decomposition",
    references: ["prompts/context-aware-decomposition.yaml"],
    guardrails: ["Enforces scope + exit criteria", "Tasks inherit grounding"],
    benchmarks: [
      { name: "Plan Quality", score: "91", tier: "gold" },
    ],
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
    guardrails: ["Strict policy default", "Audit-ready verification trace"],
    benchmarks: [
      { name: "TruthfulQA", score: "84 (↑18)", tier: "gold" },
    ],
  },
  {
    id: "cov-over-rag",
    name: "CoV over RAG",
    category: "Verification",
    description: "Cross-check grounded answers with inline citations to eliminate hallucinations.",
    status: "available",
    metadataId: "cov-over-rag",
    references: ["prompts/cov-over-rag.yaml"],
    guardrails: ["Requires citation alignment", "Escalates unresolved claims"],
    benchmarks: [
      { name: "Grounded QA", score: "95", tier: "gold" },
    ],
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
    guardrails: ["Staged acceptance checks", "Auto-stop on convergence"],
    benchmarks: [
      { name: "Self-Refine", score: "Planned", tier: "experimental" },
    ],
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
    guardrails: ["Internal watchdog corrections", "Fallback to CoV on low confidence"],
    benchmarks: [
      { name: "SPOC eval", score: "Planned", tier: "experimental" },
    ],
  },
  {
    id: "self-consistency",
    name: "Self-Consistency",
    category: "Verification",
    description: "Sample multiple completions then vote for the most consistent answer.",
    status: "available",
    metadataId: "self-consistency",
    references: ["prompts/self-consistency.yaml"],
    guardrails: ["Enforces majority vote", "Outlier tracing"],
    benchmarks: [
      { name: "Sampling QA", score: "87", tier: "silver" },
    ],
  },
  {
    id: "thinking-with-tables",
    name: "Thinking with Tables",
    category: "Modality",
    description: "Structure intermediate reasoning into auditable tables before synthesis.",
    status: "available",
    metadataId: "thinking-with-tables",
    references: ["prompts/thinking-with-tables.yaml"],
    guardrails: ["Requires downstream citation of rows", "Type-safe column definitions"],
    benchmarks: [
      { name: "Structured QA", score: "90", tier: "gold" },
    ],
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
    guardrails: ["Schema validation", "Cell-level provenance"],
  },
  {
    id: "charts-of-thought",
    name: "Charts of Thought",
    category: "Modality",
    description: "Transcribe charts and reason over quantitative visuals with validation hooks.",
    status: "available",
    metadataId: "charts-of-thought",
    references: ["prompts/charts-of-thought.yaml"],
    guardrails: ["Requires axis labels", "Totals validation"],
    benchmarks: [
      { name: "Chart QA", score: "82", tier: "silver" },
    ],
  },
  {
    id: "data-analysis-review",
    name: "Data Analysis Review",
    category: "Modality",
    description: "Peer-review quantitative findings before publication with structured checklists.",
    status: "available",
    metadataId: "data-analysis-review",
    references: ["prompts/data-analysis-review.yaml"],
    guardrails: ["Forces assumptions logging", "Highlights risky inferences"],
    benchmarks: [
      { name: "Analyst QA", score: "88", tier: "silver" },
    ],
  },
  {
    id: "caption-assisted-reasoning",
    name: "Caption-Assisted Reasoning",
    category: "Modality",
    description: "Blend image captions with textual reasoning for multimodal investigations.",
    status: "available",
    metadataId: "caption-assisted-reasoning",
    references: ["prompts/caption-assisted-reasoning.yaml"],
    guardrails: ["Citations required for visual claims", "Annotates uncertain captions"],
    benchmarks: [
      { name: "Multimodal QA", score: "79", tier: "baseline" },
    ],
  },
  {
    id: "spell-out-adjacency-list",
    name: "Spell-Out Adjacency",
    category: "Modality",
    description: "Convert text into graph adjacency lists to scaffold graph-of-thought flows.",
    status: "available",
    metadataId: "spell-out-adjacency-list",
    references: ["prompts/spell-out-adjacency-list.yaml"],
    guardrails: ["Validates node references", "Captures provenance"],
    benchmarks: [
      { name: "Graph Prep", score: "83", tier: "baseline" },
    ],
  },
  {
    id: "control-router",
    name: "Branch Router",
    category: "Control",
    description: "Route payloads across branches using score or rule-based policies.",
    status: "available",
    metadataId: "control.router",
    guardrails: ["Expression sandbox", "Default fallback branch"],
    benchmarks: [
      { name: "Routing accuracy", score: "95%", tier: "gold" },
    ],
  },
  {
    id: "control-parallel",
    name: "Parallel Join",
    category: "Control",
    description: "Fan out branches in parallel and merge using vote, rank, or concat policies.",
    status: "available",
    metadataId: "control.parallel",
    guardrails: ["Merge policy required", "Tracks branch provenance"],
    benchmarks: [
      { name: "GoT Merge", score: "p95 3.4s", tier: "silver" },
    ],
  },
  {
    id: "control-loop",
    name: "Loop / Map",
    category: "Control",
    description: "Iterate arrays with concurrency controls and error-handling policies.",
    status: "available",
    metadataId: "control.loop",
    guardrails: ["Max concurrency", "Stop-on-error toggle"],
    benchmarks: [
      { name: "Batch throughput", score: "120/min", tier: "baseline" },
    ],
  },
  {
    id: "control-retry",
    name: "Retry / Timeout",
    category: "Policy",
    description: "Wrap downstream nodes with timeout, retry, and backoff guardrails.",
    status: "available",
    metadataId: "control.retry",
    guardrails: ["Timeout budget", "Jittered backoff"],
    benchmarks: [
      { name: "Reliability uplift", score: "↑3.2%", tier: "silver" },
    ],
  },
  {
    id: "audio-timeline-ingest",
    name: "Audio Timeline Ingest",
    category: "Structure",
    description:
      "Upload voice notes or interviews, annotate key beats, and emit a structured audio timeline for downstream reasoning.",
    status: "available",
    modalities: [
      {
        modality: "audio",
        label: "Audio capture",
        description: "Provide source audio alongside annotated beats and speakers.",
        payloads: [
          {
            type: "audio_timeline",
            label: "Timeline annotations",
            description: "Markers with start/end timestamps, speaker tags, and narrative notes.",
            schema: "schema://modalities/audio-timeline",
          },
        ],
      },
    ],
  },
  {
    id: "video-event-graph",
    name: "Video Event Graph",
    category: "Structure",
    description:
      "Break a video into semantic events and link them with causal/temporal edges for reasoning blocks to traverse.",
    status: "available",
    modalities: [
      {
        modality: "video",
        label: "Video semantics",
        description: "Define shot-level or frame-level events with metadata and relationships.",
        payloads: [
          {
            type: "video_event_graph",
            label: "Event graph",
            description: "Nodes with timestamps and optional metadata connected by directed relations.",
            schema: "schema://modalities/video-event-graph",
          },
        ],
      },
    ],
  },
  {
    id: "scene-graph-builder",
    name: "Scene Graph Builder",
    category: "Structure",
    description:
      "Capture spatial relationships between actors, objects, and context for 3D or complex visual scenes.",
    status: "available",
    modalities: [
      {
        modality: "three_d",
        label: "3D layout",
        description: "Model scene nodes and labeled relationships for downstream simulation or reasoning.",
        payloads: [
          {
            type: "scene_graph",
            label: "Scene graph",
            description: "Nodes with typed attributes linked by labeled relationships (e.g. looks_at, adjacent_to).",
            schema: "schema://modalities/scene-graph",
          },
        ],
      },
    ],
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
