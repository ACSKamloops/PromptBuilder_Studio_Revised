"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  AudioTimelineAnnotation,
  AudioTimelinePayload,
  ModalityPayloadRequirement,
  ModalityPayloadType,
  ModalityRequirement,
  ModalityState,
  SceneGraphNode,
  SceneGraphPayload,
  SceneGraphRelationship,
  VideoEventEdge,
  VideoEventGraphPayload,
  VideoEventNode,
} from "@/types/prompt-metadata";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function WaveformEditor({
  value,
  onChange,
}: {
  value?: AudioTimelinePayload;
  onChange: (next: AudioTimelinePayload) => void;
}) {
  const annotations = useMemo(() => {
    if (Array.isArray(value?.annotations)) {
      return value.annotations;
    }
    return [] as AudioTimelinePayload["annotations"];
  }, [value]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        onChange({ annotations: [...annotations] });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onChange({
          source: {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: typeof reader.result === "string" ? reader.result : undefined,
          },
          annotations,
        });
      };
      reader.readAsDataURL(file);
    },
    [annotations, onChange],
  );

  const handleAnnotationChange = useCallback(
    (annotationId: string, patch: Partial<AudioTimelineAnnotation>) => {
      const nextAnnotations = annotations.map((item) =>
        item.id === annotationId ? { ...item, ...patch } : item,
      );
      onChange({
        ...(value ?? { annotations: [] }),
        annotations: nextAnnotations,
      });
    },
    [annotations, onChange, value],
  );

  const addAnnotation = useCallback(() => {
    const nextAnnotation: AudioTimelineAnnotation = {
      id: generateId("marker"),
      label: `Marker ${annotations.length + 1}`,
      start: annotations.length > 0 ? annotations[annotations.length - 1].end ?? 0 : 0,
      end: annotations.length > 0 ? annotations[annotations.length - 1].end ?? 0 : 5,
    };
    onChange({
      ...(value ?? { annotations: [] }),
      annotations: [...annotations, nextAnnotation],
    });
  }, [annotations, onChange, value]);

  const removeAnnotation = useCallback(
    (annotationId: string) => {
      const nextAnnotations = annotations.filter((item) => item.id !== annotationId);
      onChange({
        ...(value ?? { annotations: [] }),
        annotations: nextAnnotations,
      });
    },
    [annotations, onChange, value],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Audio file</Label>
        <Input type="file" accept="audio/*" onChange={handleFileChange} />
        {value?.source?.name ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{value.source.name}</Badge>
            {value.source.size ? <span>{formatFileSize(value.source.size)}</span> : null}
            {value.source.type ? <span>{value.source.type}</span> : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ annotations: [...annotations] })}
              className="h-7 px-2 text-xs"
            >
              Remove
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Upload audio to inspect and align annotations with the timeline.
          </p>
        )}
        {value?.source?.dataUrl ? (
          <audio src={value.source.dataUrl} controls className="mt-2 w-full" preload="metadata" />
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Timeline annotations</h4>
          <Button type="button" size="sm" onClick={addAnnotation} variant="outline">
            Add marker
          </Button>
        </div>
        {annotations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Define events, beats, or speaker turns to guide downstream reasoning.
          </p>
        ) : (
          <div className="space-y-3">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className="rounded-md border border-border p-3 shadow-sm"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`${annotation.id}-label`} className="text-xs text-muted-foreground">
                      Label
                    </Label>
                    <Input
                      id={`${annotation.id}-label`}
                      value={annotation.label}
                      onChange={(event) =>
                        handleAnnotationChange(annotation.id, { label: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${annotation.id}-start`} className="text-xs text-muted-foreground">
                      Start (s)
                    </Label>
                    <Input
                      id={`${annotation.id}-start`}
                      type="number"
                      min={0}
                      step={0.1}
                      value={annotation.start}
                      onChange={(event) =>
                        handleAnnotationChange(annotation.id, {
                          start: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${annotation.id}-end`} className="text-xs text-muted-foreground">
                      End (s)
                    </Label>
                    <Input
                      id={`${annotation.id}-end`}
                      type="number"
                      min={annotation.start}
                      step={0.1}
                      value={annotation.end}
                      onChange={(event) =>
                        handleAnnotationChange(annotation.id, {
                          end: Number.parseFloat(event.target.value) || annotation.start,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => removeAnnotation(annotation.id)}
                  >
                    Remove marker
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoEventGraphBuilder({
  value,
  onChange,
}: {
  value?: VideoEventGraphPayload;
  onChange: (next: VideoEventGraphPayload) => void;
}) {
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string; relation: string }>(
    { from: "", to: "", relation: "" },
  );
  const events = useMemo(() => {
    if (Array.isArray(value?.events)) {
      return value.events;
    }
    return [] as VideoEventGraphPayload["events"];
  }, [value]);
  const edges = useMemo(() => {
    if (Array.isArray(value?.edges)) {
      return value.edges;
    }
    return [] as VideoEventGraphPayload["edges"];
  }, [value]);

  const addEvent = useCallback(() => {
    const id = generateId("event");
    const next: VideoEventNode = {
      id,
      label: `Event ${events.length + 1}`,
      timecode:
        events.length > 0
          ? (events[events.length - 1].timecode ?? events.length * 5)
          : 0,
    };
    onChange({ events: [...events, next], edges });
  }, [edges, events, onChange]);

  const updateEvent = useCallback(
    (eventId: string, patch: Partial<VideoEventNode>) => {
      const next = events.map((event) => (event.id === eventId ? { ...event, ...patch } : event));
      onChange({ events: next, edges });
    },
    [edges, events, onChange],
  );

  const removeEvent = useCallback(
    (eventId: string) => {
      const nextEvents = events.filter((event) => event.id !== eventId);
      const nextEdges = edges.filter((edge) => edge.from !== eventId && edge.to !== eventId);
      onChange({ events: nextEvents, edges: nextEdges });
    },
    [edges, events, onChange],
  );

  const addEdge = useCallback(() => {
    if (!pendingEdge.from || !pendingEdge.to || pendingEdge.from === pendingEdge.to) {
      return;
    }
    const id = generateId("edge");
    const nextEdge: VideoEventEdge = {
      id,
      from: pendingEdge.from,
      to: pendingEdge.to,
      relation: pendingEdge.relation.trim() ? pendingEdge.relation.trim() : undefined,
    };
    onChange({ events, edges: [...edges, nextEdge] });
    setPendingEdge({ from: "", to: "", relation: "" });
  }, [edges, events, onChange, pendingEdge]);

  const removeEdge = useCallback(
    (edgeId: string) => {
      onChange({ events, edges: edges.filter((edge) => edge.id !== edgeId) });
    },
    [edges, events, onChange],
  );

  const eventOptions = useMemo(
    () =>
      events.map((event) => ({
        value: event.id,
        label: `${event.label}${
          typeof event.timecode === "number" ? ` (${event.timecode.toFixed(1)}s)` : ""
        }`,
      })),
    [events],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Event nodes</h4>
        <Button size="sm" variant="outline" type="button" onClick={addEvent}>
          Add event
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Use events to describe shots, transitions, or key semantic beats in the video.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-md border border-border p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <Label htmlFor={`${event.id}-label`} className="text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id={`${event.id}-label`}
                    value={event.label}
                    onChange={(evt) => updateEvent(event.id, { label: evt.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`${event.id}-time`} className="text-xs text-muted-foreground">
                    Timecode (s)
                  </Label>
                  <Input
                    id={`${event.id}-time`}
                    type="number"
                    step={0.1}
                    min={0}
                    value={event.timecode ?? 0}
                    onChange={(evt) =>
                      updateEvent(event.id, { timecode: Number.parseFloat(evt.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`${event.id}-meta`} className="text-xs text-muted-foreground">
                    Metadata (JSON)
                  </Label>
                  <Textarea
                    id={`${event.id}-meta`}
                    rows={2}
                    value={
                      event.metadata && Object.keys(event.metadata).length > 0
                        ? JSON.stringify(event.metadata, null, 2)
                        : ""
                    }
                    onChange={(evt) => {
                      const raw = evt.target.value;
                      if (!raw.trim()) {
                        updateEvent(event.id, { metadata: undefined });
                        return;
                      }
                      try {
                        const parsed = JSON.parse(raw);
                        updateEvent(event.id, { metadata: parsed });
                      } catch {
                        updateEvent(event.id, { metadata: { raw } });
                      }
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => removeEvent(event.id)}
                >
                  Remove event
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Relationships</h4>
        {edges.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Connect events to describe causal or temporal relationships.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {edges.map((edge) => {
              const from = events.find((event) => event.id === edge.from)?.label ?? edge.from;
              const to = events.find((event) => event.id === edge.to)?.label ?? edge.to;
              return (
                <li key={edge.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>
                    {from} → {to}
                    {edge.relation ? ` (${edge.relation})` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => removeEdge(edge.id)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select
              value={pendingEdge.from}
              onValueChange={(value) => setPendingEdge((prev) => ({ ...prev, from: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Select
              value={pendingEdge.to}
              onValueChange={(value) => setPendingEdge((prev) => ({ ...prev, to: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edge-relation" className="text-xs text-muted-foreground">
              Relation
            </Label>
            <Input
              id="edge-relation"
              value={pendingEdge.relation}
              onChange={(event) =>
                setPendingEdge((prev) => ({ ...prev, relation: event.target.value }))
              }
              placeholder="e.g. causes, references"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={addEdge} disabled={events.length < 2}>
            Add connection
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseAttributeLines(input: string): Record<string, unknown> | undefined {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }
  const record: Record<string, unknown> = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) {
      record.raw = input;
      return record;
    }
    record[key.trim()] = rest.join(":").trim();
  }
  return record;
}

export function SceneGraphBuilder({
  value,
  onChange,
}: {
  value?: SceneGraphPayload;
  onChange: (next: SceneGraphPayload) => void;
}) {
  const [pendingRelationship, setPendingRelationship] = useState<{
    from: string;
    to: string;
    relation: string;
  }>({ from: "", to: "", relation: "" });
  const nodes = useMemo(() => {
    if (Array.isArray(value?.nodes)) {
      return value.nodes;
    }
    return [] as SceneGraphPayload["nodes"];
  }, [value]);
  const relationships = useMemo(() => {
    if (Array.isArray(value?.relationships)) {
      return value.relationships;
    }
    return [] as SceneGraphPayload["relationships"];
  }, [value]);

  const addNode = useCallback(
    (node: SceneGraphNode) => {
      onChange({ nodes: [...nodes, node], relationships });
    },
    [nodes, onChange, relationships],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<SceneGraphNode>) => {
      const nextNodes = nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node));
      onChange({ nodes: nextNodes, relationships });
    },
    [nodes, onChange, relationships],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const nextNodes = nodes.filter((node) => node.id !== nodeId);
      const nextRelationships = relationships.filter(
        (relationship) => relationship.from !== nodeId && relationship.to !== nodeId,
      );
      onChange({ nodes: nextNodes, relationships: nextRelationships });
    },
    [nodes, onChange, relationships],
  );

  const addRelationship = useCallback(() => {
    if (!pendingRelationship.from || !pendingRelationship.to || !pendingRelationship.relation) {
      return;
    }
    const id = generateId("rel");
    const next: SceneGraphRelationship = {
      id,
      from: pendingRelationship.from,
      to: pendingRelationship.to,
      relation: pendingRelationship.relation,
    };
    onChange({ nodes, relationships: [...relationships, next] });
    setPendingRelationship({ from: "", to: "", relation: "" });
  }, [nodes, onChange, pendingRelationship, relationships]);

  const removeRelationship = useCallback(
    (relationshipId: string) => {
      const next = relationships.filter((relationship) => relationship.id !== relationshipId);
      onChange({ nodes, relationships: next });
    },
    [nodes, onChange, relationships],
  );

  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ value: node.id, label: node.label })),
    [nodes],
  );

  const [newNode, setNewNode] = useState<{ label: string; type?: string; attributes: string }>(
    { label: "", type: "", attributes: "" },
  );

  const handleAddNode = useCallback(() => {
    if (!newNode.label.trim()) {
      return;
    }
    addNode({
      id: generateId("node"),
      label: newNode.label.trim(),
      type: newNode.type?.trim() ? newNode.type.trim() : undefined,
      properties: parseAttributeLines(newNode.attributes),
    });
    setNewNode({ label: "", type: "", attributes: "" });
  }, [addNode, newNode]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Add scene node</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor="scene-node-label" className="text-xs text-muted-foreground">
              Label
            </Label>
            <Input
              id="scene-node-label"
              value={newNode.label}
              onChange={(event) => setNewNode((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="e.g. Camera, Speaker"
            />
          </div>
          <div>
            <Label htmlFor="scene-node-type" className="text-xs text-muted-foreground">
              Type
            </Label>
            <Input
              id="scene-node-type"
              value={newNode.type}
              onChange={(event) => setNewNode((prev) => ({ ...prev, type: event.target.value }))}
              placeholder="Object, Agent, Light"
            />
          </div>
          <div>
            <Label htmlFor="scene-node-attributes" className="text-xs text-muted-foreground">
              Attributes (key: value)
            </Label>
            <Textarea
              id="scene-node-attributes"
              rows={2}
              value={newNode.attributes}
              onChange={(event) =>
                setNewNode((prev) => ({ ...prev, attributes: event.target.value }))
              }
              placeholder={"location: stage\npose: seated"}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleAddNode}>
            Add node
          </Button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Scene graphs capture spatial relationships between objects, agents, and context.
        </p>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Nodes</h4>
          {nodes.map((node) => (
            <div key={node.id} className="rounded-md border border-border p-3 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <Input
                    value={node.label}
                    onChange={(event) => updateNode(node.id, { label: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Input
                    value={node.type ?? ""}
                    onChange={(event) => updateNode(node.id, { type: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Attributes</Label>
                  <Textarea
                    rows={2}
                    value={
                      node.properties && Object.keys(node.properties).length > 0
                        ? Object.entries(node.properties)
                            .map(([key, val]) => `${key}: ${String(val)}`)
                            .join("\n")
                        : ""
                    }
                    onChange={(event) =>
                      updateNode(node.id, {
                        properties: parseAttributeLines(event.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => removeNode(node.id)}
                >
                  Remove node
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Relationships</h4>
        {relationships.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Describe spatial relationships (e.g. “Camera looks_at Speaker”).
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {relationships.map((relationship) => {
              const from = nodes.find((node) => node.id === relationship.from)?.label ?? relationship.from;
              const to = nodes.find((node) => node.id === relationship.to)?.label ?? relationship.to;
              return (
                <li
                  key={relationship.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span>
                    {from} —{relationship.relation}→ {to}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => removeRelationship(relationship.id)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Select
              value={pendingRelationship.from}
              onValueChange={(value) =>
                setPendingRelationship((prev) => ({ ...prev, from: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select node" />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Relation</Label>
            <Input
              value={pendingRelationship.relation}
              onChange={(event) =>
                setPendingRelationship((prev) => ({ ...prev, relation: event.target.value }))
              }
              placeholder="e.g. looks_at"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Select
              value={pendingRelationship.to}
              onValueChange={(value) => setPendingRelationship((prev) => ({ ...prev, to: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select node" />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={addRelationship}
            disabled={nodes.length < 2 || !pendingRelationship.relation.trim()}
          >
            Add relationship
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ModalityRequirementSection({
  requirements,
  state,
  onStateChange,
}: {
  requirements: ModalityRequirement[];
  state: ModalityState;
  onStateChange: (next: ModalityState) => void;
}) {
  const handlePayloadChange = useCallback(
    (
      modality: string,
      payloadType: ModalityPayloadType,
      value: AudioTimelinePayload | VideoEventGraphPayload | SceneGraphPayload,
    ) => {
      onStateChange({
        ...state,
        [modality]: {
          ...(state[modality] ?? {}),
          [payloadType]: value,
        },
      });
    },
    [onStateChange, state],
  );

  return (
    <div className="space-y-5">
      {requirements.map((requirement) => {
        const modalityState = state[requirement.modality] ?? {};
        return (
          <section key={requirement.modality} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">
                {requirement.label ?? requirement.modality.toUpperCase()}
              </h3>
              {requirement.description ? (
                <p className="text-xs text-muted-foreground">{requirement.description}</p>
              ) : null}
            </div>
            <div className="space-y-4">
              {requirement.payloads.map((payload: ModalityPayloadRequirement) => {
                const payloadValue = modalityState?.[payload.type];
                return (
                  <div key={payload.type} className="rounded-lg border border-border p-4 shadow-sm">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{payload.label}</h4>
                        {payload.required === false ? (
                          <Badge variant="outline">Optional</Badge>
                        ) : (
                          <Badge>Required</Badge>
                        )}
                      </div>
                      {payload.description ? (
                        <p className="text-xs text-muted-foreground">{payload.description}</p>
                      ) : null}
                      {payload.schema ? (
                        <p className="text-[11px] text-muted-foreground">
                          Schema: <code>{payload.schema}</code>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-4">
                      {payload.type === "audio_timeline" ? (
                        <WaveformEditor
                          value={payloadValue as AudioTimelinePayload | undefined}
                          onChange={(next) =>
                            handlePayloadChange(requirement.modality, payload.type, next)
                          }
                        />
                      ) : null}
                      {payload.type === "video_event_graph" ? (
                        <VideoEventGraphBuilder
                          value={payloadValue as VideoEventGraphPayload | undefined}
                          onChange={(next) =>
                            handlePayloadChange(requirement.modality, payload.type, next)
                          }
                        />
                      ) : null}
                      {payload.type === "scene_graph" ? (
                        <SceneGraphBuilder
                          value={payloadValue as SceneGraphPayload | undefined}
                          onChange={(next) =>
                            handlePayloadChange(requirement.modality, payload.type, next)
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
