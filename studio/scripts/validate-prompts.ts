import { promises as fs } from "fs";
import path from "path";
import { parse } from "yaml";
import { PromptDoc } from "../src/schemas/prompt";
import { Composition } from "../src/schemas/composition";

const ROOT = path.resolve(__dirname, "..", "..");
const PROMPTS_DIR = path.resolve(ROOT, "prompts");
const COMPOSITIONS_DIR = path.resolve(ROOT, "compositions");

type ValidationIssue = { file: string; message: string };

async function readYamlFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await readYamlFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function validateFiles(files: string[], kind: "prompt" | "composition") {
  const issues: ValidationIssue[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = parse(raw);
      const result = kind === "prompt" ? PromptDoc.safeParse(parsed) : Composition.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({ file, message: issue.message });
        }
      }
    } catch (error) {
      issues.push({ file, message: (error as Error).message });
    }
  }
  return issues;
}

async function run() {
  const promptFiles = await readYamlFiles(PROMPTS_DIR);
  const compositionFiles = await readYamlFiles(COMPOSITIONS_DIR);
  const promptIssues = await validateFiles(promptFiles, "prompt");
  const compositionIssues = await validateFiles(compositionFiles, "composition");
  const issues = [...promptIssues, ...compositionIssues];

  if (issues.length) {
    console.error("✖ Prompt/composition validation failed:\n");
    for (const issue of issues) {
      console.error(`- ${path.relative(ROOT, issue.file)}: ${issue.message}`);
    }
    process.exit(1);
  } else {
    console.log("✔ All prompts and compositions are schema-valid.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
