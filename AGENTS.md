# Prompt Studio Agents Catalog (Zapier‑class)

The Studio’s block library mirrors Zapier/Make but encodes Prompt‑Science defaults: ground → reason → verify with transparent provenance. This catalog is the single source of truth for every reusable agent (prompt YAML, schema-driven built‑in, HITL step, or advanced control block). Keep it in sync with `docs/Instructions for Prompt.md`.

## Reading Guide
- **Block** — Human‑friendly name + block id (or YAML file) used in `blockCatalog`.
- **Purpose** — Why this block exists; governance/default posture.
- **IO** — Typed payloads that pass across edges.
- **Guardrails / Params** — Defaults (citations, refusal policy, SLAs, retries, etc.).

## Trigger & Control Blocks
- **Manual Trigger** *(built‑in `trigger.manual`)*  
  Purpose: ad‑hoc “Run” button. IO: `void → { startedAt }`. Guardrails: none.
- **Webhook Trigger** *(built‑in `trigger.webhook`)*  
  Purpose: ingest external webhooks. IO: `{ headers, body, query }`. Guardrails: HMAC verification, method allowlist.
- **Schedule Trigger** *(built‑in `trigger.schedule`)*  
  Purpose: cron/interval launches. IO: `{ timestamp, scheduleId }`. Guardrails: timezone + cron validation.
- **Router / Branch** *(built‑in `control.router`)*  
  Purpose: rule/score based pathing. IO: `{ payload } → branch`. Guardrails: expression sandbox.
- **Loop / Map** *(built‑in `control.loop`)*  
  Purpose: iterate arrays with concurrency + error policy.
- **Parallel / Join** *(built‑in `control.parallel`)*  
  Purpose: Graph-of-Thought style branching + merge policy (rank+merge, vote, concat).
- **Retry / Timeout** *(built‑in `control.retry`)*  
  Purpose: wrap downstream nodes with timeout/backoff.

## Grounding, Memory & Retrieval
- **RAG Retriever** — `prompts/rag-grounded.yaml` / block id `rag-retriever`  
  Purpose: treat RAG as governance; citations forced downstream. IO: `{ query } → { context[], query }`. Params: sources[], topK, chunk size/overlap, citation style, sample query/context.
- **GraphRAG / Knowledge Graph** — block id `graphrag` (planned)  
  Purpose: persistent knowledge graph with cited paths. IO: `{ query } → { answers, paths[] }`.
- **Knowledge Journal** — `prompts/thinking-journal.yaml`  
  Purpose: persist facts / claims for reuse. IO: `{ entry } → { updates, table }`.
- **KV Store & Session Memory** *(built‑ins `memory.kv`, `memory.session`)*  
  Purpose: lightweight state, feature flags, conversational memory with PII policies.

## Core Reasoning Blocks
- **Chain of Thought (CoT)** — `prompts/chain-of-thought.yaml`  
  IO: `{ task, show_work } → { text }`.
- **Tree of Thought (ToT)** — `prompts/tree-of-thought.yaml`  
  IO: `{ question } → { candidates[], best }`.
- **Graph of Thought (GoT)** — `prompts/graph-of-thought.yaml`  
  IO: `{ question } → { graph, synthesis }`.
- **Panel of Experts (MPS)** — `prompts/panel-of-experts-tot.yaml`  
  IO: `{ topic, personas[] } → { summary, rationale }`.
- **Multi-Perspective Simulation (MPSim)** — `prompts/multi-perspective-simulation.yaml`  
  IO: `{ scenario } → { viewpoints[], synthesis }`.
- **Context Aware Decomposition / CAD** — `prompts/context-aware-decomposition.yaml`  
  IO: `{ mandate } → `{ plan, tasks[] }`.

## Verification, Refinement & Hybrid Thinking
- **Chain of Verification (CoV)** — `prompts/chain-of-verification.yaml` / block id `cov`  
  IO: `{ draft, context? } → { final, verifications[], usage }`. Guardrails: `policy=strict` default, `maxQuestions=7`.
- **CoV over RAG** — `prompts/cov-over-rag.yaml`  
  IO: `{ draft, citations } → { corrected, verdicts[] }`.
- **Recursive Self‑Improvement (RSIP)** — `prompts/recursive-self-improvement.yaml` / block id `rsip` (planned)  
  IO: `{ draft, criteria[] } → { improved, notes }`.
- **SPOC Self‑Check** — `prompts/spoc-cue.yaml` / block id `spoc` (planned)  
  IO: `{ prompt } → { prompt_with_cue }`.
- **Self‑Consistency** — `prompts/self-consistency.yaml`  
  IO: `{ prompt } → { samples[], winner }`.
- **Hybrid Reasoning Switch** *(built‑in `reason.hybrid`, planned)*  
  IO: `{ question } → fast or deliberate branch. Params: complexity gate, token/latency budgets, fallback (cot/tot/spoc).*

## Structure‑First & Multimodal Blocks
- **Thinking with Tables** — `prompts/thinking-with-tables.yaml` / block id `table-formatter`  
  IO: `{ text } → { table }`. Guardrails: downstream prompt must cite table rows/columns.
- **Charts of Thought** — `prompts/charts-of-thought.yaml`  
  IO: `{ image } → { table }`. Guardrails: require axis labels + totals validation.
- **Data Analysis Review** — `prompts/data-analysis-review.yaml`  
  IO: `{ dataset, question } → { findings, acceptance }`.
- **Caption-Assisted Reasoning** — `prompts/caption-assisted-reasoning.yaml`  
  IO: `{ image } → { text }`.
- **Spell-Out Adjacency List** — `prompts/spell-out-adjacency-list.yaml`  
  IO: `{ text } → { graph }` for Graph-of-Thought scaffolding.

## Governance, Safety & HITL
- **Approval Gate** — block id `approval-gate`  
  Purpose: HITL review. IO: `{ proposal } → waits for `{ approved, notes }`. Params: `approval_assignees[]`, `approval_slaHours`, `approval_autoApprove`, `approval_notes`. Surfaced via `/api/approvals` inbox.
- **Provenance Enforcement** — `prompts/provenance-enforcement.yaml`  
  Purpose: ensure every claim cites a grounded source.
- **Safety & Bias Audit** — `prompts/safety-bias-audit.yaml`  
  Purpose: checklist before releasing regulated content.
- **Output Schema Enforcement** — `prompts/output-schema-enforcement.yaml`  
  Purpose: JSON schema validation (errors trigger re-run or refusal).
- **Controlled Hallucination / CHI** — `prompts/controlled-hallucination.yaml`  
  Purpose: label speculative content explicitly.
- **Thinking Journal / Memory Summaries** — `prompts/thinking-journal.yaml`  
  Purpose: log facts + provenance for audits.

## Reference Compositions
- **Deep Research (RAG + CoV)** — `compositions/deep_research.yaml`  
  Flow: Mandate → Task → RAG → Exclusion Check → CoV → Table Formatter.
- **Long-Form Writing (CAD + RSIP)** — `compositions/long_form_writing.yaml`.
- **Data Review (Thinking with Tables)** — `compositions/data_review.yaml`.
- **Strategic Planning (ToT + MPS + CHI)** — `compositions/strategic_planning.yaml`.

## Studio & Testing Notes
- Canvas exposes `window.__testCreateNode`, `__testReplaceFlow`, `__testOpenCommandPalette`, `__testOpenNodeMenu`, `__testGetExtraIds` for deterministic Playwright runs.
- Mapping DSL helpers: `coalesce`, `join`, `upper/lower`, `pick`, `sum`, `formatDate`, plus `{{#if ...}}` using the same evaluator.
- Prompt nodes auto-lock “Require citations” when RAG/GraphRAG context flows in. Refusal policy selector = `off | regulated-only | always`.
- Approval inbox lives at `/api/approvals`; tests can stub tasks via `window.__testShowToolbarFor`.
- When adding a new block:
  1. Create/validate its YAML under `prompts/` (or add built‑in schema to `schemas/node.ts` + `blockCatalog`).
  2. Regenerate the UI blueprint (`npm run gen:blueprint`).
  3. Document it here (purpose, IO, guardrails).
  4. Add an example flow and end‑to‑end test.
