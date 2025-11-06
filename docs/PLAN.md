# Prompt Builder — Implementation Plan

This plan operationalises the “Prompt Foundry” blueprint: a React-based drag-and-drop studio that captures your research-backed playbooks (RAG + CoV, CAD + RSIP, Thinking with Tables, ToT + MPS) while embracing the 2025 research upgrades (GraphRAG, SPOC, Prompt Sensitivity Analysis, MCP) and a polished, modern UI stack (React Flow, shadcn/ui, dnd-kit, Monaco/TipTap, TanStack Table, Tremor/Visx).

## Product Goals
- Visual composition of reusable prompt/agent blocks with exportable PromptSpec definitions.
- Grounded, auditable execution pipelines (RAG or GraphRAG) paired with verification loops (CoV, RSIP) and optional SPOC single-pass self-checks.
- Educational UX that surfaces `when_to_use`, `failure_modes`, and `acceptance_criteria` at the point of composition.
- Quantitative prompt science baked in: PSA sweeps, auto-prompting trials, model/seed pinning, reproducible run manifests.

## Architecture Overview
- **Frontend**: Next.js (App Router) + TypeScript, React Flow for graph editing, dnd-kit for palette drag/drop, shadcn/ui + Radix for accessible components, Tailwind + Radix Colors for theming, JSON Schema- or Zod-driven forms (rjsf integration or React Hook Form + Zod), Zustand + TanStack Query for state, Monaco Editor + TipTap for prompt editing, TanStack Table for tabular outputs, Tremor/Visx for analytics visualisations, react-resizable-panels for layout, cmdk + react-hotkeys-hook for command palette & shortcuts.
- **Runtime**: LangGraph executes compiled PromptSpec graphs (supports loops for RSIP/CoV, branches for ToT, conditional SPOC paths); LlamaIndex/LangChain provide RAG + tool abstractions.
- **Retrieval Modes**: Standard RAG (vector/BM25 hybrid with citation binding) and GraphRAG (hierarchical summaries + graph queries) selectable per node.
- **Tool Bridge**: Model Context Protocol (MCP) servers expose sanctioned external tools (web search, spreadsheets, calendars) with policy controls.
- **Persistence**: Postgres + pgvector (flows, runs, embeddings), object storage for corpora, versioned prompt assets in Git; optional Qdrant/Weaviate swap-in later.
- **Observability**: Langfuse or LangSmith for traces, metrics, prompt/version diffing; Phoenix/TruLens hooks for evaluation telemetry; OpenTelemetry export for downstream SIEM.

## Data Model (Initial Cut)
- `BlockType` — `{ id, kind, schema, uiHints, defaultParams, portsIn, portsOut, coachCopy }`
- `BlockInstance` — `{ uuid, blockTypeId, params, version, position }`
- `Flow` — `{ id, name, description, nodeIds[], edges[], tags, createdBy, sourcePlaybook?, executionMode }`
- `PromptSpec` snapshot — `{ version, variables[], nodes[], edges[], metadata }`
- `Run` — `{ id, flowId, promptSpecChecksum, modelProfileId, decodingParams, seed, retrieverSnapshot, toolProfile, artifacts, covLedger, costs, timing }`
- `EvalSuite` / `EvalRun` — test definitions (promptfoo configs, PSA sweeps) and results.
- `KnowledgeDoc` — ingestion metadata (source, chunk hashes, embeddings, watermark flags).
- `ExclusionList` — normalized identifiers + alias table, audit log of overrides.

## PromptSpec v1 (Portable DSL)
- YAML/JSON graph spec with node metadata, typed ports, execution hints (`mode: classic|spoc`, `retrieval: rag|graphrag`).
- Validated against a JSON Schema derived from `schemas/prompt_template.schema.json` plus block-specific extensions.
- Compiles to LangGraph state machine and to plain chat/message artefacts for non-graph runtimes.

## Block Catalog (Wave 1)
- **Mandate & Context**: SystemMandate, UserTask, DeliverableSchema, ExclusionCheck.
- **Reasoning**: ChainOfThought, TreeOfThought, GraphOfThought, PanelOfExperts.
- **Grounding**: RAGRetriever, GraphRAGRetriever, KnowledgeJournal (KGoT).
- **Verification**: ChainOfVerification (composable stages or bundled), RecursiveSelfImprovement, SelfConsistency, SPOC (single-pass self-check).
- **Structure-first Data**: ThinkingWithTables, ChartsOfThought, SpellOutAdjacencyList, CaptionAssist, AudioTranscribe, VideoStoryboard (future).
- **Strategic Patterns**: CADPlanner, MPSPanel, ControlledHallucination, StrategicPipeline.
- **Outputs**: TableFormatter, ReportAssembler, CitationFormatter, Exporter (JSON/Markdown/Figma to come).
- **Evaluation & Robustness**: PSASweep, AutoPromptTrial, EvalHarness (promptfoo/LangSmith/Phoenix), RedTeamChecklist.

## Execution Modes
- **Classic**: RAG/GraphRAG → structured reasoning nodes → CoV/RSIP loops → outputs.
- **SPOC-enabled**: single-pass proposer+verifier prompts for models with intrinsic verification; logs trigger usage and convergence notes.
- **Hybrid**: use SPOC for quick passes, fall back to CoV for high-stakes verification.

## Milestones & Deliverables
1. **Scaffold & Library**
   - Next.js app shell with React Flow canvas, library palette, inspector rendering `BlockType` schema forms.
   - Live prompt preview panel showing compiled System/User prompts with variable interpolation.
   - Documentation linking blocks to AGENTS catalog entries.
   - PromptSpec export + run-preview dialog (wired to local dry-run API), automatic canvas layout via ELK.
   - UI blueprint-driven slot controls with contextual hints; inspector state persisted to local storage.
   - Coach panel surfaces `when_to_use`, `failure_modes`, `combines_with`, and composition steps for the currently selected block.
2. **Compile & Execute (Deep Research baseline)**
   - PromptSpec compiler → LangGraph runner.
   - Implement SystemMandate, UserTask, ExclusionCheck, RAGRetriever, ChainOfVerification, TableFormatter nodes.
   - Persist Run bundles (prompt text, params, retriever docs, CoV Q/A ledger, outputs, costs).
   - Basic MCC (minimal coach copy) referencing AGENTS metadata.
   - PromptSpec preview panel in the studio showing per-node + full-flow JSON.
   - `/api/run` returns LangGraph stub outputs; replace with full graph execution + logging.
   - Schema validation (Zod) against `prompt_template.schema.json` during YAML ingestion.
3. **Evals & Robustness**
   - Add promptfoo regression suite for Deep Research, store configs in `evaluations/`.
   - Implement PSA sweep block with visual sensitivity charts.
   - Integrate Langfuse/LangSmith tracing + run diff UI.
   - Maintain Playwright smoke tests (`npm run test:e2e`) to ensure the studio loads and inspector guidance renders.
4. **Advanced Retrieval & Cognition**
   - GraphRAG pipeline support (graph extraction, summary queries).
   - CAD + RSIP long-form flow; ThinkingWithTables, ChartsOfThought, SoAL nodes.
   - SPOC execution toggle with logging of trigger tokens + fallback behaviour.
   - MCP integrations for approved external tools.
5. **Learning, Sharing & Governance**
   - Coach panel with rule-based suggestions (driven by AGENTS `when_to_use` / `failure_modes` text).
   - Flow gallery with templated playbooks (Deep Research, Long-Form, Data Review, Strategic Planning).
   - Import/export, version diffs, reproducibility manifests, watermark/provenance reporting.

## Evaluation & Reproducibility Strategy
- **Testing**: promptfoo assertions + LLM-as-judge, Ragas for groundedness, TruLens/Phoenix feedback loops.
- **Prompt Science**: PSA sweeps (wording/shot order/temperature), AutoPrompt trials capturing leaderboard.
- **Logging**: each Run stores model version, decoding params, seed, retriever snapshot (doc IDs + hashes), tool usage, verification transcripts.
- **Re-run**: one-click reproduction loads previous bundle, optionally replays on current model via LangGraph.

## Risks & Mitigations
- *Scope creep*: freeze Milestones 1–2 before GraphRAG/SPOC; maintain feature toggles.
- *Eval drift*: pin configs, archive promptfoo baselines, audit vector store schema changes.
- *Data quality*: enforce “transcribe → analyse” nodes, integrate Unstructured pipeline for ingest normalisation.
- *Tool misuse*: MCP allow-list + guardrail policies; audit trail for tool invocations.

## Documentation Hooks
- Keep `AGENTS.md` synchronized with BlockType definitions (focus, highlights, SPOC/GraphRAG notes).
- Extend `README.md` roadmap as milestones ship.
- Store research references and rationale in `docs/research-notes.md` (to be created) for ongoing updates.

## Starter Content Integration (from prompt-library-starter.zip)
This repository embeds and extends the original starter assets. Integration plan by folder:

- `prompts/*.yaml` → BlockTypes and Inspector Forms
  - Parse with `load-prompts.ts` and validate against `schemas/prompt_template.schema.json`.
  - Map `slots` to UI via `ui/ui.blueprint.json` (slot_controls and rendering_rules), falling back to sensible defaults.
  - Use `prompt` for live Handlebars previews; expose `model_preferences` in a Model panel later.
  - Surface `when_to_use`, `failure_modes`, `acceptance_criteria` in the Coach/Inspector.

- `compositions/*.yaml` → Flow Presets
  - Convert composition recipes to `FlowPreset` seeds (nodes/edges) and expose in the gallery.
  - Honor `combines_with` in the Coach for one-click chain suggestions.

- `schemas/prompt_template.schema.json` → Validation & Types
  - Generate TS types (via `json-schema-to-ts` or Zod schema) and validate at load time and in CI.
  - Add a YAML validation script to pre-commit and CI to prevent malformed templates.

- `ui/ui.blueprint.json` → UI Contract
  - Drive control selection (TextInput/Select/MultiSelect/Switch/NumberInput) and hints in Inspector.
  - Apply `rendering_rules` to show contextual tips (e.g., citations toggle, multimodal hints, playbook graph notice).

- `reproducibility/*` → Run Manifests & Gates
  - Build Run bundles with fields specified in `reproducibility_protocol.md` (params, seed, retriever snapshot, artifacts, CoV Q/A, logs).
  - Base acceptance gates and review UI on `evaluation_rubric.json` and template `acceptance_criteria`.

### Adjusted Milestones (to integrate content)
1. Scaffold & Library (DONE)
   - YAML ingestion, Inspector, prompt preview, PromptSpec export, ELK layout.
   - NEW: Wire `ui.ui.blueprint.json` for control selection and contextual hints.

2. Compile & Execute (Deep Research baseline)
   - PromptSpec → LangGraph runner with Run bundles.
   - NEW: Validate templates against `schemas/prompt_template.schema.json` and fail fast in UI with actionable errors.
   - NEW: Import `compositions/` as selectable Flow Presets.

3. Evals & Robustness
   - Add promptfoo suites; PSA sweeps; Langfuse/LangSmith traces.
   - NEW: Render acceptance-criteria checklist and rubric scores per run; block “Publish” until criteria met.

4. Advanced Retrieval & Cognition
   - GraphRAG, CAD+RSIP, ThinkingWithTables/ChartsOfThought, SPOC, MCP.
   - NEW: Persist Run manifests per `reproducibility_protocol.md` for audits; add provenance dashboard.

5. Learning, Sharing & Governance
   - Coach-driven suggestions powered by `when_to_use`, `failure_modes`, `combines_with`.
   - NEW: YAML validator CLI and GitHub Action using the schema; gallery badges for validated templates.
