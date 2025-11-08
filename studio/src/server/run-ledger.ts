import type { ProviderRunResult } from "@/server/providers";

const MAX_RUNS = 25;
const runs: ProviderRunResult[] = [];

export function recordRun(entry: ProviderRunResult) {
  runs.unshift(entry);
  if (runs.length > MAX_RUNS) runs.pop();
}

export function listRuns(): ProviderRunResult[] {
  return runs.slice();
}

