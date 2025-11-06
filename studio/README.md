# Prompt Builder Studio

Modern React studio for composing research-grade prompt flows with draggable blocks, slot-aware inspector forms, PromptSpec exports, and a LangGraph-backed run preview. The app reads YAML agents from `../prompts` and `../compositions`, so you can teach prompt strategy, verification, and reproducibility directly in the UI.

## Getting started

```bash
# inside prompt-builder/studio
npm install
npx playwright install --with-deps   # first time only (installs Playwright browsers)
npm run dev
```

Visit `http://127.0.0.1:3000` to explore the studio. The baseline “Deep Research” flow loads automatically; the flow picker also exposes YAML-driven compositions such as Long-Form Writing, Data Review, and Strategic Planning.

## Key features

- React Flow canvas with Elk-based auto-layout and local storage persistence for node params and positions.
- Slot inspector that renders controls per `ui/ui.blueprint.json`, complete with rendering hints, prompt previews (Handlebars templating), PromptSpec JSON, and a coach panel summarising “when to use” and failure modes.
- LangGraph stub runtime (`/api/run`) that converts PromptSpec into block-by-block manifests so we can wire a real graph executor later.
- YAML loaders validate prompts and compositions against `schemas/prompt_template.schema.json` before exposing them to the UI.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js with the webpack dev server (used by Playwright tests too). |
| `npm run build` | Production build; surfaces TS errors and bundler warnings. Expect a harmless workspace-root warning while multiple lockfiles exist. |
| `npm run start` | Serve the compiled build. |
| `npm run lint` | ESLint across `src/`. |
| `npm run test:unit` | Vitest suite (coach panel + flow recommendations). |
| `npm run test:e2e` | Playwright E2E flows (canvas, inspector, run preview). Use `-- --reporter=line` in CI for concise logs. |
| `npm run validate:prompts` | Schema validation for every YAML prompt and composition. |

## Testing expectations

- Run `npm run lint`, `npm run test:unit`, `npm run test:e2e -- --reporter=line`, and `npm run validate:prompts` before handoff.
- The Playwright suite relies on `data-testid` hooks (`flow-select`, `slot-*`, `prompt-preview`) added throughout the inspector; keep those stable when iterating.
- If browsers are missing, rerun `npx playwright install --with-deps`.

## Prompt assets & docs

- Agents and compositions live at repository root (`../prompts`, `../compositions`). Each YAML file includes slots, guardrails, and evaluation notes surfaced in the inspector and coach panels.
- `../AGENTS.md` describes the current catalog, playing nicely with the UI.
- `../docs` and `../reproducibility` outline research rationale and evaluation protocols that feed coach guidance and LangGraph manifest copies.

## Known build warnings

- Next.js emits a “workspace root” warning because there is also a `package-lock.json` at `/home/astra`. Harmless for now; consider setting `outputFileTracingRoot` once the repo structure settles.

## Next hacks

- Replace the LangGraph stub in `src/lib/runtime/langgraph-runner.ts` with a real runnable graph once the orchestration backend is ready.
- Extend Playwright coverage with drag-and-drop rearrangements and multi-block flows as new features land.
