import { z } from "zod";

export const CompNode = z.object({
  id: z.string(),
  type: z.enum(["prompt", "tool", "branch", "merge"]).optional(),
  promptRef: z.string().optional(),
  inputs: z.record(z.string()).default({}),
  params: z.record(z.any()).default({}),
});

export const CompEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  out: z.string().default("result"),
  in: z.string().default("input"),
});

export const Composition = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  inputs: z.array(z.string()).default([]).optional(),
  nodes: z.array(CompNode).default([]),
  edges: z.array(CompEdge).default([]),
  outputs: z.array(z.string()).default(["result"]).optional(),
});

export type Composition = z.infer<typeof Composition>;

