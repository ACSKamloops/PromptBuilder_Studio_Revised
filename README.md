# Prompt Studio (Zapier‑class Prompt Builder)

Prompt Studio is a Zapier/Make‑style workflow canvas that encodes Prompt‑Science defaults—**ground → reason → verify**—instead of ad‑hoc chat prompts. Blocks such as RAG, CoT/ToT/GoT, CoV, RSIP, Transcribe→Analyze, Hybrid Reasoning, SPOC, and HITL Approval Gates expose typed inputs/outputs, live inspectors, and run previews so every flow is citable, reproducible, and auditable.

The canonical product spec lives in `docs/Instructions for Prompt.md`. All docs, tests, and UI updates must stay in lockstep with that spec.

## Product Pillars
- **Information architecture like Zapier/Make.** Block library (triggers, LLM, control, data, HITL, tools, memory, advanced), central canvas with snap grid + React Flow, inspector tabs (Inputs, Params, Validation, Guardrails, Preview, Cost), and a streaming run console.
- **Prompt‑Science governance.** RAG treated as provenance control (citations auto‑lock), structure‑first multimodal analysis (Tables/Charts of Thought), verification nodes (CoV strict/annotate, RSIP, SPOC), Hybrid Reasoning switch, and Approval Gate tasks.
- **Typed everything.** Block schemas live in Zod, UI blueprint is generated, slot detection renders form controls, mapping DSL is deterministic, and PromptSpec export includes params/edges for replay.
- **Observability.** Streaming SSE (`run_started → node_started → token → node_completed → run_completed`), run ledger (tokens/latency/cost/citations), replay-from-node, and immutable approval decisions.

## Repo Layout
- `studio/` — Next.js 16 App Router client with React Flow canvas, DnD Kit library, shadcn/ui components, provider layer, approval inbox, run ledger, and Playwright/Vitest suites.
- `prompts/*.yaml` — Guardrailed agents (CoT, ToT, GoT, RAG, RSIP, CoV, SPOC cue, Tables, Charts, Caption assisted, provenance enforcement, etc.).
- `compositions/*.yaml` — Reference flows (Deep Research, Strategic Planning, Data Review, Long Form writing).
- `schemas/` — JSON/Zod schemas describing prompt templates, block params, and composition graphs.
- `ui/ui.blueprint.json` & `studio/src/config/uiBlueprint.json` — Generated slot → control hints (driven by schemas via `npm run gen:blueprint`).
- `docs/Instructions for Prompt.md` — Master Zapier‑class spec.
- `AGENTS.md` — Live catalog of blocks/agents derived from prompts + built‑ins.
- `reproducibility/` — Protocol + manifests for Prompt‑Science evaluations.

## Run It Locally
```bash
cd prompt-builder/studio
npm install
npx playwright install --with-deps   # one time
npm run dev
```

Visit `http://127.0.0.1:3000` (or your chosen local domain) to interact with the studio. The Deep Research preset loads first; use the flow picker to switch compositions. For production preview run `npm run build && npm run start`.

## Key Capabilities
- React Flow canvas with snap/grid persistence, multi-select delete, edge inspectors, node context menu, rename overlay, and drag overlay showing real cards.
- Slot inspector that reads YAML, generates controls, renders prompt preview (Handlebars + mapping DSL), enforces guardrails (citations lock when RAG upstream, refusal policy selector, approval defaults).
- Mapping expression DSL (`coalesce`, `join`, `upper/lower`, `pick`, `sum`, `formatDate`, etc.) shared between data pills and conditional sections.
- Provider layer with SSE run preview (mock adapter today), run ledger UI, cost/tokens tracking, and Approval inbox (`/api/approvals`) fed by `approval-gate` nodes.
- Test hooks (`window.__testCreateNode`, `__testReplaceFlow`, `__testOpenCommandPalette`, etc.) for deterministic Playwright flows.

## Quality Gates & Scripts
| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server with live React Flow canvas. |
| `npm run build && npm run start` | Production bundle + start for local hosting. |
| `npm run lint` | ESLint + TypeScript rules. |
| `npm run typecheck` | `tsc --noEmit` for both shared schemas and studio. |
| `npm run test:unit` | Vitest suite (mapping DSL, coach panel, helpers). |
| `npm run test:e2e` | Playwright regression: DnD, inspector forms, run preview, approvals, accessibility. |
| `npm run validate:prompts` | Zod/YAML validation for prompts + compositions. |
| `npm run gen:blueprint` | Rebuild UI blueprint from schemas (auto-run in dev/build/test). |

Always run `npm run typecheck`, `npm run lint`, `npm run validate:prompts`, and the relevant tests before pushing.

## Documentation Map
- `docs/Instructions for Prompt.md` — Master build spec (IA, block catalog, schemas, guardrails, roadmap).
- `AGENTS.md` — Up-to-date agent/block catalog (paths, IO, guardrails).
- `reproducibility/reproducibility_protocol.md` — Prompt‑Science runbook for grounding, structure, verification, approvals, and acceptance gates.
- `studio/README.md` — App-specific dev guide (scripts, testing focus, known issues).

## Contributing
- Keep code and docs aligned with the master spec; update `AGENTS.md` + README + reproducibility notes when adding/changing blocks.
- Include schema + prompt validation updates (`npm run validate:prompts`) and relevant tests (unit + Playwright for UX changes).
- Prefer typed adapters, deterministic DSL helpers, and observable run logs over ad-hoc logic.
- Document HITL/approval behavior when flows add or modify Approval Gate nodes so the governance story remains clear.
