export interface SlotDefinition {
  name: string;
  label?: string;
  type?: string;
  help?: string;
  default?: unknown;
  options?: Array<string | { label: string; value: string }>;
}

export type ModalityKind = "audio" | "video" | "three_d";

export type ModalityPayloadType = "audio_timeline" | "video_event_graph" | "scene_graph";

export interface AudioTimelineAnnotation {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface AudioTimelineSource {
  name: string;
  size?: number;
  type?: string;
  dataUrl?: string;
  durationSeconds?: number;
}

export interface AudioTimelinePayload {
  source?: AudioTimelineSource;
  annotations: AudioTimelineAnnotation[];
}

export interface VideoEventNode {
  id: string;
  label: string;
  timecode?: number;
  metadata?: Record<string, unknown>;
}

export interface VideoEventEdge {
  id: string;
  from: string;
  to: string;
  relation?: string;
}

export interface VideoEventGraphPayload {
  events: VideoEventNode[];
  edges: VideoEventEdge[];
}

export interface SceneGraphNode {
  id: string;
  label: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface SceneGraphRelationship {
  id: string;
  from: string;
  to: string;
  relation: string;
}

export interface SceneGraphPayload {
  nodes: SceneGraphNode[];
  relationships: SceneGraphRelationship[];
}

export interface ModalityPayloadRequirement {
  type: ModalityPayloadType;
  label: string;
  description?: string;
  schema?: string;
  required?: boolean;
}

export interface ModalityRequirement {
  modality: ModalityKind;
  label?: string;
  description?: string;
  payloads: ModalityPayloadRequirement[];
}

export type ModalityState = Partial<
  Record<
    ModalityKind,
    Partial<
      Record<
        ModalityPayloadType,
        AudioTimelinePayload | VideoEventGraphPayload | SceneGraphPayload | Record<string, unknown>
      >
    >
  >
>;

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
  modalities?: ModalityRequirement[];
}
