import type {
  ModalityPayloadRequirement,
  ModalityRequirement,
  PromptMetadata,
  SlotDefinition,
} from '@/types/prompt-metadata';
import type { UIBlueprint } from '@/types/ui-blueprint';
import { promises as fs } from "fs";
import path from "path";
import { parse } from "yaml";
import uiBlueprintJson from "@/config/uiBlueprint.json" assert { type: "json" };
import promptSchemaJson from "@/config/prompt_template.schema.json" assert { type: "json" };
import { z } from "zod";

export const uiBlueprint = uiBlueprintJson as UIBlueprint;
const promptSchemaVersion =
  (promptSchemaJson as { $id?: string }).$id ??
  (promptSchemaJson as { title?: string }).title ??
  "prompt_template.schema.json";
const modalityPayloadSchema = z.object({
  type: z.enum(["audio_timeline", "video_event_graph", "scene_graph"]),
  label: z.string(),
  description: z.string().optional(),
  schema: z.string().optional(),
  required: z.boolean().optional(),
});

const modalityRequirementSchema = z.object({
  modality: z.enum(["audio", "video", "three_d"]),
  label: z.string().optional(),
  description: z.string().optional(),
  payloads: z.array(modalityPayloadSchema).min(1),
});

export const promptSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  slots: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().optional(),
        type: z.string().optional(),
        help: z.string().optional(),
        default: z.any().optional(),
        options: z
          .array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })]))
          .optional(),
      }),
    )
    .optional(),
  prompt: z.string().optional(),
  when_to_use: z.string().optional(),
  failure_modes: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  model_preferences: z.any().optional(),
  modalities: z.array(modalityRequirementSchema).optional(),
});

const PROMPTS_DIR = path.resolve(process.cwd(), "..", "prompts");
const COMPOSITIONS_DIR = path.resolve(process.cwd(), "..", "compositions");

async function readYamlFiles(dir: string): Promise<PromptMetadata[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const yamlFiles = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".yaml"),
    );

    const results: PromptMetadata[] = [];

    for (const file of yamlFiles) {
      const fullPath = path.join(dir, file.name);
      const raw = await fs.readFile(fullPath, "utf-8");
      const parsed = parse(raw) ?? {};
      if (!parsed || typeof parsed !== "object") continue;

      const isComposition = dir.endsWith("compositions");
      if (!isComposition) {
        const validation = promptSchema.safeParse(parsed);
        if (!validation.success) {
          console.warn(
            `[Prompt Loader] Validation failed (${promptSchemaVersion}) for ${file.name}:`,
            validation.error.issues,
          );
          continue;
        }
      }

      const slots = Array.isArray(parsed.slots)
        ? parsed.slots
            .map((slot: Record<string, unknown>) => ({
              name: typeof slot.name === "string" ? slot.name : "",
              label: typeof slot.label === "string" ? slot.label : undefined,
              type: typeof slot.type === "string" ? slot.type : undefined,
              help: typeof slot.help === "string" ? slot.help : undefined,
              default: slot.default,
              options: Array.isArray(slot.options) ? slot.options : undefined,
            }))
            .filter((slot: SlotDefinition) => slot.name.length > 0)
        : undefined;

      const modalities = Array.isArray(parsed.modalities)
        ? parsed.modalities
            .map((entry: Record<string, unknown>) => {
              const modalityKey = typeof entry.modality === "string" ? entry.modality : undefined;
              if (!modalityKey) {
                return undefined;
              }
              const payloads = Array.isArray(entry.payloads)
                ? entry.payloads
                    .map((payload: Record<string, unknown>) => {
                      const type = typeof payload.type === "string" ? payload.type : undefined;
                      const label = typeof payload.label === "string" ? payload.label : undefined;
                      if (!type || !label) {
                        return undefined;
                      }
                      return {
                        type: type as ModalityPayloadRequirement["type"],
                        label,
                        description:
                          typeof payload.description === "string" ? payload.description : undefined,
                        schema: typeof payload.schema === "string" ? payload.schema : undefined,
                        required:
                          typeof payload.required === "boolean" ? payload.required : undefined,
                      } satisfies ModalityPayloadRequirement;
                    })
                    .filter(
                      (payload): payload is ModalityPayloadRequirement => payload !== undefined,
                    )
                : [];
              if (payloads.length === 0) {
                return undefined;
              }
              return {
                modality: modalityKey as ModalityRequirement["modality"],
                label: typeof entry.label === "string" ? entry.label : undefined,
                description:
                  typeof entry.description === "string" ? entry.description : undefined,
                payloads,
              } satisfies ModalityRequirement;
            })
            .filter((entry): entry is ModalityRequirement => entry !== undefined)
        : undefined;

      const metadata: PromptMetadata = {
        id: parsed.id ?? path.parse(file.name).name,
        title: parsed.title ?? parsed.name ?? path.parse(file.name).name,
        category: parsed.category,
        tags: parsed.tags,
        when_to_use: parsed.when_to_use,
        failure_modes: parsed.failure_modes,
        acceptance_criteria: parsed.acceptance_criteria,
        combines_with: Array.isArray(parsed.combines_with)
          ? parsed.combines_with.filter((item: unknown): item is string => typeof item === "string")
          : undefined,
        slots,
        prompt: typeof parsed.prompt === "string" ? parsed.prompt : undefined,
        relativePath: path
          .relative(process.cwd(), fullPath)
          .replace(/\\/g, "/"),
        kind: isComposition ? "composition" : "prompt",
      };

      if (modalities?.length) {
        metadata.modalities = modalities;
      }

      if (metadata.kind === "composition") {
        const steps = Array.isArray(parsed.steps)
          ? parsed.steps
              .map((step: Record<string, unknown>) =>
                typeof step.use === "string" ? step.use : undefined,
              )
              .filter(
                (use: string | undefined): use is string =>
                  typeof use === "string" && use.length > 0,
              )
          : [];
        metadata.composition_steps = steps;
      }

      results.push(metadata);
    }

    return results;
  } catch (error) {
    console.error(`Failed to read directory ${dir}`, error);
    return [];
  }
}

export async function loadPromptLibrary(): Promise<PromptMetadata[]> {
  const [prompts, compositions] = await Promise.all([
    readYamlFiles(PROMPTS_DIR),
    readYamlFiles(COMPOSITIONS_DIR),
  ]);
  return [...prompts, ...compositions];
}
