# Prompt Builder Studio

Modern React Flow + Next.js 16 studio for composing Zapier-class prompt flows with typed agents, snap-to-grid canvas, slot-aware inspectors, run ledger, and a LangGraph-backed streaming preview. The UI reads YAML agents from `../prompts` + `../compositions` and aligns with the master spec in `../docs/Instructions for Prompt.md`.

## Getting started

```bash
# inside prompt-builder/studio
npm install
npx playwright install --with-deps   # first time only (installs Playwright browsers)
npm run dev
```

Visit `http://127.0.0.1:3000` to explore the studio. The baseline “Deep Research” flow loads automatically; the flow picker also exposes YAML-driven compositions such as Long-Form Writing, Data Review, and Strategic Planning.

## Key features

- React Flow canvas with grid snapping, marquee selection, multi-select delete, node context menu (duplicate / rename / delete), and DnD Kit drag overlay that mirrors the actual card.
- Slot inspector renders controls from the generated UI blueprint, surfaces prompt preview (Handlebars + mapping-expression DSL), guardrail toggles (citations lock, refusal policy, approval defaults), and Coach hints (when_to_use, failure_modes, acceptance_criteria).
- Run preview API layer (`/api/run` + `/api/run/stream`) with mock provider, SSE streaming, run ledger (tokens/latency/cost), recent run history, and Approval inbox (`/api/approvals`) fed by `approval-gate` nodes.
- RAG inspector UX: sources table, chunk/overlap sliders, citation style, sample query/context fields, and auto-lock behavior enforced in prompts downstream.
- HITL Approval Gate UI: inspector controls for assignees/SLA/auto-approve/notes, badge on canvas toolbar, inbox dialog for approve/reject.
- YAML loaders + Zod schemas validate prompts/compositions before rendering; `npm run validate:prompts` runs in CI and locally.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server (also used inside Playwright). |
| `npm run build` | Production build + type/lint gate. |
| `npm run start` | Serve compiled build (use for local hosting previews). |
| `npm run lint` | ESLint + TypeScript rules. |
| `npm run typecheck` | `tsc --noEmit` for the studio workspace. |
| `npm run test:unit` | Vitest suite (mapping DSL, coach panel, helpers). |
| `npm run test:e2e` | Playwright DnD/inspector/run-preview/approvals regression (install browsers once). |
| `npm run validate:prompts` | YAML validation (prompts + compositions). |
| `npm run gen:blueprint` | Build `src/config/uiBlueprint.json` from schemas (auto-run in dev/build/test). |

## Testing expectations

- Always run `npm run typecheck && npm run lint && npm run validate:prompts` before any test suite.
- Playwright specs rely on helpers (`window.__testCreateNode`, `__testReplaceFlow`, `__testOpenCommandPalette`, `__testShowToolbarFor`, `__testGetExtraIds`) and stable `data-testid`s (`flow-select`, `slot-*`, `prompt-preview`, `approvals-button`); update tests when selectors change.
- Approval inbox interactions, command palette, quick-insert drawers, and responsive panels all have coverage—keep hooks wired when editing UI.
- Missing browsers? `npx playwright install --with-deps`.

## Prompt assets & docs

- Agents/compositions (`../prompts`, `../compositions`) are validated by `npm run validate:prompts` and rendered via the UI blueprint.
- `../AGENTS.md` + `../docs/Instructions for Prompt.md` describe the canonical block catalog and governance defaults.
- `../reproducibility/` contains the Prompt‑Science protocol—update it when run ledger, approval, or verification behavior changes.

## Known build warnings

- Next.js may warn about multiple lockfiles (repo root + `/home/astra`). Ignore for now or configure `outputFileTracingRoot` when the workspace stabilises.
- Streaming preview currently uses the mock provider. Swap in real adapters before shipping externally.

## Next hacks

- Bring Hybrid Reasoning + SPOC verifier blocks online once model adapters exist.
- Extend Playwright coverage for approval edge cases (auto-approve, SLA warnings) and command palette drawers.
