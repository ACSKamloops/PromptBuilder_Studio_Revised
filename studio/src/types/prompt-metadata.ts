export interface SlotDefinition {
  name: string;
  label?: string;
  type?: string;
  help?: string;
  default?: unknown;
  options?: Array<string | { label: string; value: string }>;
}

export interface PromptMetadata {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  when_to_use?: string;
  failure_modes?: string;
  acceptance_criteria?: string;
  combines_with?: string[];
  slots?: SlotDefinition[];
  prompt?: string;
  composition_steps?: string[];
  relativePath: string;
  kind: "prompt" | "composition";
}
