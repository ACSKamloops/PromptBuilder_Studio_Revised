import { MockProvider } from "./mock-provider";
import type { LlmProvider } from "./types";

const providers: Record<string, LlmProvider> = {
  mock: new MockProvider(),
};

export function getProvider(id?: string): LlmProvider {
  if (!id) return providers.mock;
  return providers[id] ?? providers.mock;
}

export * from "./types";
