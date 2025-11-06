import { NextResponse } from "next/server";
import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";

interface RunRequestBody { promptSpec?: PromptSpec }

export async function POST(request: Request) {
  const { promptSpec } = (await request.json()) as RunRequestBody;
  if (!promptSpec) return NextResponse.json({ error: "Missing promptSpec payload." }, { status: 400 });
  if (promptSpec.version !== "promptspec/v1" || !Array.isArray(promptSpec.nodes) || !Array.isArray(promptSpec.edges)) {
    return NextResponse.json({ error: "Invalid PromptSpec format." }, { status: 422 });
  }

  const { readable, writable } = new TransformStream();
  (async () => {
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const write = async (obj: unknown) => {
      const line = JSON.stringify(obj) + "\n";
      await writer.write(enc.encode(line));
    };
    try {
      await write({ type: "start", data: { nodeCount: promptSpec.nodes.length, edgeCount: promptSpec.edges.length } });
      let i = 0;
      for (const node of promptSpec.nodes) {
        await write({ type: "node:start", data: { id: node.id, block: node.block, index: i } });
        // Small simulated delay to visualize streaming in UI
        await new Promise((r) => setTimeout(r, 40));
        await write({ type: "node:end", data: { id: node.id, ok: true } });
        i += 1;
      }
      const result = await executeLangGraph(promptSpec);
      await write({ type: "result", data: result });
    } catch (err) {
      await write({ type: "error", error: (err as Error).message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

