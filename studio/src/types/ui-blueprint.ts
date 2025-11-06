export interface SlotControlConfig {
  component: string;
  props?: Record<string, unknown>;
}

export interface RenderingRule {
  if_tag?: string;
  if_category?: string;
  hint?: string;
  show?: string;
}

export interface UIBlueprintExportOptions {
  markdown?: boolean;
  json?: boolean;
  [key: string]: unknown;
}

export interface UIBlueprint {
  slot_controls: Record<string, SlotControlConfig>;
  rendering_rules?: RenderingRule[];
  export?: UIBlueprintExportOptions;
}
