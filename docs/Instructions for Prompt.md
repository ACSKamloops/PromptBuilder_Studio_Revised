# Zapier‑Class Prompt Studio — **Master Build Spec (Pro Mode)**

---

## 1) Product Overview

**What it is.** A drag‑and‑drop **AI workflow studio** that feels like Zapier/Make (triggers → steps → data mapping → run history) but bakes in **Prompt‑Science rigor**—grounding, structure‑before‑reasoning, and verification—so teams get **documentable, replicable, auditable** outcomes by default. The Studio exposes CoT/ToT/GoT, RAG/GraphRAG, CoV, RSIP, “Transcribe→Analyze”, and HITL as simple blocks with typed IO and fail‑fast validation.

**Who it’s for.** Analysts, researchers, ops, product, legal, RevOps, data teams—anyone who must ship **citable answers** and keep **provenance debt** low while controlling cost/latency. Default behaviors nudge novices into good practice; inspectors, schemas, and run logs satisfy power users and auditors. **Why it matters.** Prompt Science’s pillars—**ground, then reason, then verify** with visible provenance and structured intermediates—are operationalized here as a governed workflow layer, not an ad‑hoc chat. 

**Design stance.** We treat **RAG as governance** (reduce provenance risk), **structure‑first** multimodal analysis (tables before reasoning), and **verification** (CoV/RSIP or SPOC) as first‑class nodes. We add **Hybrid Reasoning** (auto think/no‑think) to balance accuracy vs. latency, with an upgrade path to **SPOC** and **GraphRAG/KGoT** as your workloads approach real‑time, agentic cognition. 

> **Why this?** These defaults encode the compendium’s HITL+ground+verify paradigm for rigorous work today while aligning with the next wave—hybrid thinking and intrinsic verification—outlined in the research agenda.

---

## 2) Information Architecture

* **Left: Block Library**

  * Categories: *Triggers, LLM, Control, Data, HITL, Tools/IO, Memory, Advanced.*
  * Hover previews show **typed inputs/outputs**, params, defaults. Drag to **Canvas**.

* **Center: Canvas**

  * Node graph with **snap‑to‑grid**. Edges carry typed payloads; connectors glow green when types are compatible.
  * Actions: drag, connect, **Test Step**, **Run from here**, **Disable node**, **Annotate**.
  * **Quick‑probe**: alt‑click an edge to preview live sample payload (“data pills”).

* **Right: Inspector**

  * Tabs: *Inputs (mapping)*, *Params*, *Validation*, *Guardrails*, *Preview*, *Cost*.
  * **Test Step** runs the node with sample data and shows outputs, tokens, citations.

* **Bottom: Run Console**

  * **Streaming SSE**: `node_started` → `token` → `node_completed` → `error`.
  * **Timeline** per run with replay pins, **immutable history**, request/response, cost, cache hits, and **citation panel**.

> **Why this?** Mirrors Zapier/Make mental model to minimize user friction while surfacing rigor (types, tests, citations) inline. 

---

## 3) Block Catalog (concise)

| Block                       | Icon  | Purpose & Typical Use                                            | Inputs → Outputs (typed)                                                                                           | Key Params (defaults)                                                                                                    | Internal Mechanism (1–2 lines)                                                                                  |                                                                                                     |                                                           |
| --------------------------- | ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Manual Trigger**          | ▶️    | Start runs on click for ad‑hoc testing.                          | `void` → `{startedAt: ISO}`                                                                                        | none                                                                                                                     | Emits a minimal payload to seed a flow.                                                                         |                                                                                                     |                                                           |
| **Webhook Trigger**         | 🛰️   | Ingest external events (app webhooks).                           | `HTTP {headers, body}` → `{headers, body, query}`                                                                  | `path`, `secret`, `method`, `verifySignature`(true)                                                                      | Validates HMAC, parses JSON, stamps receivedAt.                                                                 |                                                                                                     |                                                           |
| **Schedule Trigger**        | ⏰     | Cron/interval runs.                                              | `void` → `{timestamp, scheduleId}`                                                                                 | `cron`, `timezone`                                                                                                       | Emits schedule tick metadata.                                                                                   |                                                                                                     |                                                           |
| **Prompt (LLM)**            | 💬    | General prompting with guardrails.                               | `{prompt: string, vars?: object, context?: Context[], memory?: Session}` → `{text, citations?: Citation[], usage}` | `model`, `temperature(0.3)`, `maxTokens(800)`, `cot(false)`, `requireCitations(auto)`, `refusalPolicy("regulated-only")` | Slot detection, form‑generated controls; optional CoT; citations only if upstream RAG present.                  |                                                                                                     |                                                           |
| **RAG**                     | 📚    | Retrieve grounding context to reduce provenance debt.            | `{query: string}` → `{context: [{text, source, page?}], query}`                                                    | **see schema below**: `sources[]`, `topK(5)`, `chunk.size(1200)/overlap(120)`, `citationStyle("inline")`                 | Hybrid BM25+vector retrieval; chunk + rank; emits context + query; citations attached. **Governance default**.  |                                                                                                     |                                                           |
| **Verify (CoV)**            | ✅     | 4‑phase self‑verification to reduce hallucinations.              | `{draft, context?}` → `{final, verifications[], usage}`                                                            | `policy("strict"                                                                                                         | "annotate"="strict")`, `maxQ(7)`                                                                                | Draft→Plan→Execute→Finalize; factored Q&A; reconcile to corrected final.                            |                                                           |
| **Refine (RSIP)**           | 🔁    | Generate→Critique→Improve loop by criteria.                      | `{draft, criteria[]}` → `{improved, iterations, notes}`                                                            | `passes(2)`, `stageCriteria[["accuracy"],["clarity"],["completeness"]]`                                                  | Iterative self‑refine with staged criteria guidance.                                                            |                                                                                                     |                                                           |
| **Hybrid Reasoning Switch** | 🔀    | Auto choose fast/no‑think vs CoT/ToT based on complexity/budget. | `{question, signals?}` → union(`{answerFast}`                                                                      | `{trace, answerDeliberate}`)                                                                                             | `complexityGate("auto")`, `budget.tokens(2000)`, `latency.ms(3000)`, `fallback("cot")`                          | Lightweight classifier + heuristics gate; escalates reasoning only when needed.                     |                                                           |
| **SPOC Verifier**           | ⚡     | Single‑pass interleaved propose‑verify correction.               | `{prompt                                                                                                           | draft}`→`{final, trace: [{segment, check, action}]}`                                                                     | `model("spoc-*")`, `triggerTokens(["Wait!"])`, `confidenceThreshold(0.6)`                                       | SPOC‑style interleaving; terminates/edits on internal checks; falls back to CoV on low confidence.  |                                                           |
| **Branch/Router**           | 🔂    | Score‑ or rule‑based pathing.                                    | `{payload}` → one of N outputs                                                                                     | `routes: [{when: expr                                                                                                    | score>=t, to: nodeId}]`                                                                                         | Evaluates expressions/scores; emits to first matching route.                                        |                                                           |
| **Loop/Map**                | 🔁➗   | Iterate over arrays with concurrency.                            | `{items: any[]}` → emits each → join array                                                                         | `concurrency(5)`, `stopOnError(false)`                                                                                   | Fan‑out per item, collect results.                                                                              |                                                                                                     |                                                           |
| **Parallel/Join (GoT Agg)** | 🪢    | Run branches in parallel, then aggregate.                        | `{branches[]}` → `{merged, trace}`                                                                                 | `aggregate("rank+merge"                                                                                                  | "vote"                                                                                                          | "concat")`                                                                                          | Executes in parallel; **Graph‑of‑Thought** merge policy.  |
| **Retry/Timeout**           | ⏳     | Wrap step with timeouts/backoff.                                 | passthrough                                                                                                        | `timeoutMs(15000)`, `retries(2)`, `backoff("expo")`                                                                      | Supervises downstream with cancellation and retry.                                                              |                                                                                                     |                                                           |
| **JSON Transform**          | 🧩    | Map/shape objects with safe expressions.                         | `{input: object}` → `{output: object}`                                                                             | `mapping: ExprMap`, `strict(true)`                                                                                       | Deterministic transformer with whitelisted mini‑lang.                                                           |                                                                                                     |                                                           |
| **Table Compose**           | 🧮    | Build typed tables (transcribe text).                            | `{rows: any[]                                                                                                      | text}`→`{table: Table}`                                                                                                  | `columns: [{name,type}]`, `mode("extract"                                                                       | "compose")`                                                                                         | Extract entities to table or compose from arrays.         |
| **Chart Extract**           | 📈🖼️ | Extract chart values (image) → table.                            | `{image: File}` → `{table: Table}`                                                                                 | `ocr(true)`, `axisHints?`, `validateTotals(true)`                                                                        | “Transcribe→Analyze” for charts; used upstream of Prompt.                                                       |                                                                                                     |                                                           |
| **Approval Gate (HITL)**    | 🧑‍⚖️ | Pause for human review/edits.                                    | `{proposal}` → `{approved: bool, notes, edited?}`                                                                  | `assignees[]`, `sla`, `autoApprove(false)`                                                                               | Inbox/task with diff view; resumes on approve or routes on reject.                                              |                                                                                                     |                                                           |
| **HTTP**                    | 🌐    | Call REST APIs.                                                  | `{url, method, headers?, body?}` → `{status, headers, json                                                         | text                                                                                                                     | blob}`                                                                                                          | `retry`, `timeout`, `authRef`                                                                       | Fetch with secrets isolation; auto‑parse JSON.            |
| **Slack/Email**             | ✉️    | Notify or collect approvals.                                     | `{to, subject                                                                                                      | channel, body}`→`{messageId}`                                                                                            | `provider`, `template?`                                                                                         | Sends messages; deep‑link back to Approval Gate.                                                    |                                                           |
| **Sheets/Notion**           | 📗    | Read/write rows/pages.                                           | `{op, data}` → `{row                                                                                               | page}`                                                                                                                   | `connectionRef`, `tableId                                                                                       | dbId`                                                                                               | CRUD to SaaS stores with typed mapping.                   |
| **Files**                   | 📁    | Save/load files.                                                 | `{path, content                                                                                                    | ref}`→`{ref, url?}`                                                                                                      | `storage("managed"                                                                                              | "s3")`, `retention`                                                                                 | Checksums, MIME detection, signed URLs.                   |
| **KV Store**                | 🔑    | Small state/feature flags.                                       | `{op, key, value?}` → `{value}`                                                                                    | `namespace`, `ttl?`                                                                                                      | Namespaced get/set with TTL.                                                                                    |                                                                                                     |                                                           |
| **Thread/Session Memory**   | 🧠    | Persist conversation/session state.                              | `{sessionId, event}` → `{state}`                                                                                   | `retention("30d")`, `piiPolicy("redact")`                                                                                | Append‑only log + summarization windows.                                                                        |                                                                                                     |                                                           |
| **GraphRAG / KGoT**         | 🕸️   | Build/query persistent knowledge graph.                          | `{query, docs?}` → `{answers, paths:[(s,p,o)…], citations[]}`                                                      | `kgRef`, `ingestPolicy`, `pathBudget(10)`                                                                                | Extract triples, persist, path‑query with provenance; returns answer + evidence paths.                          |                                                                                                     |                                                           |

> **Why this?** Blocks expose high‑rigor methods (RAG, CoV, RSIP, SoT/GoT, KGoT) as **simple nodes** with typed IO so users can compose robust pipelines like Zapier while meeting Prompt‑Science governance and provenance expectations. 

---

## 4) Node Specs (TypeScript‑like)

### 4.1 Canonical Interface & Base Schemas

```ts
import { z } from "zod";

export interface INode<I, O> {
  id: string;
  type: string;          // e.g., "prompt", "rag", "verify.cov", "refine.rsip", "router", "loop", "parallel", "tool.http"
  name: string;
  inputs: I;             // typed mapping or literal values
  params: Record<string, unknown>;
  outputs?: O;           // shape after run
  ui?: { icon?: string; category?: string; color?: string };
}

// Shared types
export const Citation = z.object({
  source: z.string(), page: z.number().int().optional(), pointer: z.string().optional()
});
export const ContextChunk = z.object({
  text: z.string(), source: z.string(), page: z.number().int().optional()
});
export const Table = z.object({
  columns: z.array(z.object({ name: z.string(), type: z.enum(["string","number","boolean","date","json"]) })),
  rows: z.array(z.record(z.any()))
});
```

**RAG params (from prompt):**

```ts
export const RagParams = z.object({
  sources: z.array(z.object({ kind: z.enum(["file","web","collection"]), ref: z.string() })),
  topK: z.number().int().min(1).max(20).default(5),
  chunk: z.object({ size: z.number().min(200).max(4000).default(1200), overlap: z.number().min(0).max(400).default(120) }),
  citationStyle: z.enum(["inline","footnote","json"]).default("inline")
});
```

### 4.2 Param Schemas by Node

```ts
// Prompt
export const PromptParams = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(1).max(128000).default(800),
  cot: z.boolean().default(false),
  requireCitations: z.enum(["always","auto","never"]).default("auto"),
  refusalPolicy: z.enum(["off","regulated-only","always"]).default("regulated-only")
});

// Verify (CoV)
export const CoVParams = z.object({
  policy: z.enum(["strict","annotate"]).default("strict"),
  maxQuestions: z.number().int().min(1).max(20).default(7)
});

// Refine (RSIP)
export const RSIPParams = z.object({
  passes: z.number().int().min(1).max(10).default(2),
  stageCriteria: z.array(z.array(z.string())).default([["accuracy"],["clarity"],["completeness"]])
});

// Hybrid Reasoning Switch
export const HybridParams = z.object({
  complexityGate: z.enum(["auto","fast","deliberate"]).default("auto"),
  budget: z.object({ tokens: z.number().int().min(200).max(50000).default(2000) }),
  latency: z.object({ ms: z.number().int().min(100).max(60000).default(3000) }),
  fallback: z.enum(["cot","tot","spoc"]).default("cot")
});

// SPOC Verifier
export const SpocParams = z.object({
  model: z.string().default("spoc-70b"),
  triggerTokens: z.array(z.string()).default(["Wait!"]),
  confidenceThreshold: z.number().min(0).max(1).default(0.6)
});

// Control
export const RouterParams = z.object({
  routes: z.array(z.object({ when: z.string(), to: z.string() })).min(1)
});
export const LoopParams = z.object({
  concurrency: z.number().int().min(1).max(50).default(5),
  stopOnError: z.boolean().default(false)
});
export const ParallelParams = z.object({
  aggregate: z.enum(["rank+merge","vote","concat"]).default("rank+merge")
});
export const RetryParams = z.object({
  timeoutMs: z.number().int().min(1000).max(600000).default(15000),
  retries: z.number().int().min(0).max(5).default(2),
  backoff: z.enum(["fixed","expo","jitter"]).default("expo")
});

// Data
export const JsonTransformParams = z.object({
  mapping: z.record(z.string()), // mini-language expressions
  strict: z.boolean().default(true)
});
export const TableComposeParams = z.object({
  mode: z.enum(["extract","compose"]).default("extract"),
  columns: z.array(z.object({ name: z.string(), type: z.enum(["string","number","boolean","date","json"]) })).optional()
});
export const ChartExtractParams = z.object({
  ocr: z.boolean().default(true),
  axisHints: z.array(z.string()).optional(),
  validateTotals: z.boolean().default(true)
});

// HITL
export const ApprovalParams = z.object({
  assignees: z.array(z.string()).min(1),
  sla: z.number().int().min(0).default(0),
  autoApprove: z.boolean().default(false)
});

// Tools/IO
export const HttpParams = z.object({
  method: z.enum(["GET","POST","PUT","PATCH","DELETE"]).default("POST"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
  authRef: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).default(15000),
  retry: RetryParams.default({})
});
export const SlackEmailParams = z.object({
  provider: z.enum(["slack","smtp"]).default("slack"),
  template: z.string().optional()
});
export const SheetsNotionParams = z.object({
  connectionRef: z.string(),
  resourceId: z.string(), // tableId/dbId
  op: z.enum(["read","create","update"]).default("create")
});
export const FilesParams = z.object({
  storage: z.enum(["managed","s3"]).default("managed"),
  path: z.string(),
  retention: z.enum(["7d","30d","90d","forever"]).default("30d")
});

// Memory
export const KVParams = z.object({
  namespace: z.string(),
  ttl: z.number().int().min(0).optional()
});
export const SessionParams = z.object({
  retention: z.enum(["7d","30d"]).default("30d"),
  piiPolicy: z.enum(["redact","allow"]).default("redact")
});

// Advanced
export const GraphRagParams = z.object({
  kgRef: z.string(),
  ingestPolicy: z.enum(["append","upsert","replace"]).default("upsert"),
  pathBudget: z.number().int().min(1).max(100).default(10)
});
```

**Fail‑fast node registry (discriminated union):**

```ts
export const NodeParamsByType = z.discriminatedUnion("type", [
  z.object({type: z.literal("trigger.manual"), params: z.object({})}),
  z.object({type: z.literal("trigger.webhook"), params: z.object({ path: z.string(), secret: z.string(), method: z.enum(["GET","POST"]).default("POST"), verifySignature: z.boolean().default(true) })}),
  z.object({type: z.literal("trigger.schedule"), params: z.object({ cron: z.string(), timezone: z.string().default("UTC") })}),
  z.object({type: z.literal("prompt"), params: PromptParams}),
  z.object({type: z.literal("rag"), params: RagParams}),
  z.object({type: z.literal("verify.cov"), params: CoVParams}),
  z.object({type: z.literal("refine.rsip"), params: RSIPParams}),
  z.object({type: z.literal("reason.hybrid"), params: HybridParams}),
  z.object({type: z.literal("verify.spoc"), params: SpocParams}),
  z.object({type: z.literal("control.router"), params: RouterParams}),
  z.object({type: z.literal("control.loop"), params: LoopParams}),
  z.object({type: z.literal("control.parallel"), params: ParallelParams}),
  z.object({type: z.literal("control.retry"), params: RetryParams}),
  z.object({type: z.literal("data.jsonTransform"), params: JsonTransformParams}),
  z.object({type: z.literal("data.tableCompose"), params: TableComposeParams}),
  z.object({type: z.literal("data.chartExtract"), params: ChartExtractParams}),
  z.object({type: z.literal("hitl.approval"), params: ApprovalParams}),
  z.object({type: z.literal("tool.http"), params: HttpParams}),
  z.object({type: z.literal("tool.slackEmail"), params: SlackEmailParams}),
  z.object({type: z.literal("tool.sheetsNotion"), params: SheetsNotionParams}),
  z.object({type: z.literal("tool.files"), params: FilesParams}),
  z.object({type: z.literal("memory.kv"), params: KVParams}),
  z.object({type: z.literal("memory.session"), params: SessionParams}),
  z.object({type: z.literal("advanced.graphrag"), params: GraphRagParams}),
]);
```

> **Why this?** **Zod** delivers compile‑time and run‑time validation that **fails fast**, the backbone of reproducible **Prompt‑Science** workflows. 

---

## 5) Prompt Node UX

* **Slot detection → form controls.** The node scans template text for `{{slots}}` and infers control types (`string, enum, number, boolean, date, url, json, table, file, list[...]`). Enums come from inline annotations, e.g., `{{priority:enum[low,med,high]}}`.
* **Live prompt preview.** As mappings change, show the fully rendered prompt (with secrets masked).
* **Guardrails toggles.**

  * `CoT`: on/off (adds lightweight “think step-by-step” system hint).
  * `Require Citations`: **forced ON** when upstream **RAG** is connected; optional otherwise. 
  * **Refusal policy**: auto refuse out‑of‑scope or ungrounded asks (show refusal template).
* **Test Step** shows answer, **citations**, token/cost, and any **policy violations**.

> **Why this?** Slot → form keeps prompts **documented and typed**, matching the compendium’s reproducibility goals. Citations are governance when RAG exists. 

---

## 6) RAG Node UX

* **Source selection.** Add `file`, `web`, or `collection` sources. Show index status, last crawl time.
* **Tuning.** `topK`, `chunk.size/overlap`, **re‑rank** toggle, **dedupe** toggle.
* **Citation style.** Inline, footnote, or JSON block; **footnote** enumerates `[n] source (page)`.
* **Governance rationale.** Using RAG **anchors** the model to user‑provided, citable documents, **reducing provenance debt** by design; Studio defaults “Require Citations: ON” when RAG is present. 

> **Why this?** Treating RAG as **governance** (not just accuracy) operationalizes provenance controls demanded in the compendium. 

---

## 7) Verify (CoV) Node

**Phases & events.** `draft` → `plan` → `execute[]` → `finalize`. Emits streaming progress:

* `cov_phase: "draft" | "plan" | "execute" | "finalize"`
* Verification artifacts: `questions[]`, `answers[]`, `diffs[]`, `status`.

**Finalize policy.**

* `strict` (default): the final answer **must** incorporate verified facts; missing verification → error.
* `annotate`: emits final plus **flags** for unverified claims.

> **Why this?** The 4‑phase CoV process demonstrably reduces hallucinations; we make it a reusable node with strict/flexible finalize options. 

---

## 8) Refine (RSIP) Node

* **Loop**: `generate → critique(criteria[]) → improve`, with **staged criteria** (e.g., pass1=accuracy, pass2=clarity, pass3=completeness).
* **Controls**: `passes`, `criteria per pass`, `maxTokensDelta`.
* **Outputs**: `improved`, `notes per pass`, `deltas`.

> **Why this?** RSIP encodes disciplined iterative polishing instead of ad‑hoc re‑tries, per the compendium’s best practices. 

---

## 9) Multimodal Kits — **Transcribe→Analyze**

* **Thinking with Tables wrapper.** Forces table extraction from prose *before* downstream analysis. Downstream Prompt nodes are **constrained** to the produced table via mapping. 
* **Charts‑of‑Thought wrapper.** Uses **Chart Extract** to convert chart images to typed tables; subsequent answers **must** reference table rows/columns; Guardrail refuses if table missing. 
* **Audio Timeline Ingest.** Upload interview/audio assets, auto-track speaker beats + timestamps, and emit a validated timeline structure before reasoning.
* **Video Event Graph.** Break long-form video into timestamped semantic nodes + causal/temporal edges; downstream prompts navigate the graph instead of raw transcripts.
* **Scene Graph Builder.** Encode 3D/visual environments as node/relationship graphs (e.g., `camera looks_at subject`), enabling spatial reasoning and simulation-ready prompts.

> **Why this?** “**Structure precedes reasoning**” systematically improves accuracy and auditability across text and images. 

---

## 10) Mapping UX

* **Data pills** with hover previews; drag to any input. Pills can be **composed** with a safe **mini‑language** (whitelist).
* **Mini‑language (safe subset):**

  * `coalesce(a,b,...)`, `join(list, sep)`, `slice(str, start, end)`, `toUpper(str)`, `toLower(str)`, `formatDate(ts, "YYYY-MM-DD")`, `pick(obj, "path")`, `sum(list.number)`.
  * No eval of arbitrary code; deterministic and sandboxed.
* **Scope resolution.** `Step` outputs → `Flow` vars (set in Router/Transform) → `Secrets` (read‑only via refs).
* **Sample data generator.** Each node ships a **Zod‑based example** (valid per schema) for Zapier‑style test mapping.

> **Why this?** Mapping is the Studio’s “glue”; a conservative, deterministic DSL keeps runs reproducible and explorable. 

---

## 11) Execution Engine

* **Streaming SSE model.** Events:
  `run_started`, `node_started`, `token` (LLM stream), `node_completed`, `error`, `run_completed`. Payloads include `nodeId`, `ts`, `usage`, `citations`.
* **Deterministic caching.** Cache **non‑LLM** outputs by `(nodeType, params, inputsHash)`; for LLM nodes, enable **RAG‑context hashing** + prompt template hash to reuse where permitted.
* **Replay from node.** “Run from here” pins the **exact inputs** (captured in history) and replays downstream; unchanged nodes may serve from cache.
* **Cost meter.** Per‑node token/latency/cost; **policy warnings** when expected ToT/GoT or RSIP/CoV exceed budgets; suggest **Hybrid Switch** fallback or `spoc` where available. 

> **Why this?** Cost/time transparency and replayability are cornerstones of auditable Prompt Science—and essential as we migrate to hybrid/SPOC regimes.

---

## 12) Governance & Safety

* **Defaults:**

  * **Citations ON** whenever RAG context present.
  * **HITL Approval ON** for flows tagged `regulated` (health, legal, finance).
  * **Guarded refusals** for out‑of‑scope or ungrounded asks.
* **Bias & privacy.** Log model/provider/params; optional bias checks; PII redaction in **Session Memory**; **secrets isolation** (never rendered in previews).
* **Audit log.** Immutable per run: prompts, params, inputs, outputs, citations, diffs at Approval Gate.

> **Why this?** Enforces human‑in‑the‑loop accountability and provenance‑first defaults documented as necessary for professional use. 

---

## 13) Templates (turn‑key)

### A) **Deep Research (RAG + CoV)**

**Flow:** Trigger → RAG → Prompt(draft; requireCitations) → Verify(CoV strict) → Slack.
**Sample input:** `query="Implications of X regulation for Y"` → **Expected output:** verified brief with inline/footnote citations.
**Acceptance:** ≥1 citation per claim cluster; CoV `questions≥5`, no unverified claims; SSR ≥ 0.95.

### B) **Strategic Planning (ToT + MPS + CHI)**

**Flow:** Trigger → ToT via Parallel/Join (3–5 strategies) → Prompt(MPS debate) → Prompt(CHI labeled SPECULATIVE) → Approval Gate.
**Acceptance:** At least 3 viable branches with pros/cons; MPS summary covering finance, marketing, engineering, competitor; CHI entries labeled SPECULATIVE; final selection documented.

### C) **Data Review (Thinking with Tables)**

**Flow:** Trigger → Table Compose(extract) → Prompt(Answer **only** from table) → Slack.
**Acceptance:** If table empty/incomplete, emit refusal with guidance; if table valid, analysis references column names.

### D) **Chart QA (Charts‑of‑Thought)**

**Flow:** Files(upload chart) → Chart Extract → Prompt(answers only from table) → Email report.
**Acceptance:** Table includes axis labels & values; answers include row/column references.

> **Why this?** Encodes the compendium’s playbooks as ready flows; acceptance criteria test citations and structure‑first behavior. 

---

## 14) Performance & Cost Policy

* **Token/latency budgets per node** (defaults): Prompt ≤800 tokens, RAG topK≤5, CoV ≤4 phases, RSIP ≤2 passes, ToT branches≤5. Breaches flag in UI.
* **Hybrid Reasoning Switch**:

  * Gate rules (illustrative): if `question.length<160 && no_numeric && no_tool && history_empty` → **fast path (no‑think)**; else **deliberate** with CoT; if **deliberate tokens** projected > budget → suggest **SPOC** or **annotate mode**. 
* **Escalate to SPOC** when **low latency + high correctness** required and model available; otherwise CoV strict.

> **Why this?** Hybrid thinking avoids “always‑on slow CoT/ToT” cost; SPOC offers single‑pass verification where feasible. 

---

## 15) Roadmap

* **v1:** HITL, RAG, CoV, RSIP, Transcribe→Analyze.
* **v1.1:** **Hybrid Reasoning** controller + cost guardrails.
* **v2:** **SPOC Verifier** node (model integration); **GraphRAG/KGoT** persistent knowledge state.
* **v2.1:** Graph editing UI; knowledge paths in answers.
* **v3:** **SaGoT/algorithmic pruning hooks** for research mode; advanced debuggability. 

---

## 16) Test Plan & CI

* **Schema validation CLI.** `studio validate flow.json` → validates **NodeParamsByType**, mapping types, and graph connectivity (acyclic unless Parallel/Join).
* **Unit tests.**

  * **Mapping**: expression mini‑lang determinism & error surfacing.
  * **Slot detection**: prompts → controls type inference.
  * **CoV orchestration**: phase transitions, strict vs annotate.
* **E2E (Playwright).** Drag→connect→run→assert tokens/citations; replay from node; Approval Gate paths.
* **Playbook Benchmarks**:

  * **SSR (Step Success Rate)**: % of planned steps executed.
  * **Step fidelity**: mapping correctness & guardrail adherence.
  * **Verification efficacy**: % hallucination/provenance errors caught vs baseline (no‑CoV/SPOC).
  * **Cost/latency**: adherence to budgets with Hybrid/SPOC suggestions.

> **Why this?** Tests make flows **falsifiable and repeatable**, the essence of Prompt Science; benchmarks quantify rigor & efficiency while we adopt hybrid/SPOC.

---

# Appendix — UX Specs Called Out

## A) Required Output Formats (reiterated)

* Canonical `INode<I,O>` + Zod schemas (above).
* Prompt Node auto‑detects `{{slots}}` → typed controls; **guardrails**: `cot`, `requireCitations (conditional on RAG)`, **refusal**.
* **RAG Node** emits `{ context: [{text, source, page}], query }`.
* **Verify (CoV)** phases: `draft, plan, execute[], finalize`, policy: `strict | annotate`.
* **RSIP** loop: `generate → critique(criteria[]) → improve` with staged criteria.
* **Multimodal wrappers** force **Transcribe→Analyze** and constrain downstream to structured artifacts.

---

## B) “Why this?” Key Choices with Rationale

* **RAG as governance** for provenance debt (citations default ON) → reduces legal/operational risk. 
* **Structure precedes reasoning** (Tables/Charts‑of‑Thought) → improves accuracy & auditability across modalities. 
* **Hybrid Reasoning** + **SPOC** path → efficiency via fast/slow switching; single‑pass verification for low‑latency scenarios. 
* **GraphRAG/KGoT** option → persistent knowledge state with citable **paths**, aligning with agentic cognition direction. 

---

## C) Example Node IO Types (snippets)

```ts
// RAG I/O
type RagIn = { query: string };
type RagOut = { context: z.infer<typeof ContextChunk>[], query: string };

// Prompt I/O
type PromptIn = { prompt: string, vars?: Record<string, any>, context?: RagOut["context"], memory?: any };
type PromptOut = { text: string, citations?: z.infer<typeof Citation>[], usage: { prompt: number, completion: number } };

// CoV I/O
type CoVIn = { draft: string, context?: RagOut["context"] };
type CoVOut = { final: string, verifications: { q: string, a: string, status: "ok"|"warn"|"fail" }[], usage: any };
```

---

## D) Example Flow (Deep Research)

```
[Schedule] → [RAG] → [Prompt(cot, requireCitations=auto)] → [Verify(CoV strict)] → [Slack]
```

* **Mapping:** `Prompt.vars.query ← RAG.query`, `Prompt.context ← RAG.context`.
* **Guards:** If `RAG.context.length==0` → Router → HITL Approval with “no sources” refusal.
* **Accept:** All claims include citations; CoV marks zero `fail` statuses.

---

### Closing Note

This spec delivers **Zapier‑class usability** with **Prompt‑Science rigor** today, and a clean path to tomorrow’s **agentic cognition** via **hybrid reasoning**, **SPOC**, and **GraphRAG/KGoT**—minimizing provenance debt while keeping cost/latency under control.

---

*If you want, I can immediately expand the Block Catalog and **all Node Zod schemas** into production‑ready TypeScript with **example JSON flows** and **Playwright tests**—just say “**generate the spec pack**.”*
