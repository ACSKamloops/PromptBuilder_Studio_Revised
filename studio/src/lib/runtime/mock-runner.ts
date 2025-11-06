import type { PromptSpec } from "@/lib/promptspec";

export interface MockRunResult {
  runId: string;
  receivedAt: string;
  summary: {
    flow: PromptSpec["flow"];
    nodeCount: number;
    edgeCount: number;
    blocks: Array<{
      id: string;
      block: string;
      params: Record<string, unknown>;
      status: "skipped" | "executed";
      output: Record<string, unknown>;
    }>;
  };
  message: string;
}

export function buildMockRunner(promptSpec: PromptSpec) {
  const runId = `mock-${Date.now()}`;
  const timestamp = new Date().toISOString();

  async function execute(): Promise<MockRunResult> {
    const blocks = promptSpec.nodes.map((node) => ({
      id: node.id,
      block: node.block,
      params: node.params,
      status: "executed" as const,
      output: {
        note: "Mock execution",
        summary: `Executed ${node.block} with ${Object.keys(node.params).length} params.`,
      },
    }));

    return {
      runId,
      receivedAt: timestamp,
      summary: {
        flow: promptSpec.flow,
        nodeCount: promptSpec.nodes.length,
        edgeCount: promptSpec.edges.length,
        blocks,
      },
      message:
        "Mock runner executed. Replace with LangGraph integration to run real prompt flows.",
    };
  }

  return { execute };
}
