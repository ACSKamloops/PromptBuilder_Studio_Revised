import { describe, expect, it, beforeEach, vi } from "vitest";
import type { PromptMetadata } from "@/types/prompt-metadata";
import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";
import { loadPromptLibrary } from "@/lib/load-prompts";

vi.mock("@/lib/load-prompts", () => ({
  loadPromptLibrary: vi.fn(),
}));

const mockedLoadPromptLibrary = loadPromptLibrary as unknown as vi.MockedFunction<typeof loadPromptLibrary>;

const rsipMetadata: PromptMetadata = {
  id: "recursive-self-improvement",
  title: "RSIP",
  description: "Iterative refinement loop.",
  category: "verification",
  tags: ["RSIP"],
  when_to_use: "Use when iterative refinement is required.",
  failure_modes: "Skipping critiques.",
  acceptance_criteria: "Each pass addresses logged issues.",
  combines_with: [],
  composition_steps: [],
  slots: [],
  relativePath: "prompts/recursive-self-improvement.yaml",
  kind: "prompt",
};

const spocMetadata: PromptMetadata = {
  id: "spoc-cue",
  title: "SPOC",
  description: "Single-pass self correction.",
  category: "verification",
  tags: ["SPOC"],
  when_to_use: "Use for intrinsic single-pass verification.",
  failure_modes: "Skipping self-check.",
  acceptance_criteria: "Corrections are annotated and final answer passes self-check.",
  combines_with: [],
  composition_steps: [],
  slots: [],
  relativePath: "prompts/spoc-cue.yaml",
  kind: "prompt",
};

describe("executeLangGraph", () => {
  beforeEach(() => {
    mockedLoadPromptLibrary.mockResolvedValue([rsipMetadata, spocMetadata]);
  });

  it("honours RSIP max_passes iterations", async () => {
    const spec: PromptSpec = {
      version: "promptspec/v1",
      flow: { id: "test-flow", name: "Test Flow", description: "" },
      nodes: [
        {
          id: "recursive-self-improvement#node",
          block: "RSIP Loop",
          metadataId: "recursive-self-improvement",
          params: { max_passes: 3 },
        },
      ],
      edges: [],
    };

    const result = await executeLangGraph(spec);
    const block = result.manifest.blocks[0];
    expect(block.output.mode).toBe("recursive");
    expect(block.output.iterations).toBe(3);
    expect(block.output.maxIterations).toBe(3);
    expect(block.output.verifier.verdict).toBe("accepted");
  });

  it("runs SPOC nodes in a single pass", async () => {
    const spec: PromptSpec = {
      version: "promptspec/v1",
      flow: { id: "spoc-flow", name: "SPOC Flow", description: "" },
      nodes: [
        {
          id: "spoc-cue#node",
          block: "SPOC Self-Check",
          metadataId: "spoc-cue",
          params: {},
        },
      ],
      edges: [],
    };

    const result = await executeLangGraph(spec);
    const block = result.manifest.blocks[0];
    expect(block.output.mode).toBe("single-pass");
    expect(block.output.iterations).toBe(1);
    expect(block.output.verifier.verdict).toBe("accepted");
  });
});
