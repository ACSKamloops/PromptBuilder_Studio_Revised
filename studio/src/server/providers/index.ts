import { LangGraphProvider } from "./langgraph-provider";
import type { LlmProvider } from "./types";

const providers: Record<string, LlmProvider> = {
  langgraph: new LangGraphProvider(),
};

export function getProvider(id?: string): LlmProvider {
  if (!id) return providers.langgraph;
  return providers[id] ?? providers.langgraph;
}

export * from "./types";
