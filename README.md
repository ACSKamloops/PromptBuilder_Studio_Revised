# Prompt Builder

A modern, educational prompt design workspace that teaches **reasoning architectures**, **grounding**, and **verification** through an interactive, drag-and-drop builder. The project pairs a production-ready library of prompt blueprints with a forthcoming React-based UI so teams can compose, remix, and document prompt “agents” with confidence.

## Vision
- Build a visual playground where practitioners learn prompt strategy by exploring modular templates.
- Offer workflow scaffolding for chaining prompts into reusable playbooks.
- Surface reproducibility guardrails (schemas, evaluation rubrics) alongside creative tooling.

## Library at a Glance
- `prompts/*.yaml` — 24 battle-tested templates (CoT, ToT, GoT, RAG, RSIP, CoV, SPOC, Charts-of-Thought, SoAL, Tables, Caption-Assisted, CAD, MPS, CHI, and more).
- `compositions/*.yaml` — 4 composable pipelines that chain complementary templates (Deep Research, Long-Form Writing, Data Review, Strategic Planning).
- `schemas/prompt_template.schema.json` — JSON schema describing the slot/metadata contract.
- `ui/ui.blueprint.json` — initial mapping of slot types to UI controls and hints for renderers.
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

## Contributing
The repository is prepped for a greenfield React/TypeScript client. Contributions that add schema-aware components, data loaders, or reproducibility utilities are welcome. Please coordinate major architectural changes with project maintainers.

---

**Note:** The prompt assets remain model-agnostic. Adjust `system` instructions and params per target model/version as you integrate into the UI.
