# Reproducibility Protocol

**Generated:** 2025-11-05

## Run Settings
- Model: (e.g., gpt-5-pro, gemini-pro)
- System prompt (saved verbatim)
- Temperature, top_p, max_tokens, stop
- Prompt template version and ID
- Slot values (inputs) snapshot
- Context (for RAG) snapshot with source IDs
- Random seed policy (if available)
- Post-processing steps (if any)

## Logging
- Save full prompt + model params per run
- Save intermediate artifacts (tables, adjacency lists, evidence tables)
- Save verification plans and answers

## Determinism
- Prefer temperature ≤ 0.2 for high-rigor runs
- Use self-consistency sampling only when robustness outweighs determinism; log sample count
- For compositions, freeze upstream outputs before downstream steps

## Quality Gates
- **Grounding:** All factual claims have citations or are marked 'Unknown'
- **Structure:** Transcribe → Analyze is followed (where applicable)
- **Verification:** CoV executed for critical claims
- **Ethics:** Safety/Bias audit run before publication

## Acceptance Checklist
- [ ] Outputs meet template acceptance_criteria
- [ ] No hallucinated citations
- [ ] Any contradictions resolved or flagged
- [ ] Final deliverable passes lint: format, schema (if JSON), links
