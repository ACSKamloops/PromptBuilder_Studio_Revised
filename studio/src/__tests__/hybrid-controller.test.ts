import { describe, expect, it } from "vitest";
import type { PromptSpec } from "@/lib/promptspec";
import { evaluateHybridDecision, computeFlowComplexity } from "@/lib/runtime/hybrid-controller";

const makeSpec = (overrides?: Partial<PromptSpec>): PromptSpec =>
  ({
    version: "promptspec/v1",
    flow: { id: "test", name: "Test", description: "" },
    nodes: [
      { id: "system", block: "System", type: "system", params: {}, metadataId: "system" },
      { id: "reason.hybrid", block: "Hybrid Router", type: "reason.hybrid", params: {}, metadataId: "reason.hybrid" },
      { id: "analysis", block: "Analysis", type: "prompt", params: {}, metadataId: "analysis" },
    ],
    edges: [
      { from: "system", to: "reason.hybrid" },
      {
        from: "reason.hybrid",
        to: "analysis",
        kind: "branch",
        branch: "fast",
        gate: { type: "reason.hybrid", branch: "fast", thresholds: { maxComplexity: 10 } },
      },
    ],
    ...overrides,
  }) as PromptSpec;

describe("hybrid controller", () => {
  it("prefers fast branch when heuristics are under thresholds", () => {
    const spec = makeSpec();
    const decision = evaluateHybridDecision(spec, 1);
    expect(decision.selectedBranch).toBe("fast");
    expect(decision.metrics.complexityScore).toBeGreaterThan(0);
  });

  it("honours deliberate complexity gate override", () => {
    const spec = makeSpec({
      edges: [
        { from: "system", to: "reason.hybrid" },
        {
          from: "reason.hybrid",
          to: "analysis",
          kind: "branch",
          branch: "fast",
          gate: { type: "reason.hybrid", branch: "fast", thresholds: { maxComplexity: 1 } },
        },
        {
          from: "reason.hybrid",
          to: "analysis",
          kind: "branch",
          branch: "deliberate",
          gate: { type: "reason.hybrid", branch: "deliberate", thresholds: { maxComplexity: 1 } },
        },
      ],
      nodes: [
        { id: "system", block: "System", type: "system", params: {}, metadataId: "system" },
        { id: "reason.hybrid", block: "Hybrid Router", type: "reason.hybrid", params: {}, metadataId: "reason.hybrid" },
        { id: "analysis", block: "Analysis", type: "prompt", params: {}, metadataId: "analysis" },
      ],
    });
    spec.nodes[1].params = { complexityGate: "deliberate" };
    const decision = evaluateHybridDecision(spec, 1);
    expect(decision.selectedBranch).toBe("deliberate");
    expect(decision.rationale).toMatch(/complexity/i);
  });

  it("computes flow complexity deterministically", () => {
    const spec = makeSpec();
    const score = computeFlowComplexity(spec);
    expect(score).toBeGreaterThan(0);
  });
});
