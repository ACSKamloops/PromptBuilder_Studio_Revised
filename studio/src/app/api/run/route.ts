import { NextResponse } from "next/server";
import type { PromptSpec } from "@/lib/promptspec";
import { executeLangGraph } from "@/lib/runtime/langgraph-runner";

interface RunRequestBody {
  promptSpec?: PromptSpec;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RunRequestBody;

  if (!body.promptSpec) {
    return NextResponse.json({ error: "Missing promptSpec payload." }, { status: 400 });
  }

  const { promptSpec } = body;

  if (
    promptSpec.version !== "promptspec/v1" ||
    !Array.isArray(promptSpec.nodes) ||
    !Array.isArray(promptSpec.edges)
  ) {
    return NextResponse.json({ error: "Invalid PromptSpec format." }, { status: 422 });
  }

  const result = await executeLangGraph(promptSpec);

  return NextResponse.json(result);
}
