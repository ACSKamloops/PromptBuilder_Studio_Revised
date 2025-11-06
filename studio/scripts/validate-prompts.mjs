import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const promptSchema = z.object({
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
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.resolve(ROOT, '..', 'prompts');
const COMPOSITIONS_DIR = path.resolve(ROOT, '..', 'compositions');

async function validateDirectory(dir, validateSchema = true) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const yamlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'));
  const errors = [];

  for (const file of yamlFiles) {
    const filePath = path.join(dir, file.name);
    const raw = await fs.readFile(filePath, 'utf-8');

    try {
      const parsed = parse(raw);
      if (validateSchema) {
        const result = promptSchema.safeParse(parsed);
        if (!result.success) {
          errors.push({ file: filePath, issues: result.error.issues });
        }
      }
    } catch (error) {
      errors.push({ file: filePath, issues: [{ message: error.message }] });
    }
  }

  return errors;
}

const run = async () => {
  const promptErrors = await validateDirectory(PROMPTS_DIR, true);
  const compositionErrors = await validateDirectory(COMPOSITIONS_DIR, false);

  const errors = [...promptErrors, ...compositionErrors];

  if (errors.length > 0) {
    console.error('Prompt schema validation failed:');
    for (const error of errors) {
      console.error(`\n- ${error.file}`);
      for (const issue of error.issues) {
        console.error(`  • ${issue.message}`);
      }
    }
    process.exit(1);
  } else {
    console.log('All prompt and composition files are valid.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
