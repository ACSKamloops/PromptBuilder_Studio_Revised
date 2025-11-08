import type { ProviderRunResult } from "@/server/providers";
import type { PromptMetricsSummary, MetricStats } from "@/types/run-metrics";
import type { RunRecord } from "@/types/run";

const MAX_RUNS = 50;

interface StatsAccumulator {
  count: number;
  mean: number;
  m2: number;
  min: number;
  max: number;
  last: number;
}

interface PromptLedgerState {
  promptId: string;
  promptName: string;
  latency: StatsAccumulator;
  promptTokens: StatsAccumulator;
  completionTokens: StatsAccumulator;
  totalTokens: StatsAccumulator;
  summary: PromptMetricsSummary | null;
  history: RunRecord[];
}

const recentRuns: RunRecord[] = [];
const promptLedgers = new Map<string, PromptLedgerState>();

export function recordRun(entry: ProviderRunResult): RunRecord {
  const promptId = entry.manifest.flow.id;
  const promptName = entry.manifest.flow.name;
  const ledger = ensureLedger(promptId, promptName);

  updateAccumulator(ledger.latency, entry.latencyMs);
  updateAccumulator(ledger.promptTokens, entry.usage.promptTokens);
  updateAccumulator(ledger.completionTokens, entry.usage.completionTokens);
  updateAccumulator(ledger.totalTokens, entry.usage.totalTokens);

  const summary = buildSummary(ledger, entry);
  ledger.summary = summary;

  const recorded = prepareRunRecord(entry, summary);

  ledger.history.unshift(recorded);
  if (ledger.history.length > MAX_RUNS) ledger.history.pop();

  recentRuns.unshift(recorded);
  if (recentRuns.length > MAX_RUNS) recentRuns.pop();

  return recorded;
}

export function listRuns(limit = MAX_RUNS): RunRecord[] {
  return recentRuns.slice(0, limit).map(cloneRunRecord);
}

export function listPromptRuns(promptId: string, limit = MAX_RUNS): RunRecord[] {
  const ledger = promptLedgers.get(promptId);
  if (!ledger) return [];
  return ledger.history.slice(0, limit).map(cloneRunRecord);
}

export function listPromptSummaries(): PromptMetricsSummary[] {
  return Array.from(promptLedgers.values())
    .map((ledger) => ledger.summary)
    .filter((summary): summary is PromptMetricsSummary => Boolean(summary))
    .map(cloneSummary);
}

export function getPromptSummary(promptId: string): PromptMetricsSummary | null {
  const ledger = promptLedgers.get(promptId);
  if (!ledger?.summary) return null;
  return cloneSummary(ledger.summary);
}

function ensureLedger(promptId: string, promptName: string): PromptLedgerState {
  const existing = promptLedgers.get(promptId);
  if (existing) {
    if (existing.promptName !== promptName) existing.promptName = promptName;
    return existing;
  }
  const state: PromptLedgerState = {
    promptId,
    promptName,
    latency: createAccumulator(),
    promptTokens: createAccumulator(),
    completionTokens: createAccumulator(),
    totalTokens: createAccumulator(),
    summary: null,
    history: [],
  };
  promptLedgers.set(promptId, state);
  return state;
}

function createAccumulator(): StatsAccumulator {
  return {
    count: 0,
    mean: 0,
    m2: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    last: 0,
  };
}

function updateAccumulator(accumulator: StatsAccumulator, value: number) {
  const nextCount = accumulator.count + 1;
  const delta = value - accumulator.mean;
  const mean = accumulator.mean + delta / nextCount;
  const delta2 = value - mean;
  const m2 = accumulator.count > 0 ? accumulator.m2 + delta * delta2 : 0;

  accumulator.count = nextCount;
  accumulator.mean = mean;
  accumulator.m2 = m2;
  accumulator.min = nextCount === 1 ? value : Math.min(accumulator.min, value);
  accumulator.max = nextCount === 1 ? value : Math.max(accumulator.max, value);
  accumulator.last = value;
}

function buildSummary(ledger: PromptLedgerState, entry: ProviderRunResult): PromptMetricsSummary {
  return {
    promptId: ledger.promptId,
    promptName: ledger.promptName,
    runCount: ledger.latency.count,
    lastRunId: entry.runId,
    lastUpdated: entry.completedAt,
    latency: toMetricStats(ledger.latency),
    tokens: {
      prompt: toMetricStats(ledger.promptTokens),
      completion: toMetricStats(ledger.completionTokens),
      total: toMetricStats(ledger.totalTokens),
    },
  };
}

function toMetricStats(accumulator: StatsAccumulator): MetricStats {
  if (accumulator.count === 0) {
    return {
      count: 0,
      mean: 0,
      variance: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
      last: 0,
    };
  }
  const variance = accumulator.count > 1 ? accumulator.m2 / (accumulator.count - 1) : 0;
  const standardDeviation = Math.sqrt(Math.max(variance, 0));
  return {
    count: accumulator.count,
    mean: accumulator.mean,
    variance,
    standardDeviation,
    min: accumulator.min,
    max: accumulator.max,
    last: accumulator.last,
  };
}

function prepareRunRecord(entry: ProviderRunResult, summary: PromptMetricsSummary): RunRecord {
  const summaryClone = cloneSummary(summary);
  return {
    ...entry,
    usage: { ...entry.usage },
    manifest: {
      ...entry.manifest,
      blocks: entry.manifest.blocks.map((block) => ({
        ...block,
        params: { ...block.params },
        output: {
          ...block.output,
          combinesWith: block.output.combinesWith ? [...block.output.combinesWith] : undefined,
          compositionSteps: block.output.compositionSteps ? [...block.output.compositionSteps] : undefined,
          paramsUsed: block.output.paramsUsed ? { ...block.output.paramsUsed } : undefined,
          psaReport: block.output.psaReport
            ? {
                ...block.output.psaReport,
                axes: [...block.output.psaReport.axes],
                recommendations: [...block.output.psaReport.recommendations],
              }
            : undefined,
        },
      })),
    },
    metrics: {
      perNode: entry.metrics.perNode.map((metric) => ({ ...metric })),
      totals: { ...entry.metrics.totals },
    },
    promptMetrics: summaryClone,
  };
}

function cloneRunRecord(record: RunRecord): RunRecord {
  return prepareRunRecord(record, record.promptMetrics);
}

function cloneSummary(summary: PromptMetricsSummary): PromptMetricsSummary {
  return {
    promptId: summary.promptId,
    promptName: summary.promptName,
    runCount: summary.runCount,
    lastRunId: summary.lastRunId,
    lastUpdated: summary.lastUpdated,
    latency: { ...summary.latency },
    tokens: {
      prompt: { ...summary.tokens.prompt },
      completion: { ...summary.tokens.completion },
      total: { ...summary.tokens.total },
    },
  };
}
