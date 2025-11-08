import { z } from "zod";

export const VarDef = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(true),
  type: z.enum(["string", "number", "json"]).default("string"),
});

export const OutputSchema = z.object({
  type: z.enum(["json", "text"]).default("text"),
  jsonSchema: z.record(z.string(), z.any()).optional(),
});

export const PromptDoc = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
  variables: z.array(VarDef).default([]).optional(),
  system: z.string().optional(),
  instruction: z.string().optional(),
  guardrails: z.array(z.string()).default([]).optional(),
  defaultModel: z.string().optional(),
  output: OutputSchema.default({ type: "text" }).optional(),
});

export type PromptDoc = z.infer<typeof PromptDoc>;
