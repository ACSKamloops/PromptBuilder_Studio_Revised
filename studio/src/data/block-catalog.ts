export type BlockCategory =
  | "Mandate"
  | "Grounding"
  | "Verification"
  | "Structure"
  | "Strategy"
  | "Output"
  | "Evaluation"
  | string;

import type { ModalityRequirement } from "@/types/prompt-metadata";

export interface BlockDescriptor {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;
  status: "available" | "planned";
  metadataId?: string;
  references?: string[];
  modalities?: ModalityRequirement[];
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
      "Launch controlled perturbation batches, capture per-run metrics, and score prompt stability.",
    status: "available",
    metadataId: "psa-sweep",
    references: ["prompts/prompt-sensitivity-analysis.yaml"],
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
