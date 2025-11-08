# Reproducibility Protocol

**Generated:** 2025‑11‑07  
**Scope:** Prompt Studio Zapier‑class flows (Next.js studio + PromptSpec assets)

## 1. Run Manifest (record per execution)
- Model + provider adapter (`openai:gpt-4.1-mini`, `anthropic:sonnet`, etc.).
- PromptSpec hash (nodes + params + edges + slot values) and UI blueprint version.
- LangGraph manifest ID + runId + run ledger entry (tokens, latency, cost, verifier verdict/confidence/interventions).
- RAG snapshot (queries, retrieved documents, citation IDs, chunk settings).
- Mapping DSL inputs (resolved expressions) and any JSON transforms.
- Verification evidence (CoV plan/questions/answers, RSIP passes, SPOC trace).
- Approval metadata (task id, assignees, SLA, decision, timestamp, notes).

## 2. Logging & Artifacts
1. Persist SSE stream (`run_started → node_started → token → node_completed → run_completed`).
2. Store intermediate artifacts:
   - Tables/graphs emitted by Thinking with Tables, Charts of Thought, Spell-Out Adjacency List.
   - Structured guardrail outputs (Provenance Enforcement, Output Schema Enforcement).
   - Branch traces for ToT/GoT/Hybrid switch (fast vs deliberate path).
3. Copy inspector-rendered prompt (system + template + slot interpolation) plus refusal policy + citation lock state.
4. Capture approval inbox state before/after decision (for audit).

## 3. Determinism & Hybrid Strategy
- Default temperature ≤ 0.2 for regulated modes; document overrides with justification.
- Hybrid Reasoning switch rules must be versioned (gate heuristics, budgets, fallback). Log whether run stayed on “fast” path or escalated to CoT/ToT/SPOC and why.
- When using self-consistency or RSIP >1 pass, record sample count and aggregate policy.
- Freeze upstream outputs before replaying downstream (“run from node”) to avoid non-deterministic fan-out.

## 4. Governance Gates
| Pillar | Enforcement |
| --- | --- |
| **Grounding** | For flows with RAG/GraphRAG nodes, prompt inspectors lock “Require citations”; results missing citations must route to Approval Gate or emit refusal. |
| **Structure-first** | Multimodal flows must run Thinking with Tables / Charts of Thought before free-form prompting. Audit by checking table artifacts exist. |
| **Verification** | CoV strict for research/legal/financial deliverables; annotate mode only for exploratory drafts. RSIP or SPOC required when Hybrid Switch escalates due to low confidence. |
| **HITL** | Approval Gate configured with at least one assignee + SLA for flows tagged `regulated`. Auto-approve allowed only when downstream router handles soft failures. |
| **Safety** | Safety/Bias audit and Controlled Hallucination (CHI) nodes run before hitting external channels. Provenance Enforcement ensures citation markers remain intact. |

## 5. Acceptance Checklist
- [ ] PromptSpec hash stored with run ledger entry + manifests uploaded.
- [ ] All factual statements either cite RAG context or are labeled `Unknown/Speculative`.
- [ ] Structure-first artifacts (tables/graphs) referenced explicitly in answers.
- [ ] CoV verdicts show no `fail` statuses or, if present, final output carries annotations.
- [ ] Approval Gate tasks resolved (no pending items) with decision notes captured.
- [ ] Output schema validated (JSON lint + schema enforcement) and links checked.
- [ ] Cost/latency within configured budget; Hybrid/SPOC suggestions logged if exceeded.

## 6. Troubleshooting & Escalation
- Use `window.__testReplaceFlow` to replay deterministic flows in Playwright when debugging regressions.
- If approvals backlog grows, export `/api/approvals` payload and attach to incident.
- For inconsistent RAG behavior, re-run `npm run validate:prompts` and verify source index digests before comparing outputs.
- Document any manual interventions (rerun nodes, DSL edits, blueprint tweaks) directly in the run ledger entry for auditability.
