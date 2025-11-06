# Prompt Agents Catalog

This catalog helps you navigate the reusable “agents” that power the Prompt Builder. Each agent is a structured prompt template with defined slots, model defaults, and guardrails for use in the visual editor or programmatic pipelines. Use it as a reference when teaching prompt strategy, assembling new workflows, and wiring research-backed combinations into the drag-and-drop studio. In the UI, these agents surface inside a polished React Flow canvas, shadcn/ui panel system, and command palette so they feel modern and approachable.

## How to Read
- **Path** — Location of the YAML asset.
- **Focus** — Core skill the agent reinforces inside the learning experience.
- **Highlights** — What makes the agent distinct or how it complements others.

## Core Reasoning Strategies
- **Chain of Thought (CoT)** — `prompts/chain-of-thought.yaml`  
  Focus: Transparent reasoning. Highlights: Minimal slots, optional “show work” toggle, pairs well with verification agents.
- **Tree of Thought (ToT)** — `prompts/tree-of-thought.yaml`  
  Focus: Branch-and-evaluate reasoning. Highlights: Encourages multiple candidate paths before converging.
- **Graph of Thought (GoT)** — `prompts/graph-of-thought.yaml`  
  Focus: Networked idea exploration. Highlights: Propose–Critique–Synthesize loop for complex ideation.
- **Panel of Experts (Single-Prompt ToT)** — `prompts/panel-of-experts-tot.yaml`  
  Focus: Simulated debate. Highlights: Slot-driven expert personas with built-in consolidation step.

## Verification & Self-Correction
- **Chain of Verification (CoV)** — `prompts/chain-of-verification.yaml`  
  Focus: Post-generation audit. Highlights: Draft → Plan → Execute → Finalize scaffold.
- **Recursive Self-Improvement (RSIP)** — `prompts/recursive-self-improvement.yaml`  
  Focus: Iterative refinement. Highlights: Generate–Evaluate–Improve loop with acceptance criteria.
- **Self-Consistency** — `prompts/self-consistency.yaml`  
  Focus: Sampling and majority vote. Highlights: Multiple candidate generations followed by tally instructions.
- **Spontaneous Self-Correction (SPOC) Cue** — `prompts/spoc-cue.yaml`  
  Focus: Lightweight sanity checks. Highlights: Drop-in cue to reduce quick hallucinations.
- **CoV over RAG** — `prompts/cov-over-rag.yaml`  
  Focus: Verifying retrieved claims. Highlights: Works directly on retrieved passages for factual QA.

## Knowledge Grounding & Memory
- **Retrieval-Augmented Generation (RAG)** — `prompts/rag-grounded.yaml`  
  Focus: Context-bound answers. Highlights: Slots for retrieved evidence and grounding instructions.
- **Thinking Journal (KGoT-inspired)** — `prompts/thinking-journal.yaml`  
  Focus: Persistent facts tracking. Highlights: Table-friendly schema for longitudinal analysis.
- **Context-Aware Decomposition (CAD)** — `prompts/context-aware-decomposition.yaml`  
  Focus: Breaking down long-form writing. Highlights: Sequential sections with guardrails for tone/voice.

## Multimodal & Data Reasoning
- **Caption-Assisted Reasoning** — `prompts/caption-assisted-reasoning.yaml`  
  Focus: Interpreting complex visuals. Highlights: Slots for OCR, captioning hooks, and reasoning prompts.
- **Charts of Thought** — `prompts/charts-of-thought.yaml`  
  Focus: Table/figure analysis. Highlights: Transcribe → Verify → Analyze pipeline encoded in a single template.
- **Thinking with Tables** — `prompts/thinking-with-tables.yaml`  
  Focus: Structured numerical reasoning. Highlights: Enforces extraction before analysis.
- **Spell-out Adjacency List (SoAL)** — `prompts/spell-out-adjacency-list.yaml`  
  Focus: Diagram-to-text translation. Highlights: Helps translate graphs into narrative form.
- **Data Analysis & Review** — `prompts/data-analysis-review.yaml`  
  Focus: Summarizing data sets. Highlights: Blends trend spotting, anomalies, and verification checks.

## Ideation & Strategic Planning
- **Controlled Hallucination for Ideation (CHI)** — `prompts/controlled-hallucination.yaml`  
  Focus: Safe creativity. Highlights: Guardrails for divergent thinking without losing traceability.
- **Multi-Perspective Simulation (MPS)** — `prompts/multi-perspective-simulation.yaml`  
  Focus: Scenario planning. Highlights: Multiple personas with aggregation guidance.
- **Strategic Planning Pipeline** — `prompts/strategic-planning-pipeline.yaml`  
  Focus: Strategy sprints. Highlights: Chains ToT, MPS, and CHI inside a single prompt.
- **Strategic Planning Composition** — `compositions/strategic_planning.yaml`  
  Focus: Multi-step orchestration. Highlights: Explicit flow for research, ideation, and alignment.

## Governance, Safety & Compliance
- **Provenance & Citation Enforcement** — `prompts/provenance-enforcement.yaml`  
  Focus: Source tracking. Highlights: Enforces citation fields and evidence statements.
- **Safety & Bias Audit** — `prompts/safety-bias-audit.yaml`  
  Focus: Risk review. Highlights: Structured checklist for fairness, safety, and mitigation steps.
- **Output Schema Enforcement** — `prompts/output-schema-enforcement.yaml`  
  Focus: JSON contract adherence. Highlights: Schema slot plus validation guidance.

> **Planned extensions:** GraphRAG retrieval blocks, SPOC single-pass verification profiles, PSA/Eval harness nodes, and UI-specific wrappers (canvas nodes, inspector forms, command palette actions) will join the catalog as the React app scaffolding lands. Their documentation will live alongside these agents for consistency.

## Ready-Made Compositions
- **Deep Research** — `compositions/deep_research.yaml`  
  Chains RAG grounding with verification passes for rigorous reports.
- **Long-Form Writing** — `compositions/long_form_writing.yaml`  
  Couples CAD with RSIP to draft, critique, and refine essays or briefs.
- **Data Review** — `compositions/data_review.yaml`  
  Walks through table/figure extraction, analysis, and cross-verification.

## Supporting Assets
- **Schema** — `schemas/prompt_template.schema.json` keeps agent metadata consistent inside the builder.
- **UI Blueprint** — `ui/ui.blueprint.json` suggests control types, educational hints, and export targets.
- **Reproducibility Protocol** — `reproducibility/*` ties each agent back to evaluation and logging practices.

Use this map when designing the drag-and-drop experience: each agent becomes a node with defined inputs/outputs, while compositions showcase the higher-order flows learners can explore and remix.


**Runtime & UI Notes**
- LangGraph-backed run preview surfaces guidance, failure modes, acceptance criteria, and params for each agent.
- The Inspector Coach panel pulls `when_to_use`, `failure_modes`, `combines_with`, and composition steps directly from these YAML definitions.

## Studio & Testing Notes
- Friendly labels: the Block Library uses plain-English names (e.g., "Role & Rules", "Your Task", "Use Your Sources (RAG)", "Avoid Duplicates", "Verify Facts", "Make a Table"). Keep these stable for a non-expert audience.
- Drag & Drop: HTML5 DnD from the Block Library onto the React Flow canvas creates extra nodes. In tests, a deterministic helper `window.__testCreateNode(baseId, x, y)` is exposed to create nodes when native DnD is flaky.
- Edges: Nodes expose left/right handles; connecting them emits a user edge that appears in the compiled PromptSpec and the header edge count.
- Save/Load: Use the Flow dialog to export/import a snapshot (`{ presetId, extras, edges }`). Tests also use `window.__testReplaceFlow(snapshot)` to reconstruct graphs.
- Selectors: E2E hooks are stable and documented:
  - Block cards: `data-testid="block-card-<blockId>"`
  - Flow select: `data-testid="flow-select"`
  - Node cards: `data-testid="flow-node-<id>"`, with `data-node-baseid` and `data-node-instance` attributes
  - Prompt preview: `data-testid="prompt-preview"`
- Commands:
  - Dev: `cd studio && npm run dev`
  - Unit: `npm run test:unit`
  - E2E: `npx playwright install --with-deps && npm run test:e2e -- --reporter=line`
  - Build/Start: `npm run build && npm run start`
