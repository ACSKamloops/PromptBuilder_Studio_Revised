import { z } from "zod";

const CompositionStep = z.object({
  use: z.string(),
  map: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  params: z.record(z.string(), z.any()).optional(),
  note: z.string().optional(),
});

export const Composition = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(CompositionStep),
  outputs: z.array(z.union([z.string(), z.record(z.string(), z.string())])).optional(),
});

export type Composition = z.infer<typeof Composition>;
