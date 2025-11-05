# Prompt Builder — Implementation Plan

## Goals
- Visual, drag-and-drop prompt composer with reusable blocks.
- Research-grade grounding + verification (RAG/GraphRAG + CoV/RSIP, optional SPOC).
- Educational UX: explain when-to-use, failure modes, acceptance criteria.
- Reproducible runs, evals (promptfoo, Ragas/TruLens), and versioning.

## Architecture
- Frontend: Next.js (App Router) + TypeScript, React Flow (canvas), shadcn/ui + Radix, rjsf or Zod-driven forms, Zustand + TanStack Query.
- Runtime: LangGraph execution maps 1:1 from canvas (nodes/edges, loops for RSIP/CoV, branches for ToT), LlamaIndex/LangChain for RAG.
- Stores: Postgres (+ pgvector) for flows/runs/embeddings; object storage for corpora.
- Observability: Langfuse/LangSmith traces; promptfoo in CI.

## Data Model (minimum viable)
- BlockType { id, kind, schema, uiHints, defaults }
- BlockInstance { id, typeId, params, version }
- Flow { id, name, nodes[], edges[], tags }
- Run { id, flowId, inputs, model, params, seed, artifacts, citations, costs }
- Dataset/KnowledgeDoc for RAG; EvalSuite/EvalRun for metrics.

## PromptSpec v1 (portable DSL)
- YAML/JSON describing nodes/edges + variables; compiled to LangGraph.
- Validate with JSON Schema; keep alignment with schemas/prompt_template.schema.json.

## Block Catalog (initial)
- SystemMandate, UserTask/Deliverables, ExclusionCheck, RAG, GraphRAG, CoV (draft/plan/execute/finalize or single), RSIP, SPOC (optional), ToT, CAD, MPS, ThinkingWithTables, ChartsOfThought, SoAL, CaptionAssist, OutputTable/Report, Exporter, PSA Sweep, Eval/RedTeam.

## Milestones
1) Scaffold & Library
- Next.js app shell + React Flow canvas; load YAML prompts to a left “Library”; inspector renders forms from schema.
- Render compiled prompt preview from a single node (System + Task) to validate interpolation.

2) Compile & Execute (Deep Research)
- Implement PromptSpec compiler → LangGraph runner.
- Nodes: SystemMandate, UserTask, RAG, ExclusionCheck, CoV, OutputTable.
- Persist Run bundles (params, prompt text, retrieved docs, CoV ledger, outputs).

3) Evals & Robustness
- Add promptfoo tests for Deep Research; basic gold cases.
- Add PSA sweep utility; chart sensitivity.
- Integrate Langfuse/LangSmith tracing.

4) Advanced Modes
- GraphRAG node + pipeline; SPOC toggle where supported.
- MPS, CAD+RSIP long-form template; ThinkingWithTables and Charts-of-Thought paths.
- MCP tool bridges for search/sheets.

5) Education & Sharing
- Coach panel (rule-based) using template metadata (when_to_use, failure_modes, combines_with).
- Export/import flows; version diffs; gallery.

## Risks & Mitigations
- Complexity creep: lock Milestones 1–2 before GraphRAG/SPOC.
- Eval drift: pin models/params/seeds; store retriever snapshots.
- Data quality: use Unstructured for ingestion; enforce “transcribe → analyze” nodes.

