"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  NodeProps,
  type ReactFlowInstance,
  Handle,
  Position,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { blockCatalog } from "@/data/block-catalog";
import type { PromptMetadata, SlotDefinition } from "@/types/prompt-metadata";
import uiBlueprintJson from "@/config/uiBlueprint.json" assert { type: "json" };
import type { UIBlueprint } from "@/types/ui-blueprint";
import { CoachPanel, type CoachInsight } from "@/components/coach-panel";

import type { LangGraphRunBlockOutput } from "@/lib/runtime/langgraph-runner";

const uiBlueprint = uiBlueprintJson as UIBlueprint;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { FlowPreset } from "@/types/flow";
import { buildPromptSpec } from "@/lib/promptspec";
import type { PromptSpec } from "@/lib/promptspec";
import { CanvasNodeCard } from "@/components/canvas-node";
import { resolveBlockDescriptor } from "@/lib/blocks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RunPreviewResponse {
  runId: string;
  receivedAt: string;
  manifest: {
    flow: PromptSpec["flow"];
    nodeCount: number;
    edgeCount: number;
    blocks: Array<{
      id: string;
      block: string;
      params: Record<string, unknown>;
      output: LangGraphRunBlockOutput;
    }>;
  };
  message: string;
}

interface StudioShellProps {
  library: PromptMetadata[];
  presets: FlowPreset[];
  initialPresetId: string;
}

type FlowNodeData = {
  label: string;
  summary: string;
  category?: string;
  metadataId?: string;
};

type FlowNode = Node<FlowNodeData>;

function renderPromptTemplate(template: string, context: Record<string, unknown>): string {
  const renderedConditionals = template.replace(
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, rawKey, blockContent) => {
      const key = String(rawKey).trim();
      const value = context[key];
      if (
        value === undefined ||
        value === null ||
        value === false ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return "";
      }
      return blockContent;
    },
  );

  return renderedConditionals.replace(/\{\{([^#\/][^}]*)\}\}/g, (_match, rawKey) => {
    const key = String(rawKey).trim();
    const value = context[key];
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  });
}

function buildDefaultLayout(flow: FlowPreset): Record<string, { x: number; y: number }> {
  const spacingX = 260;
  const positions: Record<string, { x: number; y: number }> = {};
  flow.nodeIds.forEach((id, index) => {
    positions[id] = { x: index * spacingX, y: 0 };
  });
  return positions;
}

function buildNodes(
  flow: FlowPreset,
  positions: Record<string, { x: number; y: number }>,
  metadataMap: Map<string, PromptMetadata>,
): FlowNode[] {
  return flow.nodeIds.map((id) => {
    const descriptor = resolveBlockDescriptor(id, metadataMap);
    const metadata =
      (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
      metadataMap.get(id);
    const position = positions[id] ?? { x: Math.random() * 400, y: Math.random() * 200 };

    return {
      id,
      position,
      type: "default",
      data: {
        label: descriptor?.name ?? metadata?.title ?? id,
        summary:
          descriptor?.description ??
          metadata?.when_to_use ??
          metadata?.failure_modes ??
          metadata?.acceptance_criteria ??
          "",
        category: descriptor?.category ?? metadata?.category,
        metadataId: metadata?.id ?? descriptor?.metadataId,
      },
    };
  });
}

function buildEdges(flow: FlowPreset): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < flow.nodeIds.length - 1; i += 1) {
    const source = flow.nodeIds[i];
    const target = flow.nodeIds[i + 1];
    edges.push({
      id: `${source}→${target}`,
      source,
      target,
    });
  }
  return edges;
}

export default function StudioShell({ library, presets, initialPresetId }: StudioShellProps) {
  const [activePresetId, setActivePresetId] = useState<string>(initialPresetId);
  const activePreset = useMemo(() => {
    return presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  }, [activePresetId, presets]);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    activePreset.nodeIds[0] ?? "",
  );
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    buildDefaultLayout(activePreset),
  );
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const storageKey = useMemo(
    () => `prompt-builder-studio:${activePreset.id}`,
    [activePreset.id],
  );

  const metadataById = useMemo(() => {
    const map = new Map<string, PromptMetadata>();
    for (const item of library) {
      map.set(item.id, item);
    }
    return map;
  }, [library]);

  const initialParams = useMemo(
    () => buildInitialNodeParams(activePreset, metadataById),
    [activePreset, metadataById],
  );
  const [nodeParams, setNodeParams] = useState<Record<string, Record<string, unknown>>>(
    initialParams,
  );

  // Extra nodes created via drag-and-drop
  const [extraNodes, setExtraNodes] = useState<FlowNode[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setNodeParams(initialParams);
      return;
    }
    const stored = window.localStorage.getItem(`${storageKey}:params`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, Record<string, unknown>>;
        setNodeParams({ ...initialParams, ...parsed });
        return;
      } catch {
        // ignore invalid stored state
      }
    }
    setNodeParams(initialParams);
  }, [initialParams, storageKey]);

useEffect(() => {
  setSelectedNodeId(activePreset.nodeIds[0] ?? "");
  setHasCustomLayout(false);
}, [activePreset]);

useEffect(() => {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(`${storageKey}:positions`);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored) as Record<string, { x: number; y: number }>;
    setPositions(parsed);
    setHasCustomLayout(true);
  } catch {
    // ignore invalid stored layout
  }
}, [storageKey]);

useEffect(() => {
  if (typeof window === "undefined" || activePreset.nodeIds.length === 0) return;
  window.localStorage.setItem(`${storageKey}:params`, JSON.stringify(nodeParams));
}, [nodeParams, storageKey, activePreset.nodeIds.length]);

useEffect(() => {
  if (typeof window === "undefined" || activePreset.nodeIds.length === 0) return;
  window.localStorage.setItem(`${storageKey}:positions`, JSON.stringify(positions));
}, [positions, storageKey, activePreset.nodeIds.length]);

  const baselineNodes = useMemo(
    () => buildNodes(activePreset, positions, metadataById),
    [activePreset, positions, metadataById],
  );
  const nodes = useMemo(() => [...baselineNodes, ...extraNodes], [baselineNodes, extraNodes]);
  const [userEdges, setUserEdges] = useState<Edge[]>([]);
  const edges = useMemo(() => [...buildEdges(activePreset), ...userEdges], [activePreset, userEdges]);
  const promptSpec = useMemo(() => {
    const base = buildPromptSpec(activePreset, nodeParams, metadataById);
    // Extend with extra nodes and user edges
    const extra = extraNodes.map((n) => {
      const metadata = n.data.metadataId ? metadataById.get(n.data.metadataId) : metadataById.get(n.id);
      return {
        id: n.id,
        block: n.data.label,
        metadataId: n.data.metadataId,
        title: metadata?.title,
        params: nodeParams[n.id] ?? {},
        sourcePath: metadata?.relativePath,
      };
    });
    return {
      ...base,
      nodes: [...base.nodes, ...extra],
      edges: [...base.edges, ...userEdges.map((e) => ({ from: e.source, to: e.target }))],
    };
  }, [activePreset, nodeParams, metadataById, extraNodes, userEdges]);

  const flowRecommendations = useMemo(
    () => deriveFlowRecommendations(activePreset),
    [activePreset],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(promptSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activePreset.id}-promptspec.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [activePreset.id, promptSpec]);

  // Flow snapshot exporter
  const flowSnapshot = useMemo(() => {
    const extras = extraNodes.map((n) => ({
      id: n.id,
      baseId: (n.id.includes('#') ? n.id.split('#')[0] : n.id),
      position: n.position,
      params: nodeParams[n.id] ?? {},
    }));
    const uEdges = userEdges.map((e) => ({ source: e.source, target: e.target }));
    return {
      presetId: activePreset.id,
      extras,
      edges: uEdges,
    };
  }, [extraNodes, userEdges, nodeParams, activePreset.id]);

  const handleParamChange = (blockId: string, key: string, value: unknown) => {
    setNodeParams((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] ?? {}),
        [key]: value,
      },
    }));
  };

  const handleCreateNode = useCallback(
    (baseId: string, position: { x: number; y: number }, customId?: string) => {
      const uid = customId ?? `${baseId}#${Math.random().toString(36).slice(2, 7)}`;
      const descriptor = resolveBlockDescriptor(baseId, metadataById);
      const metadata = descriptor?.metadataId
        ? metadataById.get(descriptor.metadataId)
        : metadataById.get(baseId);

      if (metadata?.slots?.length) {
        setNodeParams((prev) => ({
          ...prev,
          [uid]: Object.fromEntries(
            metadata.slots.map((s) => [s.name, s.default ?? (s.type === "number" ? 0 : "")]),
          ),
        }));
      }

      setExtraNodes((prev) => [
        ...prev,
        {
          id: uid,
          position,
          type: "default",
          data: {
            label: descriptor?.name ?? metadata?.title ?? baseId,
            summary:
              descriptor?.description ??
              metadata?.when_to_use ??
              metadata?.failure_modes ??
              metadata?.acceptance_criteria ??
              "",
            category: descriptor?.category ?? metadata?.category,
            metadataId: metadata?.id ?? descriptor?.metadataId ?? baseId,
          },
        } as FlowNode,
      ]);

      setSelectedNodeId(uid);
    },
    [metadataById],
  );

  // Expose a test-only hook for creating nodes deterministically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      __testCreateNode?: (id: string, x?: number, y?: number) => void;
      __testReplaceFlow?: (snap: { presetId?: string; extras?: Array<{ id?: string; baseId?: string; position?: { x: number; y: number } }>; edges?: Array<{ source: string; target: string }> }) => void;
    };
    w.__testCreateNode = (id: string, x = 240, y = 160) => handleCreateNode(id, { x, y });
    w.__testReplaceFlow = (snap) => {
      if (snap.presetId && snap.presetId !== activePresetId) {
        setActivePresetId(snap.presetId);
      }
      setExtraNodes([]);
      setUserEdges([]);
      // Create nodes with provided ids so edges can match
      for (const ex of snap.extras ?? []) {
        const baseId = String(ex.baseId ?? (ex.id ? ex.id.split('#')[0] : 'node'));
        const id = String(ex.id ?? `${baseId}#${Math.random().toString(36).slice(2,7)}`);
        const pos = ex.position ?? { x: 240, y: 160 };
        handleCreateNode(baseId, pos, id);
      }
      // Add edges after nodes exist
      const added: Edge[] = [];
      for (const e of snap.edges ?? []) {
        if (e.source && e.target) {
          added.push({ id: `${e.source}-${e.target}-${added.length + 1}`, source: e.source, target: e.target });
        }
      }
      if (added.length) setUserEdges(added);
    };
    return () => {
      if ('__testCreateNode' in w) delete w.__testCreateNode;
      if ('__testReplaceFlow' in w) delete w.__testReplaceFlow;
    };
  }, [handleCreateNode, activePresetId]);

useEffect(() => {
  if (hasCustomLayout) return;
  let mounted = true;
  const defaultLayout = buildDefaultLayout(activePreset);
  setPositions(defaultLayout);
  import("@/lib/layout")
    .then(({ computeElkLayout }) => computeElkLayout(activePreset, defaultLayout))
    .then((layout) => {
      if (mounted) {
        setPositions(layout);
      }
    })
    .catch(() => {
      if (mounted) {
        setPositions(defaultLayout);
      }
    });
  return () => {
    mounted = false;
  };
}, [activePreset, hasCustomLayout]);

  return (
    <main className="h-screen bg-background text-foreground">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={18} minSize={14} className="border-r border-border bg-muted/20">
          <LibraryPanel
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            metadataMap={metadataById}
          />
        </Panel>
        <StyledResizeHandle />
        <Panel defaultSize={54} minSize={40}>
          <CanvasPanel
            onSelectNode={setSelectedNodeId}
            flow={activePreset}
            nodes={nodes}
            edges={edges}
            onExport={handleExport}
            promptSpec={promptSpec}
            presets={presets}
            activePresetId={activePreset.id}
            onPresetChange={setActivePresetId}
            flowRecommendations={flowRecommendations}
            onCreateNode={handleCreateNode}
            onConnectEdge={(c) => {
              if (c.source && c.target) {
                setUserEdges((prev) => [
                  ...prev,
                  { id: `${c.source}-${c.target}-${prev.length + 1}`, source: c.source, target: c.target },
                ]);
              }
            }}
          />
        </Panel>
        <StyledResizeHandle />
        <Panel defaultSize={28} minSize={18} className="border-l border-border bg-muted/10">
          <InspectorPanel
            selectedBlockId={selectedNodeId}
            metadataMap={metadataById}
            values={nodeParams[selectedNodeId] ?? {}}
            onValueChange={handleParamChange}
            promptSpec={promptSpec}
            blueprint={uiBlueprint}
          />
        </Panel>
      </PanelGroup>
    </main>
  );
}

function StyledResizeHandle() {
  return (
    <PanelResizeHandle className="w-px bg-border relative">
      <span className="absolute inset-y-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-10 w-[3px] rounded-full bg-muted-foreground/30" />
    </PanelResizeHandle>
  );
}

function LibraryPanel({
  selectedId,
  onSelect,
  metadataMap,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  metadataMap: Map<string, PromptMetadata>;
}) {
  const friendly = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      "system-mandate": "Role & Rules",
      "user-task": "Your Task",
      "rag-retriever": "Use Your Sources (RAG)",
      "exclusion-check": "Avoid Duplicates",
      "cov": "Verify Facts",
      "table-formatter": "Make a Table",
      "psa": "Robustness Check",
    };
    return map[id] ?? fallback;
  };
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <h2 className="text-lg font-semibold">Block Library</h2>
        <p className="text-sm text-muted-foreground">
          Drag blocks onto the canvas or inspect existing nodes.
        </p>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 py-3">
          {blockCatalog.map((block) => {
            const metadata = block.metadataId ? metadataMap.get(block.metadataId) : undefined;
            return (
              <Card
                key={block.id}
                data-testid={`block-card-${block.id}`}
                className={`cursor-grab transition hover:border-primary ${
                  selectedId === block.id ? "border-primary shadow-sm" : ""
                } ${block.status === "planned" ? "opacity-60" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-block-id", block.id);
                  e.dataTransfer.setData("text/plain", block.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onSelect(block.id)}
              >
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {friendly(block.id, block.name)}
                    {block.status === "planned" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Planned
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {metadata?.when_to_use
                      ? metadata.when_to_use.split("\n")[0]
                      : block.description}
                  </CardDescription>
                  {metadata && metadata.when_to_use && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Use when:</span>{" "}
                      {metadata.when_to_use.slice(0, 120)}
                      {metadata.when_to_use.length > 120 ? "…" : ""}
                    </p>
                  )}
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function CanvasPanel({
  onSelectNode,
  flow,
  nodes,
  edges,
  onExport,
  promptSpec,
  presets,
  activePresetId,
  onPresetChange,
  flowRecommendations,
  onCreateNode,
  onConnectEdge,
}: {
  onSelectNode: (id: string) => void;
  flow: FlowPreset;
  nodes: FlowNode[];
  edges: Edge[];
  onExport: () => void;
  promptSpec: PromptSpec;
  presets: FlowPreset[];
  activePresetId: string;
  onPresetChange: (id: string) => void;
  flowRecommendations: string[];
  onCreateNode: (baseId: string, position: { x: number; y: number }) => void;
  onConnectEdge: (conn: { source?: string; target?: string }) => void;
}) {
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [importText, setImportText] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunPreviewResponse | null>(null);

  // Test helper no longer needed here (defined at shell scope)

  const triggerRunPreview = useCallback(async () => {
    setDialogOpen(true);
    setIsRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promptSpec }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? `Run preview failed (${response.status}).`);
      }

      const data = (await response.json()) as RunPreviewResponse;
      setRunResult(data);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unknown error during run preview.");
    } finally {
      setIsRunning(false);
    }
  }, [promptSpec]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-background/60 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Select value={activePresetId} onValueChange={onPresetChange}>
              <SelectTrigger className="w-60" data-testid="flow-select">
                <SelectValue placeholder="Select flow" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {flow.sourcePath && (
              <span className="text-xs text-muted-foreground">{flow.sourcePath}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{flow.description}</p>
          {flowRecommendations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {flowRecommendations.map((rec) => (
                <span
                  key={rec}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  {rec}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Nodes {nodes.length} · Edges {edges.length}
          </span>
          <Dialog open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Flow (Save/Load)</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Flow Save / Load</DialogTitle>
                <DialogDescription>Copy your current flow or paste a JSON snapshot to load.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Export JSON</p>
                  <textarea
                    data-testid="flow-export-json"
                    readOnly
                    className="w-full h-40 rounded border bg-muted/40 p-2 text-xs font-mono"
                    value={JSON.stringify({ presetId: activePresetId, extras: nodes.filter(n => n.id.includes('#')).map(n => ({ id: n.id, baseId: n.id.split('#')[0], position: n.position })), edges: edges.map(e => ({ source: e.source, target: e.target })) }, null, 2)}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import JSON</p>
                  <textarea
                    data-testid="flow-import-json"
                    className="w-full h-32 rounded border bg-card p-2 text-xs font-mono"
                    placeholder='{"presetId":"baseline-deep-research","extras":[{"id":"rag-retriever#123","baseId":"rag-retriever","position":{"x":320,"y":160}}],"edges":[{"source":"rag-retriever#123","target":"cov"}]}'
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => {
                      try {
                        type SnapExtra = { id?: string; baseId?: string; position?: { x: number; y: number } };
                        type Snap = { presetId?: string; extras?: SnapExtra[]; edges?: Array<{ source: string; target: string }> };
                        const snap = JSON.parse(importText) as Snap;
                        if (snap.presetId && snap.presetId !== activePresetId) {
                          onPresetChange(snap.presetId);
                        }
                        // Append extras
                        const extras = (snap.extras ?? []).map((item: SnapExtra) => {
                          const id = String(item.id ?? `${item.baseId}#${Math.random().toString(36).slice(2,7)}`);
                          const baseId = String(item.baseId ?? id.split('#')[0]);
                          const pos = item.position ?? { x: 240, y: 160 };
                          return { id, baseId, pos };
                        });
                        // Use the shell's test hook to create nodes in place
                        // Set positions via events
                        for (const ex of extras) {
                          (window as unknown as { __testCreateNode?: (id: string, x?: number, y?: number) => void }).__testCreateNode?.(ex.baseId, ex.pos.x, ex.pos.y);
                        }
                        // Edges cannot be replayed safely here; user can rewire visually after load.
                        setFlowDialogOpen(false);
                      } catch {
                        alert('Invalid JSON');
                      }
                    }}>Load (Append)</Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      try {
                        const snap = JSON.parse(importText) as { presetId?: string; extras?: Array<{ id?: string; baseId?: string; position?: { x: number; y: number } }>; edges?: Array<{ source: string; target: string }> };
                        (window as unknown as { __testReplaceFlow?: (snap: unknown) => void }).__testReplaceFlow?.(snap);
                        setFlowDialogOpen(false);
                      } catch {
                        alert('Invalid JSON');
                      }
                    }}>Load (Replace)</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={onExport}>
            Export PromptSpec
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={triggerRunPreview} disabled={isRunning}>
                {isRunning ? "Running…" : "Run (Preview)"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Run Preview</DialogTitle>
                <DialogDescription>
                  Model execution wiring is coming next. This dry-run calls the local preview
                  endpoint using the compiled PromptSpec payload.
                </DialogDescription>
              </DialogHeader>
              {isRunning && (
                <p className="text-sm text-muted-foreground">Running preview…</p>
              )}
              {runError && !isRunning && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {runError}
                </div>
              )}
              {runResult && !isRunning && !runError && (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="font-medium">Run ID</p>
                    <p className="text-muted-foreground">{runResult.runId}</p>
                    <p className="mt-2 font-medium">Summary</p>
                    <p className="text-muted-foreground">
                      Blocks {runResult.manifest.blocks.length} · Nodes {runResult.manifest.nodeCount} · Edges {runResult.manifest.edgeCount}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{runResult.message}</p>
                  </div>
                  <div className="space-y-2">
                    {runResult.manifest.blocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed space-y-1"
                      >
                        <p className="text-sm font-semibold">{block.block}</p>
                        <p className="text-muted-foreground">
                          Output: {block.output.note ?? "No output"}
                        </p>
                        {block.output.guidance && (
                          <p className="text-muted-foreground">
                            Guidance: {block.output.guidance}
                          </p>
                        )}
                        {block.output.failureModes && (
                          <p className="text-muted-foreground">
                            Failure modes: {block.output.failureModes}
                          </p>
                        )}
                        {block.output.acceptanceCriteria && (
                          <p className="text-muted-foreground">
                            Acceptance criteria: {block.output.acceptanceCriteria}
                          </p>
                        )}
                        {Array.isArray(block.output.combinesWith) &&
                          block.output.combinesWith.length > 0 && (
                            <p className="text-muted-foreground">
                              Combines with: {block.output.combinesWith.join(", ")}
                            </p>
                          )}
                        {Array.isArray(block.output.compositionSteps) &&
                          block.output.compositionSteps.length > 0 && (
                            <p className="text-muted-foreground">
                              Composition steps: {block.output.compositionSteps.join(" → ")}
                            </p>
                          )}
                        {block.output.paramsUsed &&
                          Object.keys(block.output.paramsUsed).length > 0 && (
                            <p className="text-muted-foreground">
                              Params provided: {Object.keys(block.output.paramsUsed).join(", ")}
                            </p>
                          )}
                      </div>
                    ))}
                  </div>
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono">
                    {JSON.stringify(runResult, null, 2)}
                  </pre>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <Separator />
      <div className="relative flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => onSelectNode(node.id)}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1.2 }}
            className="bg-muted/30"
            nodeTypes={defaultNodeTypes}
            onInit={(inst) => setRf(inst)}
            onConnect={(conn) => onConnectEdge(conn)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const baseId = e.dataTransfer.getData("application/x-block-id") ||
                e.dataTransfer.getData("text/plain");
              if (!baseId) return;
              const bounds = (e.currentTarget as Element).getBoundingClientRect();
              const screenPos = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
              const position = rf ? rf.project(screenPos) : { x: screenPos.x, y: screenPos.y };
              onCreateNode(baseId, position);
            }}
          >
            <Background gap={24} size={1} color="#d4d4d8" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function InspectorPanel({
  selectedBlockId,
  metadataMap,
  values,
  onValueChange,
  promptSpec,
  blueprint,
}: {
  selectedBlockId: string;
  metadataMap: Map<string, PromptMetadata>;
  values: Record<string, unknown>;
  onValueChange: (blockId: string, key: string, value: unknown) => void;
  promptSpec: PromptSpec;
  blueprint: UIBlueprint;
}) {
  const baseId = selectedBlockId.split("#")[0];
  const descriptor = resolveBlockDescriptor(baseId, metadataMap);
  const metadata =
    (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
    metadataMap.get(baseId);

  if (!descriptor && !metadata) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a block to view details and configuration guidance.
      </div>
    );
  }

  const effectiveDescriptor =
    descriptor ??
    ({
      id: baseId,
      name: metadata?.title ?? baseId,
      category: metadata?.category ?? "Structure",
      description: metadata?.when_to_use ?? "Prompt loaded from composition metadata.",
      status: "available",
      metadataId: metadata?.id,
      references: metadata?.relativePath ? [metadata.relativePath] : undefined,
    } as const);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Inspector</p>
        <h2 className="text-xl font-semibold">{effectiveDescriptor.name}</h2>
        <p className="text-sm text-muted-foreground">{effectiveDescriptor.description}</p>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-4 py-3">
        <section className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </p>
            <p>{effectiveDescriptor.category}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <p className="capitalize">{effectiveDescriptor.status}</p>
          </div>
          {metadata?.tags && metadata.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {metadata?.when_to_use && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Guide</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><span className="text-foreground font-medium">What it does:</span> {effectiveDescriptor.description}</li>
                {metadata.when_to_use && (
                  <li><span className="text-foreground font-medium">When to use:</span> {metadata.when_to_use.split('\n')[0]}</li>
                )}
                {metadata.failure_modes && (
                  <li><span className="text-foreground font-medium">Watch out:</span> {metadata.failure_modes.split('\n')[0]}</li>
                )}
              </ul>
            </div>
          )}
          {metadata?.failure_modes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Failure modes
              </p>
              <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {metadata.failure_modes}
              </p>
            </div>
          )}
          {metadata?.acceptance_criteria && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acceptance criteria
              </p>
              <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {metadata.acceptance_criteria}
              </p>
            </div>
          )}
          {effectiveDescriptor.references && effectiveDescriptor.references.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source templates
              </p>
              <ul className="list-disc pl-5 text-primary">
                {effectiveDescriptor.references.map((ref) => (
                  <li key={ref} className="truncate underline decoration-dotted">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <BlockParameters
            blockId={selectedBlockId}
            metadata={metadata}
            values={values}
            onValueChange={onValueChange}
            blueprint={blueprint}
          />
          <PromptPreview metadata={metadata} values={values} />
          <FlowSpecView promptSpec={promptSpec} focusedNodeId={selectedBlockId} />
          <CoachPanel insights={deriveCoachInsights(metadata)} />
        </section>
      </ScrollArea>
    </div>
  );
}

function BlockParameters({
  blockId,
  metadata,
  values,
  onValueChange,
  blueprint,
}: {
  blockId: string;
  metadata?: PromptMetadata;
  values: Record<string, unknown>;
  onValueChange: (blockId: string, key: string, value: unknown) => void;
  blueprint: UIBlueprint;
}) {
  if (!metadata?.slots || metadata.slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        This block does not expose slot parameters yet. Additional configuration will appear here as
        schemas are added.
      </div>
    );
  }

  const renderingHints = deriveRenderingHints(metadata, blueprint);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parameters
        </p>
      </div>
      {renderingHints.length > 0 && (
        <div className="space-y-2">
          {renderingHints.map((hint) => (
            <div
              key={hint}
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              {hint}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {metadata.slots.map((slot) => (
          <SlotField
            key={slot.name}
            slot={slot}
            value={values?.[slot.name]}
            onChange={(value) => onValueChange(blockId, slot.name, value)}
            blueprint={blueprint}
          />
        ))}
      </div>
    </div>
  );
}

function SlotField({
  slot,
  value,
  onChange,
  blueprint,
}: {
  slot: SlotDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  blueprint: UIBlueprint;
}) {
  const id = `slot-${slot.name}`;
  const type = slot.type ?? "text";
  const controlConfig = blueprint.slot_controls[type];
  const component = controlConfig?.component ?? inferComponent(type);
  const controlProps = controlConfig?.props ?? {};
  const testId = `slot-${slot.name}`;

  const normalizedOptions =
    slot.options?.map((option) =>
      typeof option === "string" ? { label: option, value: option } : option,
    ) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{slot.label ?? slot.name}</Label>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{type}</span>
      </div>
      {component === "Textarea" ? (
        <Textarea
          id={id}
          name={slot.name}
          data-testid={testId}
          value={
            typeof value === "string"
              ? value
              : typeof slot.default === "string"
              ? slot.default
              : ""
          }
          onChange={(event) => onChange(event.target.value)}
          placeholder={slot.help}
          rows={typeof controlProps.rows === "number" ? controlProps.rows : 5}
        />
      ) : component === "Select" ? (
        <Select
          value={
            typeof value === "string"
              ? value
              : typeof slot.default === "string"
              ? slot.default
              : undefined
          }
          onValueChange={(selected) => onChange(selected)}
        >
          <SelectTrigger id={id} data-testid={testId}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                data-testid={`${testId}-option-${option.value}`}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : component === "MultiSelect" ? (
        <Textarea
          id={id}
          name={slot.name}
          data-testid={testId}
          value={
            Array.isArray(value)
              ? value.join(", ")
              : Array.isArray(slot.default)
              ? slot.default.join(", ")
              : ""
          }
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          placeholder="Comma-separated values"
        />
      ) : component === "Switch" ? (
        <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
          <Switch
            id={id}
            checked={typeof value === "boolean" ? value : Boolean(slot.default)}
            data-testid={testId}
            onCheckedChange={onChange}
          />
          <span className="text-sm text-muted-foreground">
            {slot.help ?? "Enable or disable this setting."}
          </span>
        </div>
      ) : component === "NumberInput" ? (
        <Input
          id={id}
          name={slot.name}
          type="number"
          data-testid={testId}
          value={
            typeof value === "number"
              ? value
              : typeof slot.default === "number"
              ? slot.default
              : ""
          }
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          placeholder={slot.help}
          min={typeof controlProps.min === "number" ? controlProps.min : undefined}
          max={typeof controlProps.max === "number" ? controlProps.max : undefined}
          step={typeof controlProps.step === "number" ? controlProps.step : undefined}
        />
      ) : (
        <Input
          id={id}
          name={slot.name}
          data-testid={testId}
          value={
            typeof value === "string"
              ? value
              : typeof slot.default === "string"
              ? slot.default
              : ""
          }
          onChange={(event) => onChange(event.target.value)}
          placeholder={slot.help}
        />
      )}
      {slot.help && type !== "toggle" && (
        <p className="text-xs text-muted-foreground">{slot.help}</p>
      )}
    </div>
  );
}

function PromptPreview({
  metadata,
  values,
}: {
  metadata?: PromptMetadata;
  values: Record<string, unknown>;
}) {
  if (!metadata?.prompt) {
    return null;
  }

  const rendered = renderPromptTemplate(metadata.prompt, values);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Prompt preview
      </p>
      <pre
        className="max-h-64 overflow-auto rounded-lg bg-card p-3 text-xs leading-relaxed text-card-foreground whitespace-pre-wrap font-mono"
        data-testid="prompt-preview"
      >
        {rendered}
      </pre>
    </div>
  );
}

function FlowSpecView({
  promptSpec,
  focusedNodeId,
}: {
  promptSpec: PromptSpec;
  focusedNodeId: string;
}) {
  const nodeSpec = promptSpec.nodes.find((node) => node.id === focusedNodeId);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        PromptSpec (node)
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre font-mono">
        {JSON.stringify(nodeSpec, null, 2)}
      </pre>
      <details className="group rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-foreground">
          Full flow spec ({promptSpec.nodes.length} nodes)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-card p-3 text-[11px] leading-relaxed text-card-foreground whitespace-pre-wrap font-mono">
          {JSON.stringify(promptSpec, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function deriveRenderingHints(metadata: PromptMetadata, blueprint: UIBlueprint): string[] {
  const hints: string[] = [];
  for (const rule of blueprint.rendering_rules ?? []) {
    const tagMatch = rule.if_tag && metadata.tags?.includes(rule.if_tag);
    const categoryMatch = rule.if_category && metadata.category === rule.if_category;
    if ((tagMatch || categoryMatch) && rule.hint) {
      hints.push(rule.hint);
    }
  }
  return hints;
}

export function deriveFlowRecommendations(flow: FlowPreset): string[] {
  const recommendations: string[] = [];
  const nodes = new Set(flow.nodeIds);

  if (nodes.has("rag-retriever") && !nodes.has("cov")) {
    recommendations.push("Add Chain of Verification after RAG for factual checks.");
  }
  if (nodes.has("rag-retriever") && !nodes.has("exclusion-check")) {
    recommendations.push("Add Exclusion Check to enforce novelty before verification.");
  }
  if (nodes.has("table-formatter") && !nodes.has("thinking-with-tables")) {
    recommendations.push("Consider adding Thinking with Tables before final formatting.");
  }
  if (nodes.has("cov") && !nodes.has("recursive-self-improvement")) {
    recommendations.push("Optionally add RSIP after CoV for iterative refinement.");
  }
  return recommendations;
}

function deriveCoachInsights(metadata?: PromptMetadata): CoachInsight[] {
  const insights: CoachInsight[] = [];

  if (!metadata) {
    return insights;
  }

  if (metadata.when_to_use) {
    insights.push({ title: "When to use", detail: metadata.when_to_use });
  }
  if (metadata.failure_modes) {
    insights.push({ title: "Failure modes", detail: metadata.failure_modes });
  }
  if (metadata.acceptance_criteria) {
    insights.push({ title: "Acceptance criteria", detail: metadata.acceptance_criteria });
  }
  if (metadata.combines_with?.length) {
    insights.push({
      title: "Combines with",
      detail: metadata.combines_with.join(", "),
    });
  }
  if (metadata.composition_steps?.length) {
    insights.push({
      title: "Composition steps",
      detail: metadata.composition_steps.join(" → "),
    });
  }
  if (metadata.relativePath) {
    insights.push({
      title: "Source file",
      detail: metadata.relativePath,
    });
  }

  return insights;
}

function inferComponent(type: string): string {
  switch (type) {
    case "textarea":
      return "Textarea";
    case "select":
      return "Select";
    case "multiselect":
      return "MultiSelect";
    case "toggle":
      return "Switch";
    case "number":
      return "NumberInput";
    default:
      return "TextInput";
  }
}

function buildInitialNodeParams(
  preset: FlowPreset,
  metadataMap: Map<string, PromptMetadata>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const nodeId of preset.nodeIds) {
    const descriptor = resolveBlockDescriptor(nodeId, metadataMap);
    const metadata =
      (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
      metadataMap.get(nodeId);
    if (!metadata?.slots) continue;

    result[nodeId] = {};
    for (const slot of metadata.slots) {
      if (slot?.name) {
        result[nodeId][slot.name] = slot.default ?? "";
      }
    }
  }
  return result;
}

const defaultNodeTypes = {
  default: memo(function FlowCanvasNode({ id, data, selected }: NodeProps<FlowNodeData>) {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Left} id="in" style={{ top: '50%' }} />
        <CanvasNodeCard
          id={id}
          label={data.label}
          summary={data.summary}
          category={data.category}
          selected={selected}
        />
        <Handle type="source" position={Position.Right} id="out" style={{ top: '50%' }} />
      </div>
    );
  }),
};
