export interface MetricStats {
  count: number;
  mean: number;
  variance: number;
  standardDeviation: number;
  min: number;
  max: number;
  last: number;
}

export interface TokenMetricStats {
  prompt: MetricStats;
  completion: MetricStats;
  total: MetricStats;
}

export interface PromptMetricsSummary {
  promptId: string;
  promptName: string;
  runCount: number;
  lastRunId: string;
  lastUpdated: string;
  latency: MetricStats;
  tokens: TokenMetricStats;
}

export interface NodeMetric {
  nodeId: string;
  label: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExecutionMetrics {
  perNode: NodeMetric[];
  totals: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
