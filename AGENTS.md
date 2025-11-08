# Prompt Studio Agents Catalog (Zapier‑class)

This catalog is the single source of truth for reusable “agents” (blocks) that power the Studio. Each agent is a typed, documented node with schema‑driven inputs/params/outputs and guardrails aligned with Prompt‑Science pillars: ground → reason → verify.

For the master product spec, see: `docs/Instructions for Prompt.md`.

## How to Read
- **Path** — YAML asset backing the agent.
- **Purpose** — What the agent is for; governance notes if applicable.
- **IO** — Typed inputs → outputs (what edges carry between nodes).
- **Guardrails** — Defaults such as citations, refusal policy, verification.

## Core Reasoning
- **Chain of Thought (CoT)** — `prompts/chain-of-thought.yaml`
  - Purpose: Transparent reasoning; pairs with verification.
  - IO: `{task, show_work}` → `{text}`
- **Tree of Thought (ToT)** — `prompts/tree-of-thought.yaml`
  - Purpose: Explore branches before converging.
  - IO: `{question}` → `{candidates[], best}`
- **Graph of Thought (GoT)** — `prompts/graph-of-thought.yaml`
  - Purpose: Propose–Critique–Synthesize networks.
  - IO: `{question}` → `{graph, synthesis}`
- **Panel of Experts (MPS)** — `prompts/panel-of-experts-tot.yaml`
  - Purpose: Debate with personas; consolidate.
  - IO: `{topic, personas[]}` → `{summary, rationale}`

## Grounding & Memory
- **RAG Retriever** — `prompts/rag-grounded.yaml`
  - Purpose: Reduce provenance debt via citations (citations default ON when used upstream).
  - IO: `{query}` → `{context[{text,source,page?}], query}`
- **Knowledge Journal (KGoT‑inspired)** — `prompts/thinking-journal.yaml`
  - Purpose: Persist facts and claims over time.
  - IO: `{entry}` → `{updates, table}`

## Verification & Refinement
- **Chain of Verification (CoV)** — `prompts/chain-of-verification.yaml`
  - Purpose: Draft → Plan → Execute → Finalize; fewer hallucinations.
  - IO: `{draft, context?}` → `{final, verifications[], usage}`
- **Recursive Self‑Improvement (RSIP)** — `prompts/recursive-self-improvement.yaml`
  - Purpose: Generate → Critique → Improve loops by criteria.
  - IO: `{draft, criteria[]}` → `{improved, notes}`
- **Self‑Consistency** — `prompts/self-consistency.yaml`
  - Purpose: Majority vote across samples.
  - IO: `{prompt}` → `{samples[], winner}`
- **SPOC Cue** — `prompts/spoc-cue.yaml`
  - Purpose: Fast sanity check for quick passes.
  - IO: `{prompt}` → `{prompt_with_cue}`

## Structure‑First & Multimodal
- **Thinking with Tables** — `prompts/thinking-with-tables.yaml`
  - Purpose: Extract tables before analysis; constrain downstream.
  - IO: `{text}` → `{table}`
- **Charts of Thought** — `prompts/charts-of-thought.yaml`
  - Purpose: Chart → Table → Answer; references to rows/columns.
  - IO: `{image}` → `{table}`
- **Caption‑Assisted Reasoning** — `prompts/caption-assisted-reasoning.yaml`
  - Purpose: Interpret visuals with OCR/captions.
  - IO: `{image}` → `{text}`

## Governance & Safety
- **Provenance Enforcement** — `prompts/provenance-enforcement.yaml`
  - Purpose: Ensure claims carry citations.
- **Safety & Bias Audit** — `prompts/safety-bias-audit.yaml`
  - Purpose: Checklist and mitigations.
- **Output Schema Enforcement** — `prompts/output-schema-enforcement.yaml`
  - Purpose: JSON contract adherence (with schema).

## Ready‑Made Compositions
- **Deep Research (RAG + CoV)** — `compositions/deep_research.yaml`
- **Long‑Form Writing (CAD + RSIP)** — `compositions/long_form_writing.yaml`
- **Data Review (Thinking with Tables)** — `compositions/data_review.yaml`
- **Strategic Planning (ToT + MPS + CHI)** — `compositions/strategic_planning.yaml`

## Studio & Testing Notes
- DnD: drag block cards onto canvas; tests may use `window.__testCreateNode` hook.
- Edges: left/right handles; user edges appear in compiled PromptSpec.
- Save/Load: Flow dialog or `window.__testReplaceFlow(snapshot)` in tests.
- Inspectors: pull `when_to_use`, `failure_modes`, `acceptance_criteria` directly from YAML.
- Mapping DSL: placeholders/data pills support helpers like `coalesce`, `join`, `upper/lower`, `pick`, `sum`, `formatDate` for deterministic transforms.
- Commands: Dev `cd studio && npm run dev`; Unit `npm run test:unit`; E2E `npm run test:e2e` (install browsers first); Build `npm run build && npm start`.

---

This catalog is maintained alongside the Master Build Spec. When you add a new block:
1) Add/validate its YAML under `prompts/`.
2) Update the block schema (Zod) and UI form hints.
3) Regenerate the UI blueprint.
4) Add an example flow and E2E test.
