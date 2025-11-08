import { blockCatalog, type BlockDescriptor } from "@/data/block-catalog";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { PromptSpec, PromptSpecNode } from "@/lib/promptspec";
import type {
  AudioTimelinePayload,
  ModalityRequirement,
  ModalityState,
  PromptMetadata,
  SceneGraphPayload,
  VideoEventGraphPayload,
} from "@/types/prompt-metadata";
import { loadPromptLibrary } from "@/lib/load-prompts";

export type BlockVerdict = "accepted" | "revise" | "escalate";

export interface BlockTranscriptEntry {
  iteration: number;
  role: "proposer" | "verifier";
  content: string;
}

export interface BlockSelfCheck {
  iteration: number;
  label: string;
  status: "pass" | "needs_fix";
  note: string;
}

export interface BlockVerification {
  verdict: BlockVerdict;
  confidence: number;
  notes: string[];
  interventions: number;
}

export interface LangGraphRunBlockOutput {
  mode: "single-pass" | "recursive" | "sequential";
  iterations: number;
  maxIterations: number;
  proposal: string;
  final: string;
  history: BlockTranscriptEntry[];
  selfCheck?: BlockSelfCheck[];
  verifier: BlockVerification;
  artefacts: Record<string, unknown>;
  guidance?: string;
  failureModes?: string;
  acceptanceCriteria?: string;
  combinesWith?: string[];
  compositionSteps?: string[];
  paramsUsed?: Record<string, unknown>;
  note?: string;
}

export interface LangGraphRunBlock {
  id: string;
  block: string;
  params: Record<string, unknown>;
  output: LangGraphRunBlockOutput;
}

export interface BlockVerificationLedgerEntry {
  id: string;
  label: string;
  verdict: BlockVerdict;
  confidence: number;
  interventions: number;
}

export interface LangGraphVerificationSummary {
  totalInterventions: number;
  averageConfidence: number;
  blocks: BlockVerificationLedgerEntry[];
}

export interface LangGraphRunResult {
  runId: string;
  receivedAt: string;
  manifest: {
    flow: PromptSpec["flow"];
    nodeCount: number;
    edgeCount: number;
    blocks: LangGraphRunBlock[];
  };
  verification: LangGraphVerificationSummary;
  message: string;
}

interface NodeExecutionContext {
  node: PromptSpecNode;
  metadata?: PromptMetadata;
}

interface ModeConfig {
  mode: "single-pass" | "recursive" | "sequential";
  maxIterations: number;
}

const GraphState = Annotation.Root({
  iteration: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  proposal: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  feedback: Annotation<string[]>({
    reducer: (_left, right) => (Array.isArray(right) ? right : []),
    default: () => [],
  }),
  history: Annotation<BlockTranscriptEntry[]>({
    reducer: (left, right) => left.concat(right ?? []),
    default: () => [],
  }),
  selfChecks: Annotation<BlockSelfCheck[]>({
    reducer: (left, right) => left.concat(right ?? []),
    default: () => [],
  }),
  verdict: Annotation<BlockVerification | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  interventions: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  artefacts: Annotation<Record<string, unknown>>({
    reducer: (left, right) => mergeArtefacts(left, right ?? {}),
    default: () => ({}),
  }),
});

type GraphStateType = typeof GraphState.State;

type GraphUpdateType = typeof GraphState.Update;

export async function executeLangGraph(promptSpec: PromptSpec): Promise<LangGraphRunResult> {
  const runId = `langgraph-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const metadataList = await loadPromptLibrary();
  const metadataMap = new Map<string, PromptMetadata>(metadataList.map((item) => [item.id, item]));

  const outputs: LangGraphRunBlock[] = [];

  for (const node of promptSpec.nodes) {
    const metadata = node.metadataId ? metadataMap.get(node.metadataId) : undefined;
    const context: NodeExecutionContext = { node, metadata };
    const mode = resolveModeConfig(node);
    const finalState = await runNodeWithProposerVerifier(context, mode);
    const blockOutput = buildBlockOutput(context, mode, finalState);
    outputs.push({
      id: node.id,
      block: node.block,
      params: node.params,
      output: blockOutput,
    });
  }

  const verificationBlocks: BlockVerificationLedgerEntry[] = outputs.map((entry) => ({
    id: entry.id,
    label: entry.block,
    verdict: entry.output.verifier.verdict,
    confidence: entry.output.verifier.confidence,
    interventions: entry.output.verifier.interventions,
  }));
  const totalInterventions = verificationBlocks.reduce((sum, item) => sum + item.interventions, 0);
  const averageConfidence =
    verificationBlocks.length === 0
      ? 0
      : verificationBlocks.reduce((sum, item) => sum + item.confidence, 0) / verificationBlocks.length;

  return {
    runId,
    receivedAt: timestamp,
    manifest: {
      flow: promptSpec.flow,
      nodeCount: promptSpec.nodes.length,
      edgeCount: promptSpec.edges.length,
      blocks: outputs,
    },
    verification: {
      totalInterventions,
      averageConfidence,
      blocks: verificationBlocks,
    },
    message:
      "Executed proposer/verifier LangGraph with intrinsic self-check logging. Replace stubs with live model calls when available.",
  };
}

async function runNodeWithProposerVerifier(
  context: NodeExecutionContext,
  mode: ModeConfig,
): Promise<GraphStateType> {
  const graph = new StateGraph(GraphState);

  graph.addNode("propose", async (state: GraphStateType): Promise<GraphUpdateType> => {
    const iteration = (state.iteration ?? 0) + 1;
    const guidance = context.metadata?.acceptance_criteria ?? context.metadata?.when_to_use ?? "";
    const paramsSummary = formatParams(context.node.params);
    const feedback = state.feedback ?? [];
    const revisionLine = feedback.length > 0 ? `Addressing verifier requests: ${feedback.join("; ")}.` : "";
    const draft = [
      `Iteration ${iteration} proposal for ${context.node.block}.`,
      paramsSummary ? `Inputs observed: ${paramsSummary}.` : "",
      guidance ? `Acceptance cues: ${sanitizeWhitespace(guidance)}.` : "",
      revisionLine,
    ]
      .filter(Boolean)
      .join(" \n");

    return {
      iteration,
      proposal: draft,
      history: [
        {
          iteration,
          role: "proposer",
          content: draft,
        },
      ],
      artefacts: {
        drafts: [
          {
            iteration,
            content: draft,
          },
        ],
      },
    };
  });

  graph.addNode("verify", async (state: GraphStateType): Promise<GraphUpdateType> => {
    const iteration = state.iteration ?? 1;
    const criteria = deriveCriteria(context);
    const needsRevision = mode.mode === "recursive" && iteration < mode.maxIterations;
    const notes: string[] = [];

    if (needsRevision) {
      notes.push(
        "Expand supporting detail for the lead criterion and mark fixes explicitly before finalising.",
      );
    } else {
      notes.push("Draft satisfies stated criteria; confirming readiness to finalize.");
    }

    const feedback = needsRevision
      ? ["Add specific evidence for the top criterion and annotate with `[Fix 1.x]` markers."]
      : [];

    const selfChecks = mode.mode === "single-pass"
      ? buildSelfChecks(criteria, iteration, needsRevision)
      : [];

    const interventions = (state.interventions ?? 0) + (needsRevision ? 1 : 0);
    const verdict: BlockVerification = {
      verdict: needsRevision ? "revise" : "accepted",
      confidence: needsRevision ? 0.45 : 0.82 + Math.min(0.1, (iteration - 1) * 0.05),
      notes,
      interventions,
    };

    const reviewEntry: BlockTranscriptEntry = {
      iteration,
      role: "verifier",
      content: `${verdict.verdict.toUpperCase()} — ${notes.join(" ")}`,
    };

    const artefactUpdate: Record<string, unknown> = {
      reviews: [
        {
          iteration,
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          notes,
        },
      ],
    };
    if (selfChecks.length > 0) {
      artefactUpdate.selfChecks = selfChecks;
    }

    return {
      verdict,
      feedback,
      interventions,
      history: [reviewEntry],
      selfChecks,
      artefacts: artefactUpdate,
    };
  });

  graph.addEdge(START, "propose");
  graph.addEdge("propose", "verify");
  graph.addConditionalEdges("verify", async (state: GraphStateType) => {
    const verdict = state.verdict;
    const iteration = state.iteration ?? 1;
    const shouldContinue =
      mode.mode !== "single-pass" && verdict?.verdict === "revise" && iteration < mode.maxIterations;
    return shouldContinue ? "propose" : END;
  });

  const app = graph.compile();
  return app.invoke({
    iteration: 0,
    proposal: "",
    feedback: [],
    history: [],
    selfChecks: [],
    verdict: undefined,
    interventions: 0,
    artefacts: {},
  });
}

function buildBlockOutput(
  context: NodeExecutionContext,
  mode: ModeConfig,
  state: GraphStateType,
): LangGraphRunBlockOutput {
  const history = state.history ?? [];
  const finalProposal = state.proposal ?? "";
  const iterations = state.iteration ?? history.filter((entry) => entry.role === "proposer").length;
  const descriptor = resolveDescriptorForNode(context.node);
  const { normalized, warnings } = validateAndNormalizeModalities(
    context.metadata?.modalities ?? descriptor?.modalities,
    (context.node.params as { modalities?: unknown })?.modalities,
  );
  const paramsUsed = {
    ...context.node.params,
    ...(normalized ? { modalities: normalized } : {}),
  };
  const noteSegments = [
    mode.mode === "single-pass"
      ? "SPOC single-pass self-check complete."
      : mode.mode === "recursive"
        ? "RSIP iterative refinement complete."
        : "Proposer/verifier pass complete.",
  ];
  if (warnings.length > 0) {
    noteSegments.push(warnings.join(" | "));
  }

  return {
    mode: mode.mode,
    iterations,
    maxIterations: mode.maxIterations,
    proposal: history.find((entry) => entry.role === "proposer")?.content ?? "",
    final: finalProposal,
    history,
    selfCheck: state.selfChecks && state.selfChecks.length > 0 ? state.selfChecks : undefined,
    verifier:
      state.verdict ?? {
        verdict: "accepted",
        confidence: 0.75,
        notes: ["No explicit verifier notes recorded."],
        interventions: state.interventions ?? 0,
      },
    artefacts: state.artefacts ?? {},
    guidance: context.metadata?.when_to_use,
    failureModes: context.metadata?.failure_modes,
    acceptanceCriteria: context.metadata?.acceptance_criteria,
    combinesWith: context.metadata?.combines_with,
    compositionSteps: context.metadata?.composition_steps,
    paramsUsed,
    note: noteSegments.join(" "),
  };
}

function resolveModeConfig(node: PromptSpecNode): ModeConfig {
  const baseId = (node.metadataId ?? node.id).toLowerCase();
  if (baseId.includes("spoc")) {
    return { mode: "single-pass", maxIterations: 1 };
  }
  if (baseId.includes("recursive-self-improvement") || baseId.includes("rsip")) {
    const explicit = Number.parseInt(String(node.params?.max_passes ?? ""), 10);
    const maxIterations = Number.isFinite(explicit) && explicit > 0 ? Math.min(explicit, 6) : 3;
    return { mode: "recursive", maxIterations };
  }
  return { mode: "sequential", maxIterations: 1 };
}

function mergeArtefacts(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const existing = result[key];
    if (Array.isArray(existing) && Array.isArray(value)) {
      result[key] = [...existing, ...value];
    } else if (
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = { ...(existing as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.length > 0)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.join(", ");
}

function sanitizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function deriveCriteria(context: NodeExecutionContext): string[] {
  const explicit = typeof context.node.params?.success_criteria === "string"
    ? context.node.params.success_criteria
    : undefined;
  const raw = explicit ?? context.metadata?.acceptance_criteria ?? context.metadata?.when_to_use ?? "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•\d.]+\s*/, ""))
    .filter((line) => line.length > 0);
}

function buildSelfChecks(
  criteria: string[],
  iteration: number,
  needsRevision: boolean,
): BlockSelfCheck[] {
  if (criteria.length === 0) {
    return [
      {
        iteration,
        label: "General consistency",
        status: needsRevision ? "needs_fix" : "pass",
        note: needsRevision ? "Needs another pass before finalising." : "No issues detected during self-check.",
      },
    ];
  }
  return criteria.map((criterion, index) => ({
    iteration,
    label: criterion,
    status: needsRevision && index === 0 ? "needs_fix" : "pass",
    note:
      needsRevision && index === 0
        ? "Criterion still missing explicit evidence."
        : "Covered during SPOC self-check.",
  }));
}

function resolveDescriptorForNode(node: PromptSpecNode): BlockDescriptor | undefined {
  const baseId = node.id.includes("#") ? node.id.split("#")[0] : node.id;
  return blockCatalog.find((entry) => entry.id === baseId);
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
            warnings.push(`Ignored malformed event at index ${index}.`);
            return undefined;
          }
          const id = typeof (event as { id?: unknown }).id === "string"
            ? (event as { id: string }).id
            : `event-${index + 1}`;
          const label = typeof (event as { label?: unknown }).label === "string"
            ? (event as { label: string }).label
            : `Event ${index + 1}`;
          const timecode = coerceNumber((event as { timecode?: unknown }).timecode);
          const metadata =
            (event as { metadata?: unknown }).metadata && typeof (event as { metadata?: unknown }).metadata === "object"
              ? ((event as { metadata?: Record<string, unknown> }).metadata ?? undefined)
              : undefined;
          return {
            id,
            label,
            timecode: timecode ?? index * 5,
            metadata,
          } satisfies VideoEventGraphPayload["events"][number];
        })
        .filter((event): event is VideoEventGraphPayload["events"][number] => event !== undefined)
    : [];

  const edges = Array.isArray(candidate.edges)
    ? candidate.edges
        .map((edge, index) => {
          if (!edge || typeof edge !== "object") {
            warnings.push(`Ignored malformed edge at index ${index}.`);
            return undefined;
          }
          const from = typeof (edge as { from?: unknown }).from === "string" ? (edge as { from: string }).from : "";
          const to = typeof (edge as { to?: unknown }).to === "string" ? (edge as { to: string }).to : "";
          if (!from || !to || from === to) {
            warnings.push(`Edge ${index + 1} must specify distinct from/to.`);
            return undefined;
          }
          return {
            id:
              typeof (edge as { id?: unknown }).id === "string"
                ? (edge as { id: string }).id
                : `edge-${index + 1}`,
            from,
            to,
            relation:
              typeof (edge as { relation?: unknown }).relation === "string"
                ? (edge as { relation: string }).relation
                : undefined,
          } satisfies VideoEventGraphPayload["edges"][number];
        })
        .filter((edge): edge is VideoEventGraphPayload["edges"][number] => edge !== undefined)
    : [];

  if (events.length === 0) {
    warnings.push("Video event graph has no events.");
  }

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
          return {
            id:
              typeof (node as { id?: unknown }).id === "string"
                ? (node as { id: string }).id
                : `node-${index + 1}`,
            label:
              typeof (node as { label?: unknown }).label === "string"
                ? (node as { label: string }).label
                : `Node ${index + 1}`,
            type:
              typeof (node as { type?: unknown }).type === "string"
                ? (node as { type: string }).type
                : undefined,
            properties:
              (node as { properties?: unknown }).properties && typeof (node as { properties?: unknown }).properties === "object"
                ? ((node as { properties?: Record<string, unknown> }).properties ?? undefined)
                : undefined,
          } satisfies SceneGraphPayload["nodes"][number];
        })
        .filter((node): node is SceneGraphPayload["nodes"][number] => node !== undefined)
    : [];

  const relationships = Array.isArray(candidate.relationships)
    ? candidate.relationships
        .map((relationship, index) => {
          if (!relationship || typeof relationship !== "object") {
            warnings.push(`Ignored malformed relationship at index ${index}.`);
            return undefined;
          }
          const from = typeof (relationship as { from?: unknown }).from === "string"
            ? (relationship as { from: string }).from
            : "";
          const to = typeof (relationship as { to?: unknown }).to === "string"
            ? (relationship as { to: string }).to
            : "";
          const relation =
            typeof (relationship as { relation?: unknown }).relation === "string"
              ? (relationship as { relation: string }).relation
              : "";
          if (!from || !to || !relation) {
            warnings.push(`Relationship ${index + 1} is missing from/to/relation.`);
            return undefined;
          }
          return {
            id:
              typeof (relationship as { id?: unknown }).id === "string"
                ? (relationship as { id: string }).id
                : `relationship-${index + 1}`,
            from,
            to,
            relation,
          } satisfies SceneGraphPayload["relationships"][number];
        })
        .filter((relationship): relationship is SceneGraphPayload["relationships"][number] => relationship !== undefined)
    : [];

  if (nodes.length === 0) {
    warnings.push("Scene graph has no nodes.");
  }

  return {
    value: { nodes, relationships },
    warnings,
  };
}

function coerceNumber(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number.parseFloat(input);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

interface NormalizationResult<T> {
  value?: T;
  warnings: string[];
}
