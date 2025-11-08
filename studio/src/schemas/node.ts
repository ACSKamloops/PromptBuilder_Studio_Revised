import { z } from "zod";

export const Citation = z.object({
  source: z.string(),
  page: z.number().int().optional(),
  pointer: z.string().optional(),
});

export const ContextChunk = z.object({
  text: z.string(),
  source: z.string(),
  page: z.number().int().optional(),
});

export const TableColumn = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "date", "json"]),
});

export const TableSchema = z.object({
  columns: z.array(TableColumn),
  rows: z.array(z.record(z.any())),
});

export const RagParams = z.object({
  sources: z.array(z.object({ kind: z.enum(["file", "web", "collection"]), ref: z.string() })).default([]),
  topK: z.number().int().min(1).max(20).default(5),
  chunk: z
    .object({ size: z.number().min(200).max(4000).default(1200), overlap: z.number().min(0).max(400).default(120) })
    .default({ size: 1200, overlap: 120 }),
  citationStyle: z.enum(["inline", "footnote", "json"]).default("inline"),
  sampleQuery: z.string().optional(),
  sampleContext: z.string().optional(),
});

export const PromptParams = z.object({
  model: z.string().default("gpt-4.1-mini"),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(1).max(128000).default(800),
  cot: z.boolean().default(false),
  requireCitations: z.enum(["always", "auto", "never"]).default("auto"),
  refusalPolicy: z.enum(["off", "regulated-only", "always"]).default("regulated-only"),
});

export const CoVParams = z.object({
  policy: z.enum(["strict", "annotate"]).default("strict"),
  maxQuestions: z.number().int().min(1).max(20).default(7),
});

export const RSIPParams = z.object({
  passes: z.number().int().min(1).max(10).default(2),
  stageCriteria: z.array(z.array(z.string())).default([["accuracy"], ["clarity"], ["completeness"]]),
});

export const HybridParams = z.object({
  complexityGate: z.enum(["auto", "fast", "deliberate"]).default("auto"),
  budget: z.object({ tokens: z.number().int().min(200).max(50000).default(2000) }).default({ tokens: 2000 }),
  latency: z.object({ ms: z.number().int().min(100).max(60000).default(3000) }).default({ ms: 3000 }),
  fallback: z.enum(["cot", "tot", "spoc"]).default("cot"),
});

export const SpocParams = z.object({
  model: z.string().default("spoc-70b"),
  triggerTokens: z.array(z.string()).default(["Wait!"]),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
});

export const RouterParams = z.object({
  routes: z.array(z.object({ when: z.string(), to: z.string() })).min(1),
});

export const LoopParams = z.object({
  concurrency: z.number().int().min(1).max(50).default(5),
  stopOnError: z.boolean().default(false),
});

export const ParallelParams = z.object({
  aggregate: z.enum(["rank+merge", "vote", "concat"]).default("rank+merge"),
});

export const RetryParams = z.object({
  timeoutMs: z.number().int().min(1000).max(600000).default(15000),
  retries: z.number().int().min(0).max(5).default(2),
  backoff: z.enum(["fixed", "expo", "jitter"]).default("expo"),
});

export const JsonTransformParams = z.object({
  mapping: z.record(z.string()),
  strict: z.boolean().default(true),
});

export const TableComposeParams = z.object({
  mode: z.enum(["extract", "compose"]).default("extract"),
  columns: z.array(TableColumn).optional(),
});

export const ChartExtractParams = z.object({
  ocr: z.boolean().default(true),
  axisHints: z.array(z.string()).optional(),
  validateTotals: z.boolean().default(true),
});

export const ApprovalParams = z.object({
  assignees: z.array(z.string()).min(1),
  sla: z.number().int().nonnegative().default(0),
  autoApprove: z.boolean().default(false),
});

export const HttpParams = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
  authRef: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).default(15000),
  retry: RetryParams.default({}),
  bodyTemplate: z.string().optional(),
});

export const SlackEmailParams = z.object({
  provider: z.enum(["slack", "smtp"]).default("slack"),
  template: z.string().optional(),
});

export const SheetsNotionParams = z.object({
  connectionRef: z.string(),
  resourceId: z.string(),
  op: z.enum(["read", "create", "update"]).default("create"),
});

export const FilesParams = z.object({
  storage: z.enum(["managed", "s3"]).default("managed"),
  path: z.string(),
  retention: z.enum(["7d", "30d", "90d", "forever"]).default("30d"),
});

export const KVParams = z.object({
  namespace: z.string(),
  ttl: z.number().int().nonnegative().optional(),
});

export const SessionParams = z.object({
  retention: z.enum(["7d", "30d"]).default("30d"),
  piiPolicy: z.enum(["redact", "allow"]).default("redact"),
});

export const GraphRagParams = z.object({
  kgRef: z.string(),
  ingestPolicy: z.enum(["append", "upsert", "replace"]).default("upsert"),
  pathBudget: z.number().int().min(1).max(100).default(10),
});

const ManualTriggerNode = z.object({
  type: z.literal("trigger.manual"),
  params: z.object({}).default({}),
});

const WebhookTriggerNode = z.object({
  type: z.literal("trigger.webhook"),
  params: z
    .object({
      path: z.string(),
      secret: z.string(),
      method: z.enum(["GET", "POST"]).default("POST"),
      verifySignature: z.boolean().default(true),
    })
    .default(() => ({ path: "/webhook", secret: "CHANGE_ME", method: "POST" as const, verifySignature: true })),
});

const ScheduleTriggerNode = z.object({
  type: z.literal("trigger.schedule"),
  params: z.object({ cron: z.string(), timezone: z.string().default("UTC") }),
});

const PromptNode = z.object({ type: z.literal("prompt"), params: PromptParams });
const RagNode = z.object({ type: z.literal("rag"), params: RagParams });
const CovNode = z.object({ type: z.literal("verify.cov"), params: CoVParams });
const RsipNode = z.object({ type: z.literal("refine.rsip"), params: RSIPParams });
const HybridNode = z.object({ type: z.literal("reason.hybrid"), params: HybridParams });
const SpocNode = z.object({ type: z.literal("verify.spoc"), params: SpocParams });
const RouterNode = z.object({ type: z.literal("control.router"), params: RouterParams });
const LoopNode = z.object({ type: z.literal("control.loop"), params: LoopParams });
const ParallelNode = z.object({ type: z.literal("control.parallel"), params: ParallelParams });
const RetryNode = z.object({ type: z.literal("control.retry"), params: RetryParams });
const JsonTransformNode = z.object({ type: z.literal("data.jsonTransform"), params: JsonTransformParams });
const TableComposeNode = z.object({ type: z.literal("data.tableCompose"), params: TableComposeParams });
const ChartExtractNode = z.object({ type: z.literal("data.chartExtract"), params: ChartExtractParams });
const ApprovalNode = z.object({ type: z.literal("hitl.approval"), params: ApprovalParams });
const HttpNode = z.object({ type: z.literal("tool.http"), params: HttpParams });
const SlackEmailNode = z.object({ type: z.literal("tool.slackEmail"), params: SlackEmailParams });
const SheetsNotionNode = z.object({ type: z.literal("tool.sheetsNotion"), params: SheetsNotionParams });
const FilesNode = z.object({ type: z.literal("tool.files"), params: FilesParams });
const KvNode = z.object({ type: z.literal("memory.kv"), params: KVParams });
const SessionNode = z.object({ type: z.literal("memory.session"), params: SessionParams });
const GraphRagNode = z.object({ type: z.literal("advanced.graphrag"), params: GraphRagParams });

export const NodeParamsByType = z.discriminatedUnion("type", [
  ManualTriggerNode,
  WebhookTriggerNode,
  ScheduleTriggerNode,
  PromptNode,
  RagNode,
  CovNode,
  RsipNode,
  HybridNode,
  SpocNode,
  RouterNode,
  LoopNode,
  ParallelNode,
  RetryNode,
  JsonTransformNode,
  TableComposeNode,
  ChartExtractNode,
  ApprovalNode,
  HttpNode,
  SlackEmailNode,
  SheetsNotionNode,
  FilesNode,
  KvNode,
  SessionNode,
  GraphRagNode,
]);

const BaseNodeFields = z.object({
  id: z.string(),
  name: z.string(),
  inputs: z.record(z.any()).default({}),
  outputs: z.record(z.any()).optional(),
  ui: z
    .object({
      icon: z.string().optional(),
      category: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
});

export const FlowNodeDefinition = BaseNodeFields.and(NodeParamsByType);
export type FlowNodeDefinition = z.infer<typeof FlowNodeDefinition>;
export type AnyNodeParams = z.infer<typeof NodeParamsByType>;
