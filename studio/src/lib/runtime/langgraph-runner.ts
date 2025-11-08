import { blockCatalog } from "@/data/block-catalog";
import type { PromptSpec } from "@/lib/promptspec";
import type {
  AudioTimelinePayload,
  ModalityRequirement,
  ModalityState,
  PromptMetadata,
  SceneGraphPayload,
  VideoEventGraphPayload,
} from "@/types/prompt-metadata";
import type { ExecutionMetrics, NodeMetric } from "@/types/run-metrics";
import { loadPromptLibrary } from "@/lib/load-prompts";
import { RunnableLambda } from "@langchain/core/runnables";

export interface PsaReport {
  baselinePreview: string;
  sampleSize: number;
  axes: string[];
  stabilityScore: number;
  variance: number;
  confidenceBand: number;
  threshold: number;
  autopromptReady: boolean;
  summary: string;
  recommendations: string[];
}

export interface LangGraphRunBlockOutput {
  flowSummary?: string;
  guidance?: string;
  failureModes?: string;
  acceptanceCriteria?: string;
  combinesWith?: string[];
  compositionSteps?: string[];
  paramsUsed?: Record<string, unknown>;
  note?: string;
  psaReport?: PsaReport;
}

export interface LangGraphRunBlock {
  id: string;
  block: string;
  params: Record<string, unknown>;
  output: LangGraphRunBlockOutput;
}

export interface LangGraphRunResult {
  runId: string;
  receivedAt: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  manifest: {
    flow: PromptSpec["flow"];
    nodeCount: number;
    edgeCount: number;
    blocks: LangGraphRunBlock[];
  };
  metrics: ExecutionMetrics;
  message: string;
}

export async function executeLangGraph(promptSpec: PromptSpec): Promise<LangGraphRunResult> {
  const runId = `langgraph-${Date.now()}`;
  const receivedAt = new Date();

  const metadataList = await loadPromptLibrary();
  const metadataMap = new Map<string, PromptMetadata>(metadataList.map((item) => [item.id, item]));

  const runnable = buildRunnableFromSpec(promptSpec, metadataMap);
  const outputs: LangGraphRunBlock[] = [];
  const perNodeMetrics: NodeMetric[] = [];
  const runStarted = Date.now();

  for (const node of promptSpec.nodes) {
    const nodeStarted = Date.now();
    const result = await runnable.invoke({ node });
    const latencyMs = Date.now() - nodeStarted;
    const nodeTokens = estimateNodeTokens(node);

    perNodeMetrics.push({
      nodeId: node.id,
      label: node.block,
      latencyMs,
      promptTokens: nodeTokens.prompt,
      completionTokens: nodeTokens.completion,
      totalTokens: nodeTokens.prompt + nodeTokens.completion,
    });

    outputs.push({
      id: node.id,
      block: node.block,
      params: node.params,
      output: result,
    });
  }

  const runCompleted = Date.now();
  const totals = perNodeMetrics.reduce(
    (acc, metric) => {
      acc.promptTokens += metric.promptTokens;
      acc.completionTokens += metric.completionTokens;
      acc.totalTokens += metric.totalTokens;
      acc.latencyMs += metric.latencyMs;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0 },
  );

  const metrics: ExecutionMetrics = {
    perNode: perNodeMetrics,
    totals,
  };

  return {
    runId,
    receivedAt: receivedAt.toISOString(),
    startedAt: new Date(runStarted).toISOString(),
    completedAt: new Date(runCompleted).toISOString(),
    latencyMs: runCompleted - runStarted,
    manifest: {
      flow: promptSpec.flow,
      nodeCount: promptSpec.nodes.length,
      edgeCount: promptSpec.edges.length,
      blocks: outputs,
    },
    metrics,
    message: "Executed via LangGraph runnable stub. Replace with a full graph runtime to call real models.",
  };
}

function buildRunnableFromSpec(
  promptSpec: PromptSpec,
  metadataMap: Map<string, PromptMetadata>,
) {
  const flowSummary = `${promptSpec.flow.name} (${promptSpec.nodes.length} nodes)`;
  return RunnableLambda.from<{ node: PromptSpec["nodes"][number] }, LangGraphRunBlockOutput>(
    async ({ node }) => {
      const metadata = node.metadataId ? metadataMap.get(node.metadataId) : undefined;
      const rawModalities = (node.params as { modalities?: unknown }).modalities;
      const descriptor = blockCatalog.find((block) => block.id === node.id);
      const { normalized, warnings } = validateAndNormalizeModalities(
        metadata?.modalities ?? descriptor?.modalities,
        rawModalities,
      );
      const paramsUsed = {
        ...node.params,
        ...(normalized ? { modalities: normalized } : {}),
      };
      const noteSegments = [`Stubbed execution for ${node.block}`];
      if (warnings.length > 0) {
        noteSegments.push(warnings.join(" | "));
      }

      const baseOutput: LangGraphRunBlockOutput = {
        flowSummary,
        guidance: metadata?.when_to_use,
        failureModes: metadata?.failure_modes,
        acceptanceCriteria: metadata?.acceptance_criteria,
        combinesWith: metadata?.combines_with,
        compositionSteps: metadata?.composition_steps,
        paramsUsed,
        note: noteSegments.join(" — "),
      };

      if (node.metadataId === "psa-sweep" || node.id === "psa") {
        return {
          ...baseOutput,
          note: "Simulated prompt sensitivity analysis complete.",
          psaReport: buildPsaReport(node),
        };
      }

      return baseOutput;
    },
  );
}

function estimateNodeTokens(node: PromptSpec["nodes"][number]) {
  const serialized = JSON.stringify(node.params ?? {});
  const promptEstimate = Math.max(8, Math.round(serialized.length / 3));
  const complexityBoost = node.block.length * 2;
  const promptTokens = promptEstimate + complexityBoost;
  const completionTokens = Math.max(32, Math.round(promptTokens * 0.6));
  return { prompt: promptTokens, completion: completionTokens };
}

function buildPsaReport(node: PromptSpec["nodes"][number]): PsaReport {
  const params = node.params ?? {};
  const baseline = typeof params.baseline_prompt === "string" ? params.baseline_prompt : "";
  const axesParam = params.perturbation_axes;
  const axes = Array.isArray(axesParam)
    ? axesParam
        .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
        .filter((value) => value.length > 0)
    : [];
  const batchSizeRaw = params.batch_size;
  const sampleSize = Number.isFinite(Number(batchSizeRaw))
    ? Math.max(1, Number(batchSizeRaw))
    : 24;
  const thresholdRaw = params.stability_threshold;
  const threshold = Number.isFinite(Number(thresholdRaw)) ? Number(thresholdRaw) : 0.85;

  const baselineLengthFactor = Math.min(0.28, baseline.length / 1200);
  const axisPenalty = axes.length * 0.035;
  const baseScore = 0.92 - baselineLengthFactor - axisPenalty + Math.min(0.04, sampleSize / 600);
  const stabilityScore = Math.max(0.45, Math.min(0.99, Number(baseScore.toFixed(3))));
  const variance = Number(((1 - stabilityScore) * 0.14 + axisPenalty / 2).toFixed(4));
  const confidenceBand = Number((Math.sqrt(Math.max(variance, 0)) * 1.96).toFixed(4));
  const autopromptReady = stabilityScore < threshold;

  const summary =
    `Executed ${sampleSize} perturbations across ${axes.length || 0} axes. ` +
    `Observed stability score ${(stabilityScore * 100).toFixed(1)}% with variance ${(variance * 100).toFixed(2)}%.`;

  const recommendations: string[] = [];
  if (autopromptReady) {
    recommendations.push("Trigger AutoPrompt optimisation to tighten guardrails.");
    recommendations.push("Focus on the highest variance axis first for rewrite suggestions.");
  } else {
    recommendations.push("Current prompt meets the configured stability threshold.");
    if (axes.length > 0) {
      recommendations.push("Monitor the callout axes for drift weekly.");
    }
  }

  return {
    baselinePreview:
      baseline.length > 160 ? `${baseline.slice(0, 160)}…` : baseline || "(baseline prompt not provided)",
    sampleSize,
    axes,
    stabilityScore,
    variance,
    confidenceBand,
    threshold,
    autopromptReady,
    summary,
    recommendations,
  };
}

interface NormalizationResult<T> {
  value?: T;
  warnings: string[];
}

function validateAndNormalizeModalities(
  requirements: ModalityRequirement[] | undefined,
  provided: unknown,
): { normalized?: ModalityState; warnings: string[] } {
  if (!requirements?.length) {
    if (provided && typeof provided === "object") {
      return { normalized: provided as ModalityState, warnings: [] };
    }
    return { warnings: [] };
  }

  const state: ModalityState = provided && typeof provided === "object" ? (provided as ModalityState) : {};
  const normalized: ModalityState = {};
  const warnings: string[] = [];

  for (const requirement of requirements) {
    const modalityState =
      (state?.[requirement.modality] as Record<string, unknown> | undefined) ?? {};

    for (const payload of requirement.payloads) {
      const rawValue = modalityState[payload.type];
      const normalisedPayload = normalizePayload(payload.type, rawValue);
      if (!normalisedPayload.value) {
        if (payload.required !== false) {
          warnings.push(
            `Missing ${payload.label} for ${requirement.label ?? requirement.modality}.`,
          );
        }
        if (rawValue !== undefined && normalisedPayload.warnings.length > 0) {
          warnings.push(...normalisedPayload.warnings);
        }
        continue;
      }

      if (!normalized[requirement.modality]) {
        normalized[requirement.modality] = {};
      }
      normalized[requirement.modality]![payload.type] = normalisedPayload.value;
      if (normalisedPayload.warnings.length > 0) {
        warnings.push(...normalisedPayload.warnings);
      }
    }
  }

  return {
    normalized: Object.keys(normalized).length > 0 ? normalized : undefined,
    warnings,
  };
}

function normalizePayload(
  type: string,
  value: unknown,
): NormalizationResult<AudioTimelinePayload | VideoEventGraphPayload | SceneGraphPayload> {
  switch (type) {
    case "audio_timeline":
      return normalizeAudioTimeline(value);
    case "video_event_graph":
      return normalizeVideoEventGraph(value);
    case "scene_graph":
      return normalizeSceneGraph(value);
    default:
      return { warnings: [] };
  }
}

function normalizeAudioTimeline(value: unknown): NormalizationResult<AudioTimelinePayload> {
  if (!value || typeof value !== "object") {
    return { warnings: ["Audio timeline payload was not provided."] };
  }
  const candidate = value as Partial<AudioTimelinePayload>;
  const warnings: string[] = [];

  const annotations = Array.isArray(candidate.annotations)
    ? candidate.annotations
        .map((annotation, index) => {
          if (!annotation || typeof annotation !== "object") {
            warnings.push(`Ignored malformed audio annotation at index ${index}.`);
            return undefined;
          }
          const start = coerceNumber((annotation as { start?: unknown }).start);
          const end = coerceNumber((annotation as { end?: unknown }).end) ?? start;
          if (start === undefined || end === undefined) {
            warnings.push(`Annotation ${index + 1} is missing start/end timestamps.`);
            return undefined;
          }
          const safeEnd = end >= start ? end : start;
          const labelCandidate = (annotation as { label?: unknown }).label;
          const idCandidate = (annotation as { id?: unknown }).id;
          return {
            id:
              typeof idCandidate === "string" && idCandidate.trim().length > 0
                ? idCandidate
                : `marker-${index + 1}`,
            label:
              typeof labelCandidate === "string" && labelCandidate.trim().length > 0
                ? labelCandidate
                : `Marker ${index + 1}`,
            start,
            end: safeEnd,
          } satisfies AudioTimelinePayload["annotations"][number];
        })
        .filter((annotation): annotation is AudioTimelinePayload["annotations"][number] =>
          annotation !== undefined,
        )
        .sort((a, b) => a.start - b.start)
    : [];

  const source =
    candidate.source && typeof candidate.source === "object"
      ? {
          name:
            typeof (candidate.source as { name?: unknown }).name === "string"
              ? ((candidate.source as { name: string }).name ?? "")
              : "audio-source",
          size: coerceNumber((candidate.source as { size?: unknown }).size),
          type:
            typeof (candidate.source as { type?: unknown }).type === "string"
              ? ((candidate.source as { type: string }).type ?? undefined)
              : undefined,
          dataUrl:
            typeof (candidate.source as { dataUrl?: unknown }).dataUrl === "string"
              ? ((candidate.source as { dataUrl: string }).dataUrl ?? undefined)
              : undefined,
          durationSeconds: coerceNumber(
            (candidate.source as { durationSeconds?: unknown }).durationSeconds,
          ),
        }
      : undefined;

  if (annotations.length === 0) {
    warnings.push("Audio timeline has no annotations.");
  }

  return {
    value: { source, annotations },
    warnings,
  };
}

function normalizeVideoEventGraph(value: unknown): NormalizationResult<VideoEventGraphPayload> {
  if (!value || typeof value !== "object") {
    return { warnings: ["Video event graph payload was not provided."] };
  }

  const candidate = value as Partial<VideoEventGraphPayload>;
  const warnings: string[] = [];

  const events = Array.isArray(candidate.events)
    ? candidate.events
        .map((event, index) => {
          if (!event || typeof event !== "object") {
            warnings.push(`Ignored malformed video event at index ${index}.`);
            return undefined;
          }
          const idCandidate = (event as { id?: unknown }).id;
          const labelCandidate = (event as { label?: unknown }).label;
          const timecode = coerceNumber((event as { timecode?: unknown }).timecode);
          const metadataCandidate = (event as { metadata?: unknown }).metadata;
          return {
            id:
              typeof idCandidate === "string" && idCandidate.trim().length > 0
                ? idCandidate
                : `event-${index + 1}`,
            label:
              typeof labelCandidate === "string" && labelCandidate.trim().length > 0
                ? labelCandidate
                : `Event ${index + 1}`,
            timecode: timecode ?? index,
            metadata:
              metadataCandidate && typeof metadataCandidate === "object"
                ? (metadataCandidate as Record<string, unknown>)
                : undefined,
          } satisfies VideoEventGraphPayload["events"][number];
        })
        .filter((event): event is VideoEventGraphPayload["events"][number] => event !== undefined)
    : [];

  const eventIds = new Set(events.map((event) => event.id));

  const edges = Array.isArray(candidate.edges)
    ? candidate.edges
        .map((edge, index) => {
          if (!edge || typeof edge !== "object") {
            warnings.push(`Ignored malformed event edge at index ${index}.`);
            return undefined;
          }
          const from = (edge as { from?: unknown }).from;
          const to = (edge as { to?: unknown }).to;
          if (typeof from !== "string" || typeof to !== "string" || !eventIds.has(from) || !eventIds.has(to)) {
            warnings.push(`Edge ${index + 1} references missing events.`);
            return undefined;
          }
          const relationCandidate = (edge as { relation?: unknown }).relation;
          const idCandidate = (edge as { id?: unknown }).id;
          return {
            id:
              typeof idCandidate === "string" && idCandidate.trim().length > 0
                ? idCandidate
                : `edge-${index + 1}`,
            from,
            to,
            relation:
              typeof relationCandidate === "string" && relationCandidate.trim().length > 0
                ? relationCandidate
                : undefined,
          } satisfies VideoEventGraphPayload["edges"][number];
        })
        .filter((edge): edge is VideoEventGraphPayload["edges"][number] => edge !== undefined)
    : [];

  return {
    value: { events, edges },
    warnings,
  };
}

function normalizeSceneGraph(value: unknown): NormalizationResult<SceneGraphPayload> {
  if (!value || typeof value !== "object") {
    return { warnings: ["Scene graph payload was not provided."] };
  }

  const candidate = value as Partial<SceneGraphPayload>;
  const warnings: string[] = [];

  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes
        .map((node, index) => {
          if (!node || typeof node !== "object") {
            warnings.push(`Ignored malformed scene node at index ${index}.`);
            return undefined;
          }
          const idCandidate = (node as { id?: unknown }).id;
          const labelCandidate = (node as { label?: unknown }).label;
          const typeCandidate = (node as { type?: unknown }).type;
          const propertiesCandidate = (node as { properties?: unknown }).properties;
          const properties =
            propertiesCandidate && typeof propertiesCandidate === "object"
              ? (propertiesCandidate as Record<string, unknown>)
              : typeof propertiesCandidate === "string"
                ? { raw: propertiesCandidate }
                : undefined;
          return {
            id:
              typeof idCandidate === "string" && idCandidate.trim().length > 0
                ? idCandidate
                : `node-${index + 1}`,
            label:
              typeof labelCandidate === "string" && labelCandidate.trim().length > 0
                ? labelCandidate
                : `Node ${index + 1}`,
            type: typeof typeCandidate === "string" ? typeCandidate : undefined,
            properties,
          } satisfies SceneGraphPayload["nodes"][number];
        })
        .filter((node): node is SceneGraphPayload["nodes"][number] => node !== undefined)
    : [];

  const nodeIds = new Set(nodes.map((node) => node.id));

  const relationships = Array.isArray(candidate.relationships)
    ? candidate.relationships
        .map((relationship, index) => {
          if (!relationship || typeof relationship !== "object") {
            warnings.push(`Ignored malformed scene relationship at index ${index}.`);
            return undefined;
          }
          const from = (relationship as { from?: unknown }).from;
          const to = (relationship as { to?: unknown }).to;
          const relationCandidate = (relationship as { relation?: unknown }).relation;
          if (
            typeof from !== "string" ||
            typeof to !== "string" ||
            typeof relationCandidate !== "string" ||
            relationCandidate.trim().length === 0 ||
            !nodeIds.has(from) ||
            !nodeIds.has(to)
          ) {
            warnings.push(`Relationship ${index + 1} is incomplete or references missing nodes.`);
            return undefined;
          }
          const idCandidate = (relationship as { id?: unknown }).id;
          return {
            id:
              typeof idCandidate === "string" && idCandidate.trim().length > 0
                ? idCandidate
                : `rel-${index + 1}`,
            from,
            to,
            relation: relationCandidate,
          } satisfies SceneGraphPayload["relationships"][number];
        })
        .filter(
          (relationship): relationship is SceneGraphPayload["relationships"][number] =>
            relationship !== undefined,
        )
    : [];

  return {
    value: { nodes, relationships },
    warnings,
  };
}

function coerceNumber(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number.parseFloat(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
