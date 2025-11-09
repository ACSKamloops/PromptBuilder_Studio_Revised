import { describe, expect, it } from "vitest";
import { buildPromptSpec } from "@/lib/promptspec";
import type { FlowPreset } from "@/types/flow";
import type { PromptMetadata } from "@/types/prompt-metadata";

const makeMetadata = (id: string): PromptMetadata => ({
  id,
  title: id,
  description: "",
  category: "structure",
  tags: [],
  when_to_use: "",
  failure_modes: "",
  acceptance_criteria: "",
  combines_with: [],
  composition_steps: [],
  relativePath: `${id}.yaml`,
  kind: "prompt",
});

describe("buildPromptSpec", () => {
  const metadataMap = new Map<string, PromptMetadata>([
    ["system", makeMetadata("system")],
    ["reason.hybrid", makeMetadata("reason.hybrid")],
    ["analysis", makeMetadata("analysis")],
  ]);

  it("maps preset edges when they are valid", () => {
    const preset: FlowPreset = {
      id: "flow-1",
      name: "Flow 1",
      description: "",
      nodeIds: ["system", "reason.hybrid", "analysis"],
      edges: [
        { source: "system", target: "reason.hybrid", label: "handoff" },
        { source: "reason.hybrid", target: "analysis", kind: "branch", branch: "fast" },
      ],
    };
    const spec = buildPromptSpec(preset, {}, metadataMap);
    expect(spec.edges).toHaveLength(2);
    expect(spec.edges[0]).toMatchObject({ from: "system", to: "reason.hybrid", label: "handoff" });
    expect(spec.edges[1]).toMatchObject({ from: "reason.hybrid", to: "analysis", kind: "branch" });
  });

  it("falls back to linear edges when preset edges are invalid", () => {
    const preset: FlowPreset = {
      id: "flow-2",
      name: "Flow 2",
      description: "",
      nodeIds: ["system", "analysis"],
      edges: [
        { source: "system", target: "missing" },
      ],
    };
    const spec = buildPromptSpec(preset, {}, metadataMap);
    expect(spec.edges).toHaveLength(1);
    expect(spec.edges[0]).toMatchObject({ from: "system", to: "analysis", kind: "default" });
  });
});
