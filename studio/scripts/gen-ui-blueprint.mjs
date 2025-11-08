#!/usr/bin/env node
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dest = path.resolve(__dirname, "../src/config/uiBlueprint.json");

const blueprint = {
  version: 1,
  generatedAt: new Date().toISOString(),
  slot_controls: {
    text: { component: "TextInput" },
    textarea: { component: "Textarea", props: { rows: 6 } },
    select: { component: "Select" },
    multiselect: { component: "MultiSelect" },
    toggle: { component: "Switch" },
    number: { component: "NumberInput", props: { min: 0 } },
    json: { component: "CodeInput", props: { language: "json", minRows: 6 } },
    table: { component: "TableBuilder" },
    file: { component: "FilePicker" },
  },
  rendering_rules: [
    { if_tag: "citations", hint: "Citations stay ON whenever RAG context is connected." },
    { if_tag: "grounding", show: "citation_style" },
    { if_category: "multimodal", hint: "Attach image/diagram and paste OCR if available." },
    { if_category: "playbook", hint: "Outputs of each step feed the next; render a mini pipeline preview." },
    { if_category: "verification", hint: "Surface Draft → Plan → Execute → Finalize status." },
  ],
  export: {
    markdown: true,
    json: true,
  },
};

const run = async () => {
  await writeFile(dest, `${JSON.stringify(blueprint, null, 2)}\n`, "utf8");
  console.log(`uiBlueprint generated → ${path.relative(process.cwd(), dest)}`);
};

run().catch((err) => {
  console.error("Failed to generate UI blueprint", err);
  process.exit(1);
});

