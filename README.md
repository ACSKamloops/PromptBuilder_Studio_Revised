# Prompt Studio (Zapier‑class Prompt Builder)

Modern, Zapier‑like workflow studio for prompts: drag‑and‑drop blocks (RAG, CoT/ToT/GoT, CoV, RSIP, Transcribe→Analyze, HITL) with typed inputs/outputs, persistent runs, and streaming previews. It encodes Prompt‑Science defaults—ground → reason → verify—so outcomes are citable, reproducible, and auditable.

## Vision
- Build a visual playground where practitioners learn prompt strategy by exploring modular templates.
- Offer workflow scaffolding for chaining prompts into reusable playbooks.
- Surface reproducibility guardrails (schemas, evaluation rubrics) alongside creative tooling.

## Library at a Glance
- `prompts/*.yaml` — 24 battle-tested templates (CoT, ToT, GoT, RAG, RSIP, CoV, SPOC, Charts-of-Thought, SoAL, Tables, Caption-Assisted, CAD, MPS, CHI, and more).
- `compositions/*.yaml` — 4 composable pipelines that chain complementary templates (Deep Research, Long-Form Writing, Data Review, Strategic Planning).
- `schemas/prompt_template.schema.json` — JSON schema describing the slot/metadata contract.
- `ui/ui.blueprint.json` — initial mapping of slot types to UI controls and hints for renderers (moving to generated blueprint from schemas).
- `reproducibility/*` — protocol and rubric for evaluating prompt behavior over time.

## Working with the Data
1. Parse a `prompts/*.yaml` file to render its `slots` as form inputs.
2. Interpolate `{{placeholders}}` in `prompt` with user-supplied slot values before calling a model.
3. Respect `model_preferences` to keep system prompts, default models, and params aligned.
4. Use `combines_with` to suggest follow-up templates or to chain prompts in compositions.

## Educational Angle
- Each template encodes **when to use**, **failure modes**, and **acceptance criteria** to encourage disciplined prompt trials.
- Compositions illustrate how to hand off outputs between agents and where to add verification loops.
- The UI layer will emphasize explanatory copy, onboarding walkthroughs, and example-driven defaults.

## Roadmap Themes
1. **Interactive Canvas** — React + modern drag-and-drop primitives (e.g. DnD Kit) for laying out prompt nodes, slot forms, and model execution panels.
2. **Reusable Agents** — Persist prompt instances with filled slots, link them into flows, and export/share configurations.
3. **Learning Mode** — Inline tutorials, guided labs, and reflection checklists tied to the reproducibility rubric.
4. **Verification Tooling** — Visual diffing of outputs, acceptance-criteria tracking, and structured logging hooks.

## Development Workspace
- `studio/` — Next.js + React Flow editor. From `studio/`: `npm ci && npm run dev`.
- Install Playwright with `npx playwright install --with-deps` once; E2E via `npm run test:e2e`.
- Generate the UI blueprint from typed schemas with `npm run gen:blueprint` (auto-runs on dev/build/test).
- Unit tests `npm run test:unit`, schema checks `npm run validate:prompts`, typecheck `npm run typecheck`.
- The Studio supports: YAML‑driven block metadata, slot forms, prompt previews, PromptSpec export, snapping canvas, run preview (stubbed), context menus, and a Coach panel that reads `when_to_use`, `failure_modes`, and composition steps.
- Shared assets live at repo root (`prompts/`, `compositions/`, `schemas/`). See `AGENTS.md` and `docs/Instructions for Prompt.md` for the Master Build Spec and block catalog.

## Contributing
Contributions that strengthen typed schemas (Zod), provider adapters, streaming run previews, mapping DSL, and reproducibility utilities are welcome. Please open small PRs and include tests.

---

**Note:** The prompt assets remain model-agnostic. Adjust `system` instructions and params per target model/version as you integrate into the UI.
