export interface FlowPreset {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  sourcePath?: string;
}
