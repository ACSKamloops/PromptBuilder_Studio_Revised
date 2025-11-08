export type FlowEdgeKind = "default" | "branch" | "router" | "fallback";

export interface FlowEdgeGate {
  type: "reason.hybrid";
  branch: string;
  thresholds?: {
    maxComplexity?: number;
    maxTokens?: number;
    maxLatencyMs?: number;
  };
}

export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  kind?: FlowEdgeKind;
  condition?: string;
  branch?: string;
  gate?: FlowEdgeGate;
}

export interface FlowPreset {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  edges?: FlowEdge[];
  sourcePath?: string;
}
