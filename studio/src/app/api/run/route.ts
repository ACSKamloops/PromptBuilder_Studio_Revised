import { NextResponse } from "next/server";
import type { PromptSpec } from "@/lib/promptspec";
import { getProvider } from "@/server/providers";
import { recordRun } from "@/server/run-ledger";

interface RunRequestBody {
  promptSpec?: PromptSpec;
  provider?: string;
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

  const provider = getProvider(body.provider);
  const result = await provider.run(promptSpec);
  recordRun(result);
  return NextResponse.json(result);
}
