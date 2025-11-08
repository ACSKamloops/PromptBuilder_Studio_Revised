import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { promises as fs } from "fs";
import path from "path";
import { parse } from "yaml";
import type { PromptSpec } from "@/lib/promptspec";
import { loadPromptLibrary } from "@/lib/load-prompts";
import type { PromptMetadata } from "@/types/prompt-metadata";

export interface NodeArtifactMetrics {
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  costUsd: number;
  confidence: number;
}

export interface NodeAttachment {
  type: string;
  label: string;
  payload?: unknown;
  url?: string;
}

export interface NodeArtifact {
  nodeId: string;
  block: string;
  promptPath?: string;
  promptTemplate?: string;
  renderedPrompt?: string;
  params: Record<string, unknown>;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  metrics: NodeArtifactMetrics;
  startedAt: string;
  completedAt: string;
  logs: string[];
  attachments?: NodeAttachment[];
}

export interface NodeGovernance {
  guidance?: string;
  failureModes?: string;
  acceptanceCriteria?: string;
  combinesWith?: string[];
  compositionStep?: CompositionStepSnapshot;
}

export interface LangGraphRunBlock {
  id: string;
  block: string;
  params: Record<string, unknown>;
  artifact: NodeArtifact;
  governance: NodeGovernance;
}

export interface CompositionStepSnapshot {
  use: string;
  map?: Record<string, unknown>;
  label?: string;
  description?: string;
}

export interface CompositionOutputSnapshot {
  name: string;
  expression: string;
}

export interface CompositionSnapshot {
  id?: string;
  title?: string;
  description?: string;
  steps: CompositionStepSnapshot[];
  outputs?: CompositionOutputSnapshot[];
  sourcePath?: string;
}

export interface BenchmarkDetail {
  label: string;
  completed: number;
  planned: number;
  ratio: number;
}

export interface BenchmarkSuite {
  computedAt: string;
  ssr: BenchmarkDetail;
  verificationEfficacy: BenchmarkDetail;
  notes: string[];
}

export interface LangGraphRunManifest {
  flow: PromptSpec["flow"];
  nodeCount: number;
  edgeCount: number;
  blocks: LangGraphRunBlock[];
  artifacts: Record<string, NodeArtifact>;
  composition?: CompositionSnapshot;
}

export interface LangGraphRunResult {
  runId: string;
  receivedAt: string;
  manifest: LangGraphRunManifest;
  benchmarks: BenchmarkSuite;
  logs: string[];
  message: string;
}

interface NodeExecutionResult {
  outputs: Record<string, unknown>;
  attachments?: NodeAttachment[];
  log: string;
  confidence: number;
}

export async function executeLangGraph(promptSpec: PromptSpec): Promise<LangGraphRunResult> {
  const runId = `langgraph-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const metadataList = await loadPromptLibrary();
  const metadataMap = new Map<string, PromptMetadata>(metadataList.map((item) => [item.id, item]));
  const composition = await loadCompositionSnapshot(promptSpec.flow.sourcePath);
  const compositionLookup = new Map<string, CompositionStepSnapshot>();
  if (composition) {
    for (const step of composition.steps) {
      compositionLookup.set(step.use, step);
    }
  }

  const RunAnnotation = Annotation.Root({
    context: Annotation<Record<string, unknown>>({
      default: () => ({}),
      reducer: (left, right) => ({ ...left, ...right }),
    }),
    artifacts: Annotation<Record<string, NodeArtifact>>({
      default: () => ({}),
      reducer: (left, right) => ({ ...left, ...right }),
    }),
    logs: Annotation<string[]>({
      default: () => [],
      reducer: (left, right) => left.concat(right),
    }),
    lastNode: Annotation<string | null>({ default: () => null }),
  });

  const graph = new StateGraph(RunAnnotation);
  const initialContext = deriveInitialContext(promptSpec, composition);

  for (const node of promptSpec.nodes) {
    graph.addNode(node.id, async (state: typeof RunAnnotation.State) => {
      const baseId = normalizeNodeId(node.id);
      const metadata = node.metadataId ? metadataMap.get(node.metadataId) : metadataMap.get(baseId);
      const compositionStep = compositionLookup.get(baseId);
      const scope = buildTemplateScope({
        node,
        stateContext: state.context,
        composition,
        metadata,
      });
      const mappedInputs = compositionStep?.map ? evaluateMapping(compositionStep.map, scope) : {};
      const resolvedInputs = { ...mappedInputs, ...node.params };
      const promptTemplate = metadata?.prompt;
      const renderedPrompt = promptTemplate ? renderTemplate(promptTemplate, scope) : undefined;
      const startedAt = new Date();
      const execution = buildNodeExecution({
        node,
        metadata,
        resolvedInputs,
        renderedPrompt,
        previous: (state.context.last as Record<string, unknown> | undefined) ?? {},
      });
      const tokens = estimateTokens(renderedPrompt, execution.outputs);
      const latencyMs = Math.max(90, tokens.total * 14);
      const completedAt = new Date(startedAt.getTime() + latencyMs);
      const artifact: NodeArtifact = {
        nodeId: node.id,
        block: node.block,
        promptPath: metadata?.relativePath,
        promptTemplate,
        renderedPrompt,
        params: node.params,
        inputs: resolvedInputs,
        outputs: execution.outputs,
        metrics: {
          tokens: {
            prompt: tokens.prompt,
            completion: tokens.completion,
            total: tokens.total,
          },
          latencyMs,
          costUsd: Number((tokens.total * 0.0000025).toFixed(6)),
          confidence: Number(execution.confidence.toFixed(3)),
        },
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        logs: [execution.log],
        attachments: execution.attachments,
      };

      return {
        context: {
          last: execution.outputs,
          [node.id]: execution.outputs,
          [`${node.id}:inputs`]: resolvedInputs,
          [`${node.id}:summary`]: execution.outputs.summary ?? execution.log,
        },
        artifacts: { [node.id]: artifact },
        logs: [execution.log],
        lastNode: node.id,
      };
    });
  }

  const inboundCounts = new Map<string, number>();
  for (const node of promptSpec.nodes) {
    inboundCounts.set(node.id, 0);
  }
  for (const edge of promptSpec.edges) {
    graph.addEdge(edge.from, edge.to);
    inboundCounts.set(edge.to, (inboundCounts.get(edge.to) ?? 0) + 1);
  }
  for (const node of promptSpec.nodes) {
    if ((inboundCounts.get(node.id) ?? 0) === 0) {
      graph.addEdge(START, node.id);
    }
  }
  if (promptSpec.nodes.length > 0) {
    graph.addEdge(promptSpec.nodes[promptSpec.nodes.length - 1].id, END);
  } else {
    graph.addEdge(START, END);
  }

  const compiled = graph.compile();
  const state = await compiled.invoke({
    context: initialContext,
    artifacts: {},
    logs: [],
    lastNode: null,
  });

  const artifacts = state.artifacts;
  const blocks: LangGraphRunBlock[] = promptSpec.nodes.map((node) => {
    const baseId = normalizeNodeId(node.id);
    const metadata = node.metadataId ? metadataMap.get(node.metadataId) : metadataMap.get(baseId);
    const artifact = artifacts[node.id];
    return {
      id: node.id,
      block: node.block,
      params: node.params,
      artifact,
      governance: {
        guidance: metadata?.when_to_use,
        failureModes: metadata?.failure_modes,
        acceptanceCriteria: metadata?.acceptance_criteria,
        combinesWith: metadata?.combines_with,
        compositionStep: compositionLookup.get(baseId),
      },
    };
  });

  const benchmarks = computeBenchmarks(promptSpec, blocks);
  const logs = state.logs;

  return {
    runId,
    receivedAt: timestamp,
    manifest: {
      flow: promptSpec.flow,
      nodeCount: promptSpec.nodes.length,
      edgeCount: promptSpec.edges.length,
      blocks,
      artifacts,
      composition,
    },
    benchmarks,
    logs,
    message:
      "LangGraph execution completed with sandboxed node artefacts and benchmark metrics.",
  };
}

function normalizeNodeId(id: string): string {
  return id.includes("#") ? id.split("#")[0] : id;
}

function deriveInitialContext(
  promptSpec: PromptSpec,
  composition?: CompositionSnapshot,
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    flow: promptSpec.flow,
  };
  if (composition) {
    context.composition = composition;
  }
  const systemNode = promptSpec.nodes.find((node) => normalizeNodeId(node.id).includes("system"));
  const userNode = promptSpec.nodes.find((node) => normalizeNodeId(node.id).includes("user"));
  if (systemNode) context.system = systemNode.params;
  if (userNode) context.user = userNode.params;
  return context;
}

function buildTemplateScope({
  node,
  stateContext,
  composition,
  metadata,
}: {
  node: PromptSpec["nodes"][number];
  stateContext: Record<string, unknown>;
  composition?: CompositionSnapshot;
  metadata?: PromptMetadata;
}): Record<string, unknown> {
  return {
    node,
    params: node.params,
    flow: stateContext.flow,
    composition,
    metadata,
    user: stateContext.user,
    system: stateContext.system,
    last: stateContext.last,
    prev: stateContext.last,
    context: stateContext,
  };
}

function evaluateMapping(
  mapping: Record<string, unknown>,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string") {
      result[key] = renderTemplate(value, scope);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = evaluateMapping(value as Record<string, unknown>, scope);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function renderTemplate(template: string, scope: Record<string, unknown>): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, expression: string) => {
    const key = expression.trim();
    if (!key) return "";
    const value = resolveScopeValue(scope, key);
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(", ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

function resolveScopeValue(scope: Record<string, unknown>, pathExpression: string): unknown {
  const segments = pathExpression.split(".");
  let current: unknown = scope;
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function buildNodeExecution({
  node,
  metadata,
  resolvedInputs,
  renderedPrompt,
  previous,
}: {
  node: PromptSpec["nodes"][number];
  metadata?: PromptMetadata;
  resolvedInputs: Record<string, unknown>;
  renderedPrompt?: string;
  previous: Record<string, unknown>;
}): NodeExecutionResult {
  const kind = classifyNodeKind(node.id);
  const now = new Date().toISOString();
  const outputs: Record<string, unknown> = {
    summary: `Generated artefact for ${node.block}`,
    generatedAt: now,
    inputsEcho: resolvedInputs,
    contextKeys: Object.keys(previous ?? {}),
  };
  const attachments: NodeAttachment[] = [];
  let confidence = 0.88;
  let log = `${node.block}: completed synthetic execution.`;

  switch (kind) {
    case "retriever": {
      const query = resolvedInputs.query ?? resolvedInputs.question ?? resolvedInputs.prompt ?? metadata?.title ?? node.block;
      outputs.retrievedContext = [
        {
          source: "library://sample/1",
          text: `Curated context for ${query}.`,
        },
        {
          source: "library://sample/2",
          text: `Second supporting passage for ${query}.`,
        },
      ];
      outputs.citations = outputs.retrievedContext;
      confidence = 0.9;
      log = `${node.block}: synthesized ${Array.isArray(outputs.retrievedContext) ? outputs.retrievedContext.length : 0} context passages.`;
      break;
    }
    case "verification": {
      const priorIssues = typeof previous?.issuesDetected === "number" ? (previous.issuesDetected as number) : 0;
      const issuesDetected = priorIssues;
      outputs.verdict = issuesDetected > 0 ? "flag" : "pass";
      outputs.issuesDetected = issuesDetected;
      outputs.analysis = issuesDetected > 0 ? "Follow-up required on previously detected issues." : "No blocking discrepancies detected.";
      confidence = issuesDetected > 0 ? 0.82 : 0.95;
      log = `${node.block}: verification verdict ${outputs.verdict}`;
      break;
    }
    case "approval": {
      outputs.proposal = previous ?? {};
      outputs.recommendation = "Auto-review complete; awaiting governance decision.";
      outputs.status = "pending";
      confidence = 0.86;
      log = `${node.block}: approval artefact prepared.`;
      break;
    }
    case "table": {
      const rows = Object.entries(resolvedInputs).map(([key, value]) => ({
        metric: key,
        value,
      }));
      const table = {
        columns: ["Metric", "Value"],
        rows,
      };
      outputs.table = table;
      attachments.push({ type: "table", label: `${node.block} table`, payload: table });
      confidence = 0.91;
      log = `${node.block}: assembled ${rows.length} table rows.`;
      break;
    }
    case "refinement": {
      outputs.draft = previous?.draft ?? renderedPrompt ?? metadata?.prompt ?? "";
      outputs.revisions = [
        "Tightened structure",
        "Expanded supporting evidence",
        "Aligned tone with mandate",
      ];
      confidence = 0.9;
      log = `${node.block}: proposed ${outputs.revisions instanceof Array ? outputs.revisions.length : 0} refinements.`;
      break;
    }
    case "planning": {
      outputs.plan = [
        "Clarify mandate",
        "Gather evidence",
        "Verify and synthesize",
      ];
      outputs.owner = resolvedInputs.owner ?? "orchestrator";
      confidence = 0.89;
      log = `${node.block}: produced ${outputs.plan instanceof Array ? outputs.plan.length : 0} planning steps.`;
      break;
    }
    default: {
      outputs.content = `Structured output for ${node.block}`;
      outputs.nextSteps = ["Review", "Deploy", "Monitor"];
      confidence = 0.9;
      log = `${node.block}: generated default artefact.`;
    }
  }

  if (renderedPrompt) {
    outputs.renderedPromptPreview = renderedPrompt.slice(0, 400);
  }

  return { outputs, attachments: attachments.length > 0 ? attachments : undefined, log, confidence };
}

function classifyNodeKind(nodeId: string):
  | "retriever"
  | "verification"
  | "approval"
  | "table"
  | "refinement"
  | "planning"
  | "default" {
  const base = normalizeNodeId(nodeId).toLowerCase();
  if (base.includes("rag") || base.includes("retriever")) return "retriever";
  if (base.includes("verify") || base.includes("cov") || base.includes("audit")) return "verification";
  if (base.includes("approval")) return "approval";
  if (base.includes("table") || base.includes("chart")) return "table";
  if (base.includes("rsip") || base.includes("improvement") || base.includes("refine")) return "refinement";
  if (base.includes("mandate") || base.includes("task") || base.includes("plan")) return "planning";
  return "default";
}

function estimateTokens(
  renderedPrompt: string | undefined,
  outputs: Record<string, unknown>,
): { prompt: number; completion: number; total: number } {
  const promptTokens = renderedPrompt ? Math.max(24, Math.round(renderedPrompt.length / 4)) : 24;
  const completionTokens = Math.max(48, Math.round(JSON.stringify(outputs).length / 6));
  return {
    prompt: promptTokens,
    completion: completionTokens,
    total: promptTokens + completionTokens,
  };
}

function computeBenchmarks(promptSpec: PromptSpec, blocks: LangGraphRunBlock[]): BenchmarkSuite {
  const planned = promptSpec.nodes.length;
  const executed = blocks.filter((block) => Boolean(block.artifact)).length;
  const verificationBlocks = blocks.filter((block) => classifyNodeKind(block.id) === "verification");
  const verificationPasses = verificationBlocks.filter((block) => {
    const verdict = block.artifact?.outputs?.verdict;
    return verdict === undefined || verdict === "pass";
  }).length;

  const ssrRatio = planned === 0 ? 1 : executed / planned;
  const verificationRatio = verificationBlocks.length === 0 ? 1 : verificationPasses / verificationBlocks.length;

  const notes: string[] = [
    `Executed ${executed} of ${planned} planned nodes (SSR ${(ssrRatio * 100).toFixed(1)}%).`,
  ];
  if (verificationBlocks.length > 0) {
    notes.push(
      `Verification efficacy ${(verificationRatio * 100).toFixed(1)}% (${verificationPasses}/${verificationBlocks.length} verification nodes reported pass).`,
    );
  }
  if (blocks.some((block) => block.artifact?.metrics.confidence ?? 1 < 0.85)) {
    notes.push("One or more nodes fell below the preferred confidence threshold (0.85).");
  }

  return {
    computedAt: new Date().toISOString(),
    ssr: {
      label: "Step success rate",
      completed: executed,
      planned,
      ratio: Number(ssrRatio.toFixed(3)),
    },
    verificationEfficacy: {
      label: "Verification efficacy",
      completed: verificationPasses,
      planned: verificationBlocks.length,
      ratio: Number(verificationRatio.toFixed(3)),
    },
    notes,
  };
}

async function loadCompositionSnapshot(sourcePath?: string): Promise<CompositionSnapshot | undefined> {
  if (!sourcePath) return undefined;
  try {
    const fullPath = path.resolve(process.cwd(), "..", sourcePath);
    const raw = await fs.readFile(fullPath, "utf-8");
    const parsed = parse(raw) as Record<string, unknown>;
    const steps = Array.isArray(parsed?.steps)
      ? (parsed.steps as Array<Record<string, unknown>>)
          .map((step) => ({
            use: typeof step.use === "string" ? step.use : "",
            map: typeof step.map === "object" && step.map ? (step.map as Record<string, unknown>) : undefined,
            label: typeof step.label === "string" ? step.label : undefined,
            description: typeof step.description === "string" ? step.description : undefined,
          }))
          .filter((step) => step.use.length > 0)
      : [];
    const outputs = Array.isArray(parsed?.outputs)
      ? (parsed.outputs as Array<Record<string, unknown>>)
          .map((output) => ({
            name: typeof output.name === "string" ? output.name : "",
            expression: typeof output.expression === "string" ? output.expression : String(output.value ?? ""),
          }))
          .filter((output) => output.name.length > 0 || output.expression.length > 0)
      : undefined;
    return {
      id: typeof parsed?.id === "string" ? (parsed.id as string) : undefined,
      title: typeof parsed?.title === "string" ? (parsed.title as string) : undefined,
      description: typeof parsed?.description === "string" ? (parsed.description as string) : undefined,
      steps,
      outputs,
      sourcePath,
    };
  } catch (error) {
    console.warn(`[LangGraph] Failed to load composition from ${sourcePath}`, error);
    return undefined;
  }
}
