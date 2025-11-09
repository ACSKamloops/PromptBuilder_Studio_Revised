import { NextResponse } from "next/server";
import type { PromptSpec } from "@/lib/promptspec";
import { getProvider } from "@/server/providers";
import { recordRun } from "@/server/run-ledger";

interface RunRequestBody {
  promptSpec?: PromptSpec;
  provider?: string;
}

export async function POST(request: Request) {
  const { promptSpec, provider: providerId } = (await request.json()) as RunRequestBody;
  if (!promptSpec) return NextResponse.json({ error: "Missing promptSpec payload." }, { status: 400 });
  if (promptSpec.version !== "promptspec/v1" || !Array.isArray(promptSpec.nodes) || !Array.isArray(promptSpec.edges)) {
    return NextResponse.json({ error: "Invalid PromptSpec format." }, { status: 422 });
  }

  const provider = getProvider(providerId);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of provider.stream(promptSpec)) {
          if (event.type === "run_completed") {
            const recorded = recordRun(event.data);
            const payload = { ...event, data: recorded };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        }
      } catch (error) {
        const payload = { type: "error", error: (error as Error).message };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
