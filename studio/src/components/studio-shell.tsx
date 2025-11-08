"use client";

import { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  NodeProps,
  type ReactFlowInstance,
  Handle,
  Position,
  ReactFlowProvider,
  MarkerType,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { blockCatalog, type BlockDescriptor } from "@/data/block-catalog";
import type {
  PromptMetadata,
  SlotDefinition,
  ModalityRequirement,
  ModalityState,
  AudioTimelinePayload,
  VideoEventGraphPayload,
  SceneGraphPayload,
} from "@/types/prompt-metadata";
import uiBlueprintJson from "@/config/uiBlueprint.json" assert { type: "json" };
import type { UIBlueprint } from "@/types/ui-blueprint";
import { CoachPanel, type CoachInsight } from "@/components/coach-panel";

import { useHotkeys } from "react-hotkeys-hook";

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
import { SmartEdge } from "@/components/flow-edge";
import { resolveBlockDescriptor } from "@/lib/blocks";
import { evaluateExpression } from "@/lib/mapping-expression";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ModalityRequirementSection,
  SceneGraphBuilder,
  VideoEventGraphBuilder,
  WaveformEditor,
} from "@/components/modality-controls";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DndContext, DragOverlay, useDraggable } from "@dnd-kit/core";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import type { RunRecord } from "@/types/run";
import type { ApprovalTask } from "@/types/approval";

const RAG_DEFAULT_PARAMS = {
  rag_sources: [] as RagSource[],
  rag_topK: 5,
  rag_chunkSize: 1200,
  rag_chunkOverlap: 120,
  rag_citationStyle: "inline",
  rag_sampleQuery: "",
  rag_sampleContext: "",
};

const isRagBlock = (baseId: string) => baseId === "rag-retriever" || baseId === "graphrag";
const APPROVAL_DEFAULT_PARAMS = {
  approval_assignees: [] as string[],
  approval_slaHours: 0,
  approval_autoApprove: false,
  approval_notes: "",
};
const isApprovalBlock = (baseId: string) => baseId === "approval-gate";

const cloneRagDefaults = (): typeof RAG_DEFAULT_PARAMS => ({
  ...RAG_DEFAULT_PARAMS,
  rag_sources: [],
});

const cloneApprovalDefaults = (): typeof APPROVAL_DEFAULT_PARAMS => ({
  ...APPROVAL_DEFAULT_PARAMS,
  approval_assignees: [],
});

type RunPreviewResponse = RunRecord;

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
  status?: 'idle' | 'running' | 'completed' | 'failed';
};

type FlowNode = Node<FlowNodeData>;
type RagSource = { kind: "file" | "web" | "collection"; ref: string };
type FlowSnapshot = {
  extraNodes: FlowNode[];
  userEdges: Edge[];
  positions: Record<string, { x: number; y: number }>;
  customLabels: Record<string, string>;
  nodeParams: Record<string, Record<string, unknown>>;
  selectedNodeId: string;
};
type TestFlowImport = {
  presetId?: string;
  extras?: Array<{
    id?: string;
    baseId?: string;
    position?: { x: number; y: number };
    label?: string;
    params?: Record<string, unknown>;
  }>;
  edges?: Array<{ source: string; target: string }>;
};
type StudioTestWindow = Window &
  typeof globalThis & {
    __extraNodes?: string[];
    __testCreateNode?: (id: string, x?: number, y?: number) => void;
    __testReplaceFlow?: (snap: TestFlowImport) => void;
    __testDeleteFirstExtra?: () => void;
    __testOpenQuickInsert?: (edgeId: string) => void;
    __testOpenCommandPalette?: () => void;
    __testOpenNodeMenu?: (id: string) => void;
    __testShowToolbarFor?: (id: string) => void;
    __testGetExtraIds?: () => string[];
    __lastMousePos?: { x: number; y: number };
  };

const getTestWindow = (): StudioTestWindow | null =>
  typeof window === "undefined" ? null : (window as StudioTestWindow);

const escapeNodeId = (value: string) => {
  if (typeof window === "undefined") return value;
  return typeof window.CSS?.escape === "function"
    ? window.CSS.escape(value)
    : value.replace(/([#.:\[\],=])/g, "\\$1");
};

function renderPromptTemplate(template: string, context: Record<string, unknown>): string {
  const renderedConditionals = template.replace(
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, rawKey, blockContent) => {
      const key = String(rawKey).trim();
      const value = evaluateExpression(key, context);
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
    const expr = String(rawKey).trim();
    const value = evaluateExpression(expr, context);
    if (value === undefined || value === null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) return value.join(", ");
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
      label: inferEdgeLabel(source),
      labelBgPadding: [4,2],
      labelStyle: { fontSize: 10, fill: '#334155' },
      style: { strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#334155' },
      type: 'smart',
      data: { editable: false },
    });
  }
  return edges;
}

function inferEdgeLabel(sourceId: string): string {
  const base = sourceId.split('#')[0];
  switch (base) {
    case 'system-mandate':
      return 'role & scope';
    case 'user-task':
      return 'task context';
    case 'rag-retriever':
      return 'retrieved text';
    case 'exclusion-check':
      return 'filtered items';
    case 'cov':
      return 'verified output';
    default:
      return 'data';
  }
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
  const getNodeParams = useCallback((id: string) => nodeParams[id] ?? {}, [nodeParams]);

  // Extra nodes created via drag-and-drop
  const [extraNodes, setExtraNodes] = useState<FlowNode[]>([]);
  // Mirror extra node ids for tests
useEffect(() => {
  const testWindow = getTestWindow();
  if (!testWindow) return;
  testWindow.__extraNodes = extraNodes.map((n) => n.id);
}, [extraNodes]);

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

  const [userEdges, setUserEdges] = useState<Edge[]>([]);
  const edges = useMemo(() => [...buildEdges(activePreset), ...userEdges], [activePreset, userEdges]);
  // toast message + custom labels per preset
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [dragOverlayBlock, setDragOverlayBlock] = useState<{ label: string; summary?: string; category?: string } | null>(null);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [librarySheetOpen, setLibrarySheetOpen] = useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  // simple undo/redo history
  const [historyPast, setHistoryPast] = useState<FlowSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<FlowSnapshot[]>([]);
  const hydratedExtrasRef = useRef(false);
  const baselineNodes = useMemo(() => {
    const base = buildNodes(activePreset, positions, metadataById);
    return base.map((n) => ({
      ...n,
      data: {
        ...n.data,
        label: customLabels[n.id] ?? n.data.label,
      },
    }));
  }, [activePreset, positions, metadataById, customLabels]);
  const nodes = useMemo(() => [...baselineNodes, ...extraNodes], [baselineNodes, extraNodes]);
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

  const ragConnections = useMemo(() => {
    const ragNodeIds = new Set(
      promptSpec.nodes
        .filter((node) => {
          const baseId = node.id.split("#")[0];
          return baseId === "rag-retriever" || baseId === "graphrag";
        })
        .map((node) => node.id),
    );
    const connected = new Set<string>();
    for (const edge of promptSpec.edges) {
      const fromBase = edge.from.split("#")[0];
      if (ragNodeIds.has(edge.from) || ragNodeIds.has(fromBase)) {
        connected.add(edge.to);
        connected.add(edge.to.split("#")[0]);
      }
    }
    return connected;
  }, [promptSpec]);

  const flowRecommendations = useMemo(
    () => deriveFlowRecommendations(activePreset),
    [activePreset],
  );
  // Clipboard helpers
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (typeof window !== 'undefined') window.setTimeout(() => setToastMsg(null), 2200);
  }, []);;
  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data?.approvals)) {
        setApprovals(data.approvals as ApprovalTask[]);
      }
    } catch {
      // ignore fetch errors
    }
  }, []);
  const pendingApprovals = approvals.filter((task) => task.status === "pending");
  const handleApprovalAction = useCallback(
    async (task: ApprovalTask, action: "approve" | "reject") => {
      const note =
        action === "reject"
          ? window.prompt("Add a note for the requester (optional):", task.notes ?? "") ?? undefined
          : undefined;
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, action, note }),
      }).catch(() => undefined);
      loadApprovals();
    },
    [loadApprovals],
  );
  useEffect(() => {
    if (!approvalsOpen) return;
    loadApprovals();
  }, [approvalsOpen, loadApprovals]);
  const resolveBlockPreview = useCallback((blockId: string) => {
    const baseId = blockId.split('#')[0];
    const fromCatalog = blockCatalog.find((b) => b.id === baseId);
    const meta = fromCatalog?.metadataId
      ? metadataById.get(fromCatalog.metadataId)
      : metadataById.get(baseId);
    const summary = composeBlockSummary(fromCatalog, meta);
    return {
      label: fromCatalog?.name ?? meta?.title ?? baseId,
      summary,
      category: fromCatalog?.category ?? meta?.category ?? 'Structure',
    };
  }, [metadataById]);

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
      label: n.data?.label,
      params: nodeParams[n.id] ?? {},
    }));
    const uEdges = userEdges.map((e) => ({ source: e.source, target: e.target }));
    return {
      presetId: activePreset.id,
      extras,
      edges: uEdges,
    };
  }, [extraNodes, userEdges, nodeParams, activePreset.id]);

  // Tiny toast helper
  const copyNodeId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard?.writeText(id);
      showToast('Node ID copied');
    } catch {
      showToast('Clipboard unavailable');
    }
  }, [showToast]);

  const copyBaseId = useCallback(async (id: string) => {
    const base = id.includes('#') ? id.split('#')[0] : id;
    try {
      await navigator.clipboard?.writeText(base);
      showToast('Base ID copied');
    } catch {
      showToast('Clipboard unavailable');
    }
  }, [showToast]);

  const copyNodeJson = useCallback(
    async (id: string) => {
      const node = nodes.find((x) => x.id === id);
      if (!node) return;
      const data = node.data;
      const json = JSON.stringify(
        {
          id: node.id,
          baseId: node.id.includes("#") ? node.id.split("#")[0] : node.id,
          position: node.position,
          label: data?.label ?? node.id,
          params: getNodeParams(node.id),
        },
        null,
        2,
      );
      try {
        await navigator.clipboard?.writeText(json);
        showToast("Node JSON copied");
      } catch {
        showToast("Clipboard unavailable");
      }
    },
    [nodes, getNodeParams, showToast],
  );

  const copyTemplate = useCallback(
    async (id: string) => {
      const node = nodes.find((x) => x.id === id);
      if (!node) return;
      const baseId = node.id.includes("#") ? node.id.split("#")[0] : node.id;
      const params = Object.keys(getNodeParams(id) ?? {});
      const tpl = {
        id: baseId,
        name: node.data?.label ?? baseId,
        description: node.data?.summary ?? "",
        slots: params.map((p) => ({ name: p, type: "text", default: "" })),
      };
      try {
        await navigator.clipboard?.writeText(JSON.stringify(tpl, null, 2));
        showToast("Template JSON copied");
      } catch {
        showToast("Clipboard unavailable");
      }
    },
    [nodes, getNodeParams, showToast],
  );

  // History helpers
  const snapshotState = useCallback<() => FlowSnapshot>(
    () => ({
      extraNodes,
      userEdges,
      positions,
      customLabels,
      nodeParams,
      selectedNodeId,
    }),
    [extraNodes, userEdges, positions, customLabels, nodeParams, selectedNodeId],
  );

  const applySnapshot = useCallback((snap: FlowSnapshot) => {
    setExtraNodes(snap.extraNodes ?? []);
    setUserEdges(snap.userEdges ?? []);
    setPositions(snap.positions ?? {});
    setCustomLabels(snap.customLabels ?? {});
    setNodeParams(snap.nodeParams ?? {});
    if (snap.selectedNodeId) {
      setSelectedNodeId(snap.selectedNodeId);
    }
  }, []);

  const pushHistory = useCallback(() => {
    setHistoryPast((prev) => [...prev, snapshotState()]);
    setHistoryFuture([]);
  }, [snapshotState]);


  useHotkeys(["ctrl+z", "meta+z"], () => {
    if (!historyPast.length) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryPast((p) => p.slice(0, -1));
    setHistoryFuture((f) => [snapshotState(), ...f]);
    applySnapshot(prev);
  }, [historyPast, snapshotState, applySnapshot]);

  useHotkeys(["ctrl+shift+z", "meta+shift+z"], () => {
    if (!historyFuture.length) return;
    const [next, ...rest] = historyFuture;
    setHistoryFuture(rest);
    setHistoryPast((p) => [...p, snapshotState()]);
    applySnapshot(next);
  }, [historyFuture, snapshotState, applySnapshot]);


  // Persist extras and user edges for the active preset
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`${storageKey}:extras`, JSON.stringify(flowSnapshot));
    } catch {}
  }, [flowSnapshot, storageKey]);

  // Persist custom labels per preset
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`${storageKey}:labels`, JSON.stringify(customLabels));
    } catch {}
  }, [customLabels, storageKey]);

  // Rehydrate extras, edges, and labels once per preset
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedExtrasRef.current) return;
    const stored = window.localStorage.getItem(`${storageKey}:extras`);
    const storedLabels = window.localStorage.getItem(`${storageKey}:labels`);
    try {
      if (stored) {
        const snap = JSON.parse(stored) as {
          presetId: string;
          extras: Array<{ id: string; baseId?: string; position?: { x: number; y: number }; label?: string; params?: Record<string, unknown> }>;
          edges: Array<{ source: string; target: string }>;
        };

        if (snap?.extras?.length) {
          const extrasWithContext: Array<{
            ex: {
              id: string;
              baseId?: string;
              position?: { x: number; y: number };
              label?: string;
              params?: Record<string, unknown>;
            };
            id: string;
            baseId: string;
            descriptor?: BlockDescriptor;
            metadata?: PromptMetadata;
          }> = [];

          for (const ex of snap.extras) {
            if (!ex?.id) continue;
            const baseId = ex.baseId ?? (ex.id.includes('#') ? ex.id.split('#')[0] : ex.id);
            const descriptor = resolveBlockDescriptor(baseId, metadataById);
            const metadata = descriptor?.metadataId
              ? metadataById.get(descriptor.metadataId)
              : metadataById.get(baseId);
            extrasWithContext.push({ ex, id: ex.id, baseId, descriptor, metadata });
          }

          const rebuilt: FlowNode[] = extrasWithContext.map(({ ex, id, baseId, descriptor, metadata }) => ({
            id,
            position: ex.position ?? { x: 240, y: 160 },
            type: 'default',
            data: {
              label: ex.label ?? descriptor?.name ?? metadata?.title ?? baseId,
              summary: composeBlockSummary(descriptor, metadata),
              category: descriptor?.category ?? metadata?.category,
              metadataId: metadata?.id ?? descriptor?.metadataId ?? baseId,
            },
          } as FlowNode));

          setExtraNodes(rebuilt);
          setNodeParams((prev) => {
            const next = { ...prev } as Record<string, Record<string, unknown>>;
            for (const entry of extrasWithContext) {
              const restored =
                entry.ex.params && typeof entry.ex.params === "object"
                  ? (entry.ex.params as Record<string, unknown>)
                  : {};
              const defaults = buildDefaultParamsForBlock(entry.baseId, metadataById);
              const combined = {
                ...(Object.keys(defaults).length > 0 ? defaults : {}),
                ...(next[entry.id] ?? {}),
                ...restored,
              } as Record<string, unknown>;
              if (Object.keys(combined).length > 0) {
                next[entry.id] = combined;
              }
            }
            return next;
          });
        }
        if (snap?.edges?.length) {
          setUserEdges(
            snap.edges
              .filter((e) => !!e.source && !!e.target)
              .map((e, i) => ({ id: `${e.source}-${e.target}-${i + 1}`, source: e.source, target: e.target })),
          );
        }
      }
      if (storedLabels) {
        const labels = JSON.parse(storedLabels) as Record<string, string>;
        setCustomLabels(labels);
      }
    } catch {}
    hydratedExtrasRef.current = true;
  }, [metadataById, storageKey]);


  const undo = useCallback(() => {
    if (!historyPast.length) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryPast((p) => p.slice(0, -1));
    setHistoryFuture((f) => [snapshotState(), ...f]);
    applySnapshot(prev);
  }, [historyPast, snapshotState, applySnapshot]);

  const redo = useCallback(() => {
    if (!historyFuture.length) return;
    const [next, ...rest] = historyFuture;
    setHistoryFuture(rest);
    setHistoryPast((p) => [...p, snapshotState()]);
    applySnapshot(next);
  }, [historyFuture, snapshotState, applySnapshot]);

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
      pushHistory();
      const uid = customId ?? `${baseId}#${Math.random().toString(36).slice(2, 7)}`;
      const descriptor = resolveBlockDescriptor(baseId, metadataById);
      const metadata = descriptor?.metadataId
        ? metadataById.get(descriptor.metadataId)
        : metadataById.get(baseId);

      const defaultParams = buildDefaultParamsForBlock(baseId, metadataById);
      if (Object.keys(defaultParams).length > 0) {
        setNodeParams((prev) => ({
          ...prev,
          [uid]: defaultParams,
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
            summary: composeBlockSummary(descriptor, metadata),
            category: descriptor?.category ?? metadata?.category,
            metadataId: metadata?.id ?? descriptor?.metadataId ?? baseId,
          },
        } as FlowNode,
      ]);

      setSelectedNodeId(uid);
    },
    [metadataById, pushHistory],
  );

  const handleDeleteNode = useCallback((id: string) => {
    pushHistory();
    if (!id.includes('#')) return; // only extras are removable
    setExtraNodes((prev) => prev.filter((n) => n.id !== id));
    setUserEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setNodeParams((prev) => {
      const next = { ...prev } as Record<string, Record<string, unknown>>;
      delete next[id];
      return next;
    });
    try { if (typeof window !== 'undefined') window.localStorage.removeItem(`${storageKey}:extras`); } catch {}
    showToast('Node deleted');
  }, [showToast, storageKey, pushHistory]);

  const handleDuplicateNode = useCallback((id: string) => {
    pushHistory();
    const all = [...nodes];
    const found = all.find((n) => n.id === id);
    const baseId = id.includes('#') ? id.split('#')[0] : id;
    const pos = found?.position ?? { x: 240, y: 160 };
    handleCreateNode(baseId, { x: pos.x + 40, y: pos.y + 40 });
    showToast('Node duplicated');
  }, [nodes, handleCreateNode, showToast, pushHistory]);
  const handleRenameNode = useCallback((id: string, label: string) => {
    pushHistory();
    if (id.includes('#')) {
      setExtraNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
    } else {
      setCustomLabels((prev) => ({ ...prev, [id]: label }));
    }
    showToast('Node renamed');
  }, [showToast, pushHistory]);

  // Expose a test-only hook for creating nodes deterministically

  useEffect(() => {
    const testWindow = getTestWindow();
    if (!testWindow) return;
    testWindow.__testCreateNode = (id: string, x = 240, y = 160) => handleCreateNode(id, { x, y });
    testWindow.__testReplaceFlow = (snap: TestFlowImport) => {
      if (snap.presetId && snap.presetId !== activePresetId) {
        setActivePresetId(snap.presetId);
      }
      setExtraNodes([]);
      setUserEdges([]);
      for (const ex of snap.extras ?? []) {
        const baseId = String(ex.baseId ?? (ex.id ? ex.id.split("#")[0] : "node"));
        const nextId = String(ex.id ?? `${baseId}#${Math.random().toString(36).slice(2, 7)}`);
        const pos = ex.position ?? { x: 240, y: 160 };
        handleCreateNode(baseId, pos, nextId);
      }
      const added: Edge[] = [];
      for (const edge of snap.edges ?? []) {
        if (edge.source && edge.target) {
          added.push({ id: `${edge.source}-${edge.target}-${added.length + 1}`, source: edge.source, target: edge.target });
        }
      }
      if (added.length) setUserEdges(added);
    };
    return () => {
      delete testWindow.__testCreateNode;
      delete testWindow.__testReplaceFlow;
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
      <DndContext
        onDragStart={(e) => {
          const id = String(e.active.id ?? '');
          if (!id) return;
          const preview = resolveBlockPreview(id);
          setDragOverlayBlock(preview);
          setIsDraggingBlock(true);
        }}
        onDragEnd={(e) => {
          const id = String(e.active.id ?? '');
          setDragOverlayBlock(null);
          setIsDraggingBlock(false);
          if (!id) return;
          getTestWindow()?.__testCreateNode?.(id, 320, 180);
        }}
        onDragCancel={() => {
          setDragOverlayBlock(null);
          setIsDraggingBlock(false);
        }}
      >
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={18} minSize={12} className="hidden border-r border-border bg-muted/20 lg:block">
          <LibraryPanel
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            metadataMap={metadataById}
          />
        </Panel>
        <StyledResizeHandle />
        <Panel defaultSize={64} minSize={50}>
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
            onToast={showToast}
            onUndo={undo}
            onRedo={redo}
            canUndo={historyPast.length > 0}
            canRedo={historyFuture.length > 0}
            isDraggingBlock={isDraggingBlock}
            onCreateNode={(baseId, position) => {
              handleCreateNode(baseId, position);
              // Auto-connect from currently selected node if any
              setTimeout(() => {
                const last = (document.querySelector('[data-node-instance="extra"]')?.getAttribute('data-testid') ?? '').replace('flow-node-','');
                if (last && selectedNodeId) {
                  setUserEdges((prev) => [...prev, { id: `${selectedNodeId}-${last}-${prev.length+1}`, source: selectedNodeId, target: last, label: inferEdgeLabel(selectedNodeId), labelBgPadding: [4,2], labelStyle: { fontSize: 10, fill: '#334155' } }]);
                }
              }, 0);
            }}
            onConnectEdge={(c) => {
              if (c.source && c.target) {
                const s = c.source as string;
                const t = c.target as string;
                setUserEdges((prev) => [
                  ...prev,
                  { id: `${s}-${t}-${prev.length + 1}` , source: s, target: t, label: inferEdgeLabel(s), labelBgPadding: [4,2], labelStyle: { fontSize: 10, fill: '#334155' }, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#334155' } },
                ]);
              }
            }}
            onDeleteEdge={(id) => { setUserEdges((prev) => prev.filter((e) => e.id !== id)); showToast('Edge deleted'); }}
            onRenameEdge={(id, label) => { setUserEdges((prev) => prev.map((e) => e.id === id ? { ...e, label } : e)); showToast('Edge renamed'); }}
            canEditEdge={(id) => userEdges.some((e) => e.id === id)}
            onCopyId={copyNodeId}
            onCopyBaseId={copyBaseId}
            onCopyJson={copyNodeJson}
            onConvertToTemplate={copyTemplate}
            onOpenLibrarySheet={() => setLibrarySheetOpen(true)}
            onOpenInspectorSheet={() => setInspectorSheetOpen(true)}
            onOpenApprovals={() => setApprovalsOpen(true)}
            onRefreshApprovals={loadApprovals}
            pendingApprovalCount={pendingApprovals.length}
            onMoveNode={(id, position) => {
              // record history before movement
              pushHistory();
              if (id.includes('#')) {
                setExtraNodes((prev) => prev.map((n) => (n.id === id ? { ...n, position } : n)));
              } else {
                setPositions((prev) => ({ ...prev, [id]: position }));
              }
            }}
            onResetFlow={() => {
              pushHistory();
              setExtraNodes([]);
              setUserEdges([]);
              if (typeof window !== 'undefined') {
                try { window.localStorage.removeItem(`${storageKey}:extras`); } catch {}
              }
              showToast('Flow reset');
            }}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onRenameNode={handleRenameNode}
          />
        </Panel>
        <StyledResizeHandle />
        <Panel defaultSize={18} minSize={12} className="hidden border-l border-border bg-muted/10 lg:block">
          <InspectorPanel
            selectedBlockId={selectedNodeId}
            metadataMap={metadataById}
            values={nodeParams[selectedNodeId] ?? {}}
            onValueChange={handleParamChange}
            promptSpec={promptSpec}
            blueprint={uiBlueprint}
            ragConnections={ragConnections}
          />
        </Panel>
      </PanelGroup>
      <Dialog open={librarySheetOpen} onOpenChange={setLibrarySheetOpen}>
        <DialogContent className="h-[80vh] max-w-2xl overflow-hidden p-0">
          <LibraryPanel
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            metadataMap={metadataById}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen}>
        <DialogContent className="h-[80vh] max-w-2xl overflow-hidden p-0">
          <InspectorPanel
            selectedBlockId={selectedNodeId}
            metadataMap={metadataById}
            values={nodeParams[selectedNodeId] ?? {}}
            onValueChange={handleParamChange}
            promptSpec={promptSpec}
            blueprint={uiBlueprint}
            ragConnections={ragConnections}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={approvalsOpen} onOpenChange={setApprovalsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approvals inbox</DialogTitle>
            <DialogDescription>
              Human-in-the-loop tasks generated during runs. Approve or reject to keep the flow moving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {approvals.length === 0 ? (
              <p className="text-muted-foreground">No approval tasks yet.</p>
            ) : (
              approvals.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-card/60 p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{task.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Run {task.runId} · Node {task.nodeId}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",
                        task.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : task.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                  {task.assignees.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Assignees: {task.assignees.join(", ")}
                    </p>
                  )}
                  {task.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">Instructions: {task.notes}</p>
                  )}
                  {task.decision && task.status !== "pending" && (
                    <p className="mt-2 text-xs text-muted-foreground">Decision: {task.decision}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      Submitted {new Date(task.submittedAt).toLocaleString()}
                      {typeof task.slaHours === "number" && task.slaHours > 0
                        ? ` · SLA ${task.slaHours}h`
                        : ""}
                    </span>
                    {task.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprovalAction(task, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleApprovalAction(task, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <DragOverlay dropAnimation={null}>
        {dragOverlayBlock ? (
          <div className="w-[260px] opacity-90">
            <CanvasNodeCard
              id="ghost"
              label={dragOverlayBlock.label}
              summary={dragOverlayBlock.summary}
              category={dragOverlayBlock.category}
              ghost
            />
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>
      {toastMsg ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50">
          <div className="pointer-events-auto rounded-md border bg-card px-3 py-2 text-sm shadow">
            {toastMsg}
          </div>
        </div>
      ) : null}
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

function DraggableBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const { listeners, attributes, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-80 scale-[0.98]' : undefined}>
      {children}
    </div>
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
  const [query, setQuery] = useState("");
  const [infoBlock, setInfoBlock] = useState<{ block: (typeof blockCatalog)[number]; metadata?: PromptMetadata } | null>(null);
  const friendly = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      "system-mandate": "Define Mandate",
      "user-task": "Define Task",
      "rag-retriever": "Retrieve Sources (RAG)",
      "exclusion-check": "Check Exclusions",
      "cov": "Verify Facts (CoV)",
      "table-formatter": "Format Output",
      "psa": "Robustness Check",
    };
    return map[id] ?? fallback;
  };
  const groups: Array<{ title: string; match: (cat?: string) => boolean }> = [
    { title: "Mandate & Planning", match: (c) => (c ?? '').toLowerCase() === 'mandate' || (c ?? '').toLowerCase() === 'strategy' },
    { title: "Research Blocks", match: (c) => (c ?? '').toLowerCase() === 'grounding' || (c ?? '').toLowerCase() === 'structure' },
    { title: "Validation Blocks", match: (c) => (c ?? '').toLowerCase() === 'verification' || (c ?? '').toLowerCase() === 'evaluation' },
    { title: "Formatting & Export", match: (c) => (c ?? '').toLowerCase() === 'output' },
  ];
  return (
    <>
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <h2 className="text-lg font-semibold">Block Library</h2>
        <p className="text-sm text-muted-foreground">Drag blocks onto the canvas or inspect existing nodes.</p>
        <div className="mt-2">
          <Input placeholder="Search blocks…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-6 py-3">
          {groups.map((g) => (
            <div key={g.title} className="space-y-2">
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</div>
              {blockCatalog
                .filter((b) => g.match((b.category as string) ?? ''))
                .filter((b) => {
                  const meta = b.metadataId ? metadataMap.get(b.metadataId) : undefined;
                  const hay = `${b.name} ${meta?.when_to_use ?? ''} ${meta?.title ?? ''}`.toLowerCase();
                  return hay.includes(query.toLowerCase());
                })
                .map((block) => {
                  const metadata = block.metadataId ? metadataMap.get(block.metadataId) : undefined;
                  return (
              <div key={block.id} className="relative">
              <DraggableBlock id={block.id}>
              <Card
                data-testid={`block-card-${block.id}`}
                className={`cursor-grab active:cursor-grabbing transition hover:border-primary ${
                  selectedId === block.id ? "border-primary shadow-sm" : ""
                } ${block.status === "planned" ? "opacity-60" : ""}`}
                onClick={() => onSelect(block.id)}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      {friendly(block.id, block.name)}
                      {block.status === "planned" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Planned
                        </span>
                      )}
                    </CardTitle>
                  </div>
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
              </DraggableBlock>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-3 top-3 z-10 h-7 w-7 text-muted-foreground"
                aria-label="View block details"
                onClick={(e) => {
                  e.stopPropagation();
                  setInfoBlock({ block, metadata });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Info className="h-4 w-4" />
              </Button>
              </div>
                  );
                })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
    <Dialog open={Boolean(infoBlock)} onOpenChange={(open) => {
      if (!open) setInfoBlock(null);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{infoBlock?.metadata?.title ?? infoBlock?.block.name}</DialogTitle>
          <DialogDescription>
            {infoBlock?.block.description ?? "Inspect block metadata, inputs, and guardrails."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          {infoBlock?.metadata?.when_to_use && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">When to use</p>
              <p className="mt-1 whitespace-pre-line text-sm">{infoBlock.metadata.when_to_use}</p>
            </div>
          )}
          {infoBlock?.metadata?.failure_modes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Failure modes</p>
              <p className="mt-1 whitespace-pre-line text-sm">{infoBlock.metadata.failure_modes}</p>
            </div>
          )}
          {infoBlock?.metadata?.acceptance_criteria && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Acceptance</p>
              <p className="mt-1 whitespace-pre-line text-sm">{infoBlock.metadata.acceptance_criteria}</p>
            </div>
          )}
          {infoBlock?.metadata?.slots?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Inputs</p>
              <ul className="mt-2 space-y-1 text-sm">
                {infoBlock.metadata.slots.map((slot) => (
                  <li key={slot.name} className="rounded-md border border-border/60 bg-muted/40 px-2 py-1">
                    <span className="font-semibold text-foreground">{slot.name}</span>{" "}
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{slot.type}</span>
                    {slot.help ? (
                      <span className="block text-xs text-muted-foreground">{slot.help}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
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
  onToast,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isDraggingBlock,
  onCreateNode,
  onConnectEdge,
  onMoveNode,
  onResetFlow,
  onDeleteNode,
  onDuplicateNode,
  onRenameNode,
  onDeleteEdge,
  onRenameEdge,
  canEditEdge,
  onCopyId,
  onCopyBaseId,
  onCopyJson,
  onConvertToTemplate,
  onOpenLibrarySheet,
  onOpenInspectorSheet,
  onOpenApprovals,
  onRefreshApprovals,
  pendingApprovalCount,
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
  onToast: (msg: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDraggingBlock: boolean;
  onCreateNode: (baseId: string, position: { x: number; y: number }) => void;
  onConnectEdge: (conn: { source?: string | null; target?: string | null }) => void;
  onMoveNode: (id: string, position: { x: number; y: number }) => void;
  onResetFlow: () => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onRenameNode: (id: string, label: string) => void;
  onDeleteEdge: (id: string) => void;
  onRenameEdge: (id: string, label: string) => void;
  canEditEdge: (id: string) => boolean;
  onCopyId: (id: string) => void;
  onCopyBaseId: (id: string) => void;
  onCopyJson: (id: string) => void;
  onConvertToTemplate: (id: string) => void;
  onOpenLibrarySheet: () => void;
  onOpenInspectorSheet: () => void;
  onOpenApprovals: () => void;
  onRefreshApprovals: () => void;
  pendingApprovalCount: number;
}) {
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [importText, setImportText] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunPreviewResponse | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState<number>(16);
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number; id: string | null }>({ open: false, x: 0, y: 0, id: null });
  const [rename, setRename] = useState<{ open: boolean; x: number; y: number; id: string | null; value: string }>({ open: false, x: 0, y: 0, id: null, value: '' });
  const [selectionCount, setSelectionCount] = useState(0);
  const [edgeMenu, setEdgeMenu] = useState<{ open: boolean; x: number; y: number; id: string | null }>({ open: false, x: 0, y: 0, id: null });
  const [edgeRename, setEdgeRename] = useState<{ open: boolean; x: number; y: number; id: string | null; value: string }>({ open: false, x: 0, y: 0, id: null, value: '' });
  const [edgeQuickAdd, setEdgeQuickAdd] = useState<{ open: boolean; x: number; y: number; id: string | null; source?: string; target?: string }>({ open: false, x: 0, y: 0, id: null });
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [selectedSingleId, setSelectedSingleId] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const renameRef = useRef<HTMLInputElement | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [dragGhost, setDragGhost] = useState<{ id: string; label: string; category?: string; position: { x: number; y: number } } | null>(null);
  const hasExtraNodes = useMemo(() => nodes.some((n) => n.id.includes("#")), [nodes]);
  const quickSteps = useMemo(
    () => [
      {
        title: "Pick a preset",
        body: "Use the Flow picker above to load Deep Research, Data Review, or another template.",
      },
      {
        title: "Drag blocks",
        body: "Grab blocks from the library, hover over the canvas to see their card, then drop to connect.",
      },
      {
        title: "Inspect & run",
        body: "Select a node to fill inputs on the right, then click Run (Preview) for a staged manifest.",
      },
    ],
    [],
  );
  const ghostScreenPosition = useMemo(() => {
    if (!dragGhost || !rf || !flowWrapperRef.current) return null;
    const { x, y, zoom } = rf.getViewport();
    const rect = flowWrapperRef.current.getBoundingClientRect();
    return {
      x: rect.left + dragGhost.position.x * zoom + x,
      y: rect.top + dragGhost.position.y * zoom + y,
    };
  }, [dragGhost, rf]);
  useHotkeys(
    ["meta+k", "ctrl+k"],
    (event) => {
      event?.preventDefault();
      setCommandOpen(true);
    },
    [setCommandOpen],
  );
  useHotkeys('g', () => setSnapEnabled((v) => !v), [setSnapEnabled]);
  useHotkeys('shift+g', () => {
    setGridSize((prev) => {
      const sizes = [8, 16, 24, 32];
      const idx = sizes.indexOf(prev);
      return sizes[(idx + 1) % sizes.length];
    });
  }, [setGridSize]);
  const clampToViewport = useCallback((x: number, y: number, width = 200, height = 240) => {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);

  const recalcRenameAnchor = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const esc = escapeNodeId(id);
    const header = document.querySelector(
      `[data-testid="flow-node-${esc}"] .node-drag-handle`,
    ) as HTMLElement | null;
    if (!header) return;
    const rect = header.getBoundingClientRect();
    setRename((r) => ({ ...r, x: Math.round(rect.left), y: Math.round(rect.bottom + 6) }));
  }, []);

  const openNodeMenu = useCallback((id: string, x: number, y: number) => {
    const pos = clampToViewport(x, y, 208, 260);
    setMenu({ open: true, id, x: pos.x, y: pos.y });
  }, [clampToViewport]);

  const openEdgeMenu = useCallback((id: string, x: number, y: number) => {
    const pos = clampToViewport(x, y, 180, 200);
    setEdgeMenu({ open: true, id, x: pos.x, y: pos.y });
  }, [clampToViewport]);

  // Test helpers
  useEffect(() => {
    const testWindow = getTestWindow();
    if (!testWindow) return;
    testWindow.__testOpenQuickInsert = (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      setEdgeQuickAdd({
        open: true,
        x: 320,
        y: 180,
        id: edge.id,
        source: String(edge.source),
        target: String(edge.target),
      });
    };
    testWindow.__testOpenCommandPalette = () => setCommandOpen(true);
    testWindow.__testOpenNodeMenu = (id: string) => {
      const esc = escapeNodeId(id);
      const header = document.querySelector(
        `[data-testid="flow-node-${esc}"] .node-drag-handle`,
      ) as HTMLElement | null;
      const r = header?.getBoundingClientRect();
      if (!r) return;
      openNodeMenu(id, Math.round(r.left + 8), Math.round(r.bottom + 4));
    };
    testWindow.__testShowToolbarFor = (id: string) => {
      setSelectedSingleId(id);
      setSelectionCount(1);
      const esc = escapeNodeId(id);
      const el = document.querySelector(
        `[data-testid="flow-node-${esc}"] .node-drag-handle`,
      ) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setToolbarPos({ x: Math.round(r.right + 6), y: Math.round(r.top) });
      }
    };
    testWindow.__testGetExtraIds = () => testWindow.__extraNodes ?? [];
    return () => {
      delete testWindow.__testOpenQuickInsert;
      delete testWindow.__testOpenNodeMenu;
      delete testWindow.__testShowToolbarFor;
      delete testWindow.__testGetExtraIds;
      delete testWindow.__testOpenCommandPalette;
    };
  }, [edges, openNodeMenu]);

  

  useEffect(() => {
    const onDocClick = () => setMenu((m) => ({ ...m, open: false }));
    window.addEventListener('click', onDocClick);
    const onResize = () => { if (rename.open && rename.id) recalcRenameAnchor(rename.id); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('click', onDocClick); window.removeEventListener('resize', onResize); };
  }, [rename.open, rename.id, recalcRenameAnchor]);
  useEffect(() => {
    if (rename.open) {
      setTimeout(() => {
        if (rename.id) recalcRenameAnchor(rename.id);
        renameRef.current?.focus();
      }, 0);
    }
  }, [rename.open, rename.id, recalcRenameAnchor]);

  // Load persisted snap settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('prompt-builder-studio:snap');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { enabled?: boolean; size?: number };
      if (typeof parsed.enabled === 'boolean') setSnapEnabled(parsed.enabled);
      if (typeof parsed.size === 'number' && parsed.size > 0) setGridSize(parsed.size);
    } catch {}
  }, []);;

  // Persist snap settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'prompt-builder-studio:snap',
        JSON.stringify({ enabled: snapEnabled, size: gridSize }),
      );
    } catch {}
  }, [snapEnabled, gridSize]);

  // Keyboard shortcuts: Delete to remove selected extra nodes, Ctrl/Cmd+D to duplicate
  useHotkeys('delete, backspace', () => {
    if (!rf) return;
    const selected = rf.getNodes().filter((n) => n.selected && n.id.includes('#'));
    if (!selected.length) return;
    const ids = new Set(selected.map((n) => n.id));
    // Inform parent state for persistence
    ids.forEach((id) => onDeleteNode(id));
    // Update RF instantly for smooth UX
    const remainingEdges = rf.getEdges().filter((e) => !ids.has(e.source) && !ids.has(e.target));
    (rf as ReactFlowInstance).setEdges(remainingEdges);
    (rf as ReactFlowInstance).setNodes(rf.getNodes().filter((n) => !ids.has(n.id)));
  }, [rf, onDeleteNode]);

  useHotkeys(['ctrl+d', 'meta+d'], (event) => {
    event?.preventDefault();
    if (!rf) return;
    const selected = rf.getNodes().find((n) => n.selected && n.id.includes('#'));
    if (!selected) return;
    const baseId = selected.id.split('#')[0];
    const pos = selected.position || { x: 240, y: 160 };
    const dup = { x: pos.x + 40, y: pos.y + 40 };
    getTestWindow()?.__testCreateNode?.(baseId, dup.x, dup.y);
  }, [rf]);

  // Test helper no longer needed here (defined at shell scope)
  useEffect(() => {
    const testWindow = getTestWindow();
    if (!testWindow) return;
    testWindow.__testDeleteFirstExtra = () => {
      if (!rf) return;
      const all = rf.getNodes();
      const extra = all.find((n) => n.id.includes('#'));
      if (!extra) return;
      const remainingEdges = rf.getEdges().filter((edge) => edge.source !== extra.id && edge.target !== extra.id);
      rf.setEdges(remainingEdges);
      rf.setNodes(all.filter((n) => n.id !== extra.id));
    };
    return () => {
      delete testWindow.__testDeleteFirstExtra;
    };
  }, [rf]);

  // Fit view on init and whenever node/edge count changes noticeably
  useEffect(() => {
    if (!rf) return;
    const id = setTimeout(() => {
      try {
        rf.fitView({ padding: 0.12, includeHiddenNodes: true });
      } catch {}
    }, 100);
    return () => clearTimeout(id);
  }, [rf, nodes.length, edges.length]);

  useEffect(() => {
    if (!dialogOpen) return;
    fetch("/api/runs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.runs)) {
          setRunHistory(data.runs.slice(0, 10));
        }
      })
      .catch(() => {});
  }, [dialogOpen]);
  const triggerRunPreview = useCallback(async () => {
    setDialogOpen(true);
    setIsRunning(true);
    setRunError(null);
    setRunResult(null);
    setLiveLogs([]);
    try {
      if (!streaming) {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptSpec }),
        });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error ?? `Run preview failed (${response.status}).`);
        }
        const data = (await response.json()) as RunPreviewResponse;
        setRunResult(data);
        setRunHistory((prev) => [data, ...prev.filter((entry) => entry.runId !== data.runId)].slice(0, 5));
        onRefreshApprovals();
      } else {
        const response = await fetch("/api/run/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptSpec }),
        });
        if (!response.ok || !response.body) throw new Error(`Run stream failed (${response.status}).`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n")) >= 0) {
              const rawLine = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
            if (!rawLine) continue;
            const line = rawLine.startsWith("data:") ? rawLine.slice(5).trim() : rawLine;
            if (!line) continue;
            setLiveLogs((prev) => [...prev, line]);
            try {
              const evt = JSON.parse(line);
              if (evt.type === "run_completed") {
                const payload = evt.data as RunPreviewResponse;
                setRunResult(payload);
                setRunHistory((prev) => [payload, ...prev.filter((entry) => entry.runId !== payload.runId)].slice(0, 5));
                onRefreshApprovals();
              } else if (evt.type === "error") {
                setRunError(evt.error ?? "Stream error");
              }
            } catch {
              // ignore malformed line
            }
          }
        }
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unknown error during run preview.");
    } finally {
      setIsRunning(false);
    }
  }, [promptSpec, streaming, onRefreshApprovals]);

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
            {selectionCount > 0 ? ` · Selected ${selectionCount}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>Undo</Button>
              </TooltipTrigger>
              <TooltipContent>Undo last change (Ctrl/Cmd+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onRedo} disabled={!canRedo}>Redo</Button>
              </TooltipTrigger>
              <TooltipContent>Redo last change (Ctrl/Cmd+Shift+Z)</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border px-2 py-1">
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Snap</span>
              <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
            </label>
            <Select value={String(gridSize)} onValueChange={(v) => setGridSize(Number(v))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue placeholder="Grid" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">Grid 8</SelectItem>
                <SelectItem value="16">Grid 16</SelectItem>
                <SelectItem value="24">Grid 24</SelectItem>
                <SelectItem value="32">Grid 32</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onResetFlow}>Reset</Button>
              </TooltipTrigger>
              <TooltipContent>Quick keys: G toggle snap · Shift+G cycle grid</TooltipContent>
            </Tooltip>
            <div className="ml-2 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" onClick={() => rf?.zoomOut?.()} aria-label="Zoom out">−</Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" onClick={() => rf?.zoomIn?.()} aria-label="Zoom in">+</Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => rf?.fitView?.({ padding: 0.12, includeHiddenNodes: true })}>Fit</Button>
                </TooltipTrigger>
                <TooltipContent>Zoom to fit</TooltipContent>
              </Tooltip>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)}>Command (Ctrl/Cmd+K)</Button>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenLibrarySheet}>Library</Button>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenInspectorSheet}>Inspector</Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="approvals-button"
            onClick={onOpenApprovals}
          >
            Approvals{pendingApprovalCount ? ` (${pendingApprovalCount})` : ""}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>Help</Button>
          <Button variant="outline" size="sm" onClick={() => {
            // Simple auto-layout on the canvas without mutating parent layout state
            const spacingX = 260;
            const spacingY = 160;
            const updatedPositions: Record<string, { x: number; y: number }> = {};
            let i = 0;
            for (const id of flow.nodeIds) {
              updatedPositions[id] = { x: i * spacingX, y: 0 };
              i += 1;
            }
            if (rf) {
              const all = rf.getNodes();
              let extraIdx = 0;
              const next = all.map((n) => {
                if (!n.id.includes('#')) {
                  // baseline node
                  const pos = updatedPositions[n.id] ?? n.position;
                  return { ...n, position: pos };
                }
                // extra node: place in grid rows beneath
                const pos = { x: (extraIdx % 4) * spacingX, y: spacingY + Math.floor(extraIdx / 4) * spacingY };
                extraIdx += 1;
                return { ...n, position: pos };
              });
              rf.setNodes(next);
              setTimeout(() => rf.fitView({ padding: 0.1, includeHiddenNodes: true }), 50);
            }
          }}>Layout</Button>
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
                  <div className="mt-2 flex gap-2 flex-wrap">
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
                        const testWindow = getTestWindow();
                        if (testWindow) {
                          for (const ex of extras) {
                            testWindow.__testCreateNode?.(ex.baseId, ex.pos.x, ex.pos.y);
                          }
                        }
                        // Edges cannot be replayed safely here; user can rewire visually after load.
                        setFlowDialogOpen(false);
                      } catch {
                        alert('Invalid JSON');
                      }
                    }}>Load (Append)</Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      try {
                        const snap = JSON.parse(importText) as TestFlowImport;
                        getTestWindow()?.__testReplaceFlow?.(snap);
                        setFlowDialogOpen(false);
                      } catch {
                        alert('Invalid JSON');
                      }
                    }}>Load (Replace)</Button>
                    <Button variant="destructive" size="sm" onClick={() => { onResetFlow(); setFlowDialogOpen(false); }}>Reset Flow</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onExport}>
                Export PromptSpec
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download the compiled flow specification as JSON.</TooltipContent>
          </Tooltip>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={triggerRunPreview} disabled={isRunning}>
                  {isRunning ? "Running…" : "Run (Preview)"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Execute all connected nodes and view a preview manifest.</TooltipContent>
              </Tooltip>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Run Preview</DialogTitle>
                <DialogDescription>
                  Model execution wiring is coming next. This dry-run calls the local preview
                  endpoint using the compiled PromptSpec payload.
                </DialogDescription>
              </DialogHeader>
              <div className="mb-2 flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex items-center gap-2">
                  <input type="checkbox" checked={streaming} onChange={(e) => setStreaming(e.currentTarget.checked)} />
                  Stream logs
                </label>
              </div>
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
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-sm">
                    <div>
                      <p className="font-medium">Run ID</p>
                      <p className="text-muted-foreground break-all">{runResult.runId}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="font-medium">Summary</p>
                        <p className="text-muted-foreground">
                          Blocks {runResult.manifest.blocks.length} · Nodes {runResult.manifest.nodeCount} · Edges {runResult.manifest.edgeCount}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Usage</p>
                        <p className="text-muted-foreground">
                          {runResult.usage.promptTokens} prompt · {runResult.usage.completionTokens} completion · total {runResult.usage.totalTokens} tokens
                        </p>
                        <p className="text-muted-foreground">${runResult.costUsd.toFixed(4)} · {runResult.latencyMs} ms</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{runResult.message}</p>
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
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono" data-testid="prompt-preview">
                    {JSON.stringify(runResult, null, 2)}
                  </pre>
                  {runHistory.length > 0 && (
                    <div className="rounded border border-border/70 bg-muted/20">
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent runs
                      </div>
                      <div className="max-h-40 divide-y divide-border/60 overflow-auto text-xs">
                        {runHistory.map((entry) => (
                          <button
                            key={entry.runId}
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                            onClick={() => setRunResult(entry)}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{entry.runId}</p>
                              <p className="text-muted-foreground">
                                {new Date(entry.startedAt).toLocaleTimeString()} · {entry.usage.totalTokens} tokens
                              </p>
                            </div>
                            <div className="text-muted-foreground">${entry.costUsd.toFixed(4)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {streaming && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live logs</p>
                      <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono">
                        {liveLogs.join("\n")}
                      </pre>
                    </div>
                  )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <OnboardingDialog openFromHelp={helpOpen} onClose={() => setHelpOpen(false)} />
        </div>
      </header>
      <Separator />
      <div className="border-b border-border/70 bg-background/80 px-4 py-3">
        <div className="flex flex-wrap gap-3">
          {quickSteps.map((step, index) => (
            <div
              key={step.title}
              className="flex min-w-[220px] flex-1 items-start gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-muted-foreground"
            >
              <Badge variant="secondary">{`0${index + 1}`}</Badge>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className={cn("relative flex-1", isDraggingBlock && "canvas-drop-active")}
        data-canvas-dropping={isDraggingBlock}
        ref={flowWrapperRef}
      >
          {isDraggingBlock ? (
            <div className="pointer-events-none absolute inset-3 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5" aria-hidden="true" />
          ) : null}
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={useMemo(() => edges.map((e) => ({
              ...e,
              label: e.label ?? inferEdgeLabel(String(e.source)),
              type: 'smart',
              data: {
                editable: canEditEdge(e.id),
                onChangeLabel: (id: string, label: string) => onRenameEdge(id, label),
                onDelete: (id: string) => onDeleteEdge(id),
                onQuickInsert: (id: string) => {
                  const edge = edges.find((x) => x.id === id);
                  if (!edge || !canEditEdge(edge.id)) return;
                  const lastMouse = getTestWindow()?.__lastMousePos;
                  const x = lastMouse?.x ?? 320;
                  const y = lastMouse?.y ?? 180;
                  setEdgeQuickAdd({ open: true, x, y, id: edge.id, source: edge.source as string, target: edge.target as string });
                },
              },
            })), [edges, canEditEdge, onRenameEdge, onDeleteEdge])}
            onNodeClick={(_, node) => {
              if (connectFromId && node.id !== connectFromId) {
                onConnectEdge({ source: connectFromId, target: node.id });
                setConnectFromId(null);
                onToast('Connected nodes');
              }
              onSelectNode(node.id)
              // Reflect selection for toolbar
              setSelectionCount(1);
              setSelectedSingleId(node.id);
              const el = document.querySelector(`[data-testid=\\"flow-node-${node.id}\\"] .node-drag-handle`) as HTMLElement | null;
              if (el) {
                const r = el.getBoundingClientRect();
                setToolbarPos({ x: Math.round(r.right + 6), y: Math.round(r.top) });
              }
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              openNodeMenu(node.id, e.clientX, e.clientY);
            }}
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              openEdgeMenu(edge.id, e.clientX, e.clientY);
            }}
            onEdgeClick={(e, edge) => {
              if (e.altKey || e.shiftKey) {
                setEdgeQuickAdd({ open: true, x: e.clientX, y: e.clientY, id: edge.id, source: edge.source as string, target: edge.target as string });
                return;
              }
              if (!canEditEdge(edge.id)) return;
              setEdgeRename({ open: true, x: e.clientX, y: e.clientY, id: edge.id, value: String(edge.label ?? '') });
            }}
            onEdgeDoubleClick={(e, edge) => {
              e.preventDefault();
              if (!canEditEdge(edge.id)) return;
              setEdgeRename({ open: true, x: e.clientX, y: e.clientY, id: edge.id, value: String(edge.label ?? '') });
            }}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1.2 }}
            className="bg-muted/30"
            nodeTypes={useMemo(() => makeNodeTypes({
              onDuplicateNode,
              onDeleteNode,
              onOpenRename: (id: string) => {
                const node = nodes.find((n) => n.id === id);
                const curr = node?.data?.label ?? id;
                setRename({ open: true, x: 0, y: 0, id, value: String(curr) });
                setTimeout(() => { recalcRenameAnchor(id); }, 0);
              },
              onCopyId,
              onCopyBaseId,
              onCopyJson,
              onConvertToTemplate,
            }), [nodes, onDuplicateNode, onDeleteNode, recalcRenameAnchor, onCopyId, onCopyBaseId, onCopyJson, onConvertToTemplate])}
            nodesDraggable
            nodesConnectable
            nodesFocusable={false}
            snapToGrid={snapEnabled}
            snapGrid={[gridSize, gridSize]}
            selectionOnDrag
            onSelectionChange={({ nodes: sel }) => {
              setSelectionCount(sel.length);
              const one = sel.length === 1 ? sel[0] : undefined;
              setSelectedSingleId(one?.id ?? null);
              if (one?.id) {
                const el = document.querySelector(`[data-testid=\\"flow-node-${one.id}\\"] .node-drag-handle`) as HTMLElement | null;
                if (el) {
                  const r = el.getBoundingClientRect();
                  setToolbarPos({ x: Math.round(r.right + 6), y: Math.round(r.top) });
                } else {
                  setToolbarPos(null);
                }
              } else {
                setToolbarPos(null);
              }
            }}
            onInit={(inst) => { setRf(inst); }}
            edgeTypes={useMemo(() => ({ smart: SmartEdge }), [])}
            onConnect={(conn) => onConnectEdge(conn)}
            onMove={() => { if (rename.open && rename.id) recalcRenameAnchor(rename.id); }}
            onNodeDragStart={(_, node) => {
              setDragGhost({
                id: node.id,
                label: (node.data as FlowNodeData | undefined)?.label ?? node.id,
                category: (node.data as FlowNodeData | undefined)?.category,
                position: node.position ?? { x: 0, y: 0 },
              });
            }}
            onNodeDrag={(_, node) => {
              setDragGhost((prev) =>
                prev && prev.id === node.id
                  ? { ...prev, position: node.position ?? prev.position }
                  : prev,
              );
            }}
            onNodeDragStop={(_, node) => {
              setDragGhost(null);
              const pos = node.position ?? { x: 0, y: 0 };
              onMoveNode(node.id, pos);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const testWindow = getTestWindow();
              if (testWindow) {
                testWindow.__lastMousePos = { x: e.clientX, y: e.clientY };
              }
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
              setTimeout(() => rf?.fitView({ padding: 0.15 }), 80);
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={0.6}
              color="rgba(148,163,184,0.35)"
            />
            <div aria-hidden="true">
              <MiniMap className="!bg-transparent" zoomable pannable />
            </div>
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
        {!hasExtraNodes && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-2xl border border-dashed border-muted-foreground/50 bg-background/85 p-6 text-center shadow-lg">
              <p className="text-base font-semibold text-foreground">Welcome to the builder</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag a block from the library, connect it to the baseline nodes, then configure it in the inspector.
              </p>
              <div className="mt-4 grid gap-3 text-left text-sm text-muted-foreground sm:grid-cols-3">
                <div>
                  <p className="font-semibold text-foreground">Drag</p>
                  <p>Grab a block from the left and hover over the canvas to preview where it will land.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Wire</p>
                  <p>Connect handles to pass structured outputs between nodes.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Preview</p>
                  <p>Fill inputs on the right and hit Run (Preview) to inspect the manifest and approvals.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        {menu.open && menu.id ? (
          <div
            className="fixed z-50 w-48 rounded-md border bg-card px-2 py-2 text-sm shadow"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              data-testid="node-menu-duplicate"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateNode(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Duplicate
            </button>
            <button
              data-testid="node-menu-rename"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                const node = nodes.find((n) => n.id === menu.id);
                const curr = node?.data?.label ?? menu.id!;
                setRename({ open: true, x: menu.x + 4, y: menu.y + 4, id: menu.id!, value: String(curr) });
                setTimeout(() => { if (menu.id) recalcRenameAnchor(menu.id); }, 0);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Rename…
            </button>
            <div className="my-1 border-t border-border/60" />
            <button
              data-testid="node-menu-copy-id"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onCopyId(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Copy node ID
            </button>
            <button
              data-testid="node-menu-copy-base"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onCopyBaseId(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Copy base ID
            </button>
            <button
              data-testid="node-menu-copy-json"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onCopyJson(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Copy node JSON
            </button>
            <button
              data-testid="node-menu-convert-template"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onConvertToTemplate(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Convert to template
            </button>
            <div className="my-1 border-t border-border/60" />
            <button
              data-testid="node-menu-delete"
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
              disabled={!menu.id.includes('#')}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(menu.id!);
                setMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
        {edgeMenu.open && edgeMenu.id ? (
          <div
            className="fixed z-50 rounded-md border bg-card px-2 py-2 text-sm shadow"
            style={{ left: edgeMenu.x, top: edgeMenu.y }}
          >
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                const edge = edges.find((e) => e.id === edgeMenu.id);
                if (edge) setEdgeQuickAdd({ open: true, x: edgeMenu.x + 4, y: edgeMenu.y + 4, id: edge.id, source: String(edge.source), target: String(edge.target) });
                setEdgeMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Insert…
            </button>
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
              disabled={!canEditEdge(edgeMenu.id!)}
              onClick={(e) => {
                e.stopPropagation();
                setEdgeRename({ open: true, x: edgeMenu.x + 4, y: edgeMenu.y + 4, id: edgeMenu.id!, value: String(edges.find(e => e.id === edgeMenu.id)?.label ?? '') });
                setEdgeMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Rename…
            </button>
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
              disabled={!canEditEdge(edgeMenu.id!)}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEdge(edgeMenu.id!);
                setEdgeMenu({ open: false, x: 0, y: 0, id: null });
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      {selectionCount > 0 ? (
        <div className="pointer-events-auto absolute left-1/2 top-2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm shadow">
            <span className="text-xs text-muted-foreground">Selected {selectionCount}</span>
            <Button size="sm" variant="outline" onClick={() => {
              if (!rf) return;
              const selected = rf.getNodes().filter((n) => n.selected);
              // Duplicate each selected node with slight offsets
              let i = 0;
              const testWindow = getTestWindow();
              if (testWindow) {
                for (const n of selected) {
                  const baseId = n.id.includes('#') ? n.id.split('#')[0] : n.id;
                  const pos = n.position || { x: 240, y: 160 };
                  const off = { x: pos.x + 24 + (i * 8), y: pos.y + 24 + (i * 8) };
                  testWindow.__testCreateNode?.(baseId, off.x, off.y);
                  i += 1;
                }
              }
            }}>Duplicate</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (!rf) return;
              const selected = rf.getNodes().filter((n) => n.selected && n.id.includes('#'));
              if (!selected.length) return;
              const ids = new Set(selected.map((n) => n.id));
              ids.forEach((id) => onDeleteNode(id));
              const remainingEdges = rf.getEdges().filter((e) => !ids.has(e.source) && !ids.has(e.target));
              (rf as ReactFlowInstance).setEdges(remainingEdges);
              (rf as ReactFlowInstance).setNodes(rf.getNodes().filter((n) => !ids.has(n.id)));
            }}>Delete</Button>
          </div>
        </div>
      ) : null}

      {selectedSingleId && toolbarPos ? (
        <div className="pointer-events-auto fixed z-40" style={{ left: toolbarPos.x, top: toolbarPos.y }}>
          <div data-testid="mini-toolbar" className="flex items-center gap-1 rounded-md border bg-card px-1 py-1 text-sm shadow">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="btn-duplicate-node" size="icon-sm" variant="outline" onClick={() => onDuplicateNode(selectedSingleId)} aria-label="Duplicate node">⎘</Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button data-testid="btn-delete-node" size="icon-sm" variant="outline" disabled={!selectedSingleId.includes('#')} onClick={() => onDeleteNode(selectedSingleId)} aria-label="Delete node">×</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{selectedSingleId.includes('#') ? 'Delete' : 'Only extra nodes can be deleted'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setConnectFromId(selectedSingleId)} aria-label="Connect from">Connect</Button>
              </TooltipTrigger>
              <TooltipContent>Start connection</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : null}

      {connectFromId ? (
        <div className="pointer-events-none fixed right-4 top-20 z-40">
          <div className="rounded-md border bg-card px-2 py-1 text-xs shadow">Connecting… click a target node</div>
        </div>
      ) : null}
      {dragGhost && ghostScreenPosition && (
        <div
          className="pointer-events-none fixed z-40"
          style={{ left: ghostScreenPosition.x, top: ghostScreenPosition.y }}
        >
          <div className="w-[240px] opacity-80">
            <CanvasNodeCard
              id={dragGhost.id}
              label={dragGhost.label}
              category={dragGhost.category}
              ghost
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Release to place</p>
        </div>
      )}
      {rename.open && rename.id ? (
          <Popover open={rename.open} onOpenChange={(open) => {
            if (!open) setRename({ open: false, x: 0, y: 0, id: null, value: '' });
          }}>
          <PopoverTrigger asChild>
            <span
              aria-hidden
              style={{ position: 'fixed', left: 0, top: 0, transform: `translate(${rename.x}px, ${rename.y}px)` }}
            />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Input
                ref={renameRef}
                value={rename.value}
                onChange={(e) => setRename((r) => ({ ...r, value: e.currentTarget.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = rename.value.trim();
                    if (v) {
                      onRenameNode(rename.id!, v);
                    }
                    setRename({ open: false, x: 0, y: 0, id: null, value: '' });
                  }
                  if (e.key === 'Escape') {
                    setRename({ open: false, x: 0, y: 0, id: null, value: '' });
                  }
                }}
              />
              <Button size="sm" onClick={() => { const v = rename.value.trim(); if (v) { onRenameNode(rename.id!, v); } setRename({ open: false, x: 0, y: 0, id: null, value: '' }); }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setRename({ open: false, x: 0, y: 0, id: null, value: '' })}>Cancel</Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {edgeRename.open && edgeRename.id ? (
        <Popover open={edgeRename.open} onOpenChange={(open) => {
          if (!open) setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' });
        }}>
          <PopoverTrigger asChild>
            <span
              aria-hidden
              style={{ position: 'fixed', left: 0, top: 0, transform: `translate(${edgeRename.x}px, ${edgeRename.y}px)` }}
            />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Input
                value={edgeRename.value}
                onChange={(e) => setEdgeRename((r) => ({ ...r, value: e.currentTarget.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = edgeRename.value.trim();
                    if (v) onRenameEdge(edgeRename.id!, v);
                    setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' });
                  }
                  if (e.key === 'Escape') setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' });
                }}
                onBlur={() => {
                  const v = edgeRename.value.trim();
                  if (v && edgeRename.id) onRenameEdge(edgeRename.id, v);
                  setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' });
                }}
              />
              <Button size="sm" onClick={() => { const v = edgeRename.value.trim(); if (v) onRenameEdge(edgeRename.id!, v); setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' }); }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEdgeRename({ open: false, x: 0, y: 0, id: null, value: '' })}>Cancel</Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-lg p-0" data-testid="command-palette-dialog">
          <Command>
            <CommandInput data-testid="command-palette-input" placeholder="Type a command or search blocks…" />
            <CommandList>
              <CommandEmpty>No results</CommandEmpty>
              <CommandGroup heading="Blocks">
                {blockCatalog.map((b) => (
                  <CommandItem key={b.id} value={`${b.id} ${b.name}`} onSelect={() => {
                    const pos = { x: 240, y: 160 };
                    onCreateNode(b.id, pos);
                    setCommandOpen(false);
                  }}>{`Add: ${b.name}`}</CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Flows">
                {presets.map((p) => (
                  <CommandItem key={p.id} value={`flow ${p.id} ${p.name}`} onSelect={() => { onPresetChange(p.id); setCommandOpen(false); }}>{`Switch: ${p.name}`}</CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="px-3 py-2 text-[11px] text-muted-foreground/80">
              Tip: press <span className="font-mono">Enter</span> to run the highlighted action. Use `/` to filter categories.
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {edgeQuickAdd.open && edgeQuickAdd.id && edgeQuickAdd.source && edgeQuickAdd.target ? (
        <Dialog open={edgeQuickAdd.open} onOpenChange={(open) => { if (!open) setEdgeQuickAdd({ open: false, x: 0, y: 0, id: null }); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Insert Block</DialogTitle>
              <DialogDescription>Search and insert a block between nodes.</DialogDescription>
            </DialogHeader>
            <Command>
              <CommandInput placeholder="Search blocks…" />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Blocks">
                  {blockCatalog.map((block) => (
                    <CommandItem key={block.id} value={`${block.id} ${block.name}`} onSelect={() => {
                      if (!rf) return;
                      const all = rf.getNodes();
                      const s = all.find((n) => n.id === edgeQuickAdd.source);
                      const t = all.find((n) => n.id === edgeQuickAdd.target);
                      const mid = s && t ? { x: (s.position.x + t.position.x) / 2, y: (s.position.y + t.position.y) / 2 } : { x: 240, y: 160 };
                      onCreateNode(block.id, mid);
                      setTimeout(() => {
                        const newly = (document.querySelector('[data-node-instance="extra"]')?.getAttribute('data-testid') ?? '').replace('flow-node-','');
                        if (newly) {
                          onDeleteEdge(edgeQuickAdd.id!);
                          onConnectEdge({ source: edgeQuickAdd.source!, target: newly });
                          onConnectEdge({ source: newly, target: edgeQuickAdd.target! });
                          onToast('Inserted block');
                        }
                        setEdgeQuickAdd({ open: false, x: 0, y: 0, id: null });
                      }, 0);
                    }}>
                      {block.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      ) : null}

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
  ragConnections,
}: {
  selectedBlockId: string;
  metadataMap: Map<string, PromptMetadata>;
  values: Record<string, unknown>;
  onValueChange: (blockId: string, key: string, value: unknown) => void;
  promptSpec: PromptSpec;
  blueprint: UIBlueprint;
  ragConnections: Set<string>;
}) {
  const baseId = selectedBlockId.split("#")[0];
  const descriptor = resolveBlockDescriptor(baseId, metadataMap);
  const metadata =
    (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
    metadataMap.get(baseId);
  const ragConnected = ragConnections.has(selectedBlockId) || ragConnections.has(baseId);

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
      modalities: metadata?.modalities,
    } as const);

  const modalityRequirements = metadata?.modalities ?? effectiveDescriptor.modalities ?? [];

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
            ragConnected={ragConnected}
            modalities={modalityRequirements}
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
  ragConnected,
  modalities,
}: {
  blockId: string;
  metadata?: PromptMetadata;
  values: Record<string, unknown>;
  onValueChange: (blockId: string, key: string, value: unknown) => void;
  blueprint: UIBlueprint;
  ragConnected: boolean;
  modalities?: ModalityRequirement[];
}) {
  const baseId = blockId.split("#")[0];
  const isRagNode = isRagBlock(baseId);
  const isApprovalNode = isApprovalBlock(baseId);
  const guardEligible =
    !!metadata &&
    (metadata.tags?.includes("citations") ||
      metadata.tags?.includes("RAG") ||
      metadata.category === "playbook");

  useEffect(() => {
    if (guardEligible && ragConnected && values?.guard_requireCitations !== true) {
      onValueChange(blockId, "guard_requireCitations", true);
    }
  }, [guardEligible, ragConnected, blockId, onValueChange, values?.guard_requireCitations]);
  const ragSources: RagSource[] = Array.isArray(values?.rag_sources)
    ? (values.rag_sources as RagSource[])
    : [...RAG_DEFAULT_PARAMS.rag_sources];
  const ragTopK =
    typeof values?.rag_topK === "number" ? (values.rag_topK as number) : RAG_DEFAULT_PARAMS.rag_topK;
  const ragChunkSize =
    typeof values?.rag_chunkSize === "number"
      ? (values.rag_chunkSize as number)
      : RAG_DEFAULT_PARAMS.rag_chunkSize;
  const ragChunkOverlap =
    typeof values?.rag_chunkOverlap === "number"
      ? (values.rag_chunkOverlap as number)
      : RAG_DEFAULT_PARAMS.rag_chunkOverlap;
  const ragCitationStyle =
    typeof values?.rag_citationStyle === "string"
      ? (values.rag_citationStyle as string)
      : RAG_DEFAULT_PARAMS.rag_citationStyle;
  const ragSampleQuery =
    typeof values?.rag_sampleQuery === "string"
      ? (values.rag_sampleQuery as string)
      : RAG_DEFAULT_PARAMS.rag_sampleQuery;
  const ragSampleContext =
    typeof values?.rag_sampleContext === "string"
      ? (values.rag_sampleContext as string)
      : RAG_DEFAULT_PARAMS.rag_sampleContext;
  const approvalAssignees = Array.isArray(values?.approval_assignees)
    ? (values.approval_assignees as string[])
    : [...APPROVAL_DEFAULT_PARAMS.approval_assignees];
  const approvalSlaHours =
    typeof values?.approval_slaHours === "number"
      ? (values.approval_slaHours as number)
      : APPROVAL_DEFAULT_PARAMS.approval_slaHours;
  const approvalAutoApprove =
    typeof values?.approval_autoApprove === "boolean"
      ? (values.approval_autoApprove as boolean)
      : APPROVAL_DEFAULT_PARAMS.approval_autoApprove;
  const approvalNotes =
    typeof values?.approval_notes === "string"
      ? (values.approval_notes as string)
      : APPROVAL_DEFAULT_PARAMS.approval_notes;

  const hasSlots = Boolean(metadata?.slots && metadata.slots.length > 0);
  const renderingHints = metadata ? deriveRenderingHints(metadata, blueprint) : [];
  const modalityRequirements = modalities ?? [];
  const modalityState: ModalityState =
    (values?.modalities as ModalityState | undefined) ?? {};

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parameters
        </p>
      </div>
      {guardEligible && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Guardrails</p>
            {ragConnected && (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                RAG linked
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-foreground">Require citations</p>
              <p>Enforce citations whenever this block runs.</p>
            </div>
            <Switch
              checked={ragConnected ? true : Boolean(values?.guard_requireCitations)}
              onCheckedChange={(checked) => onValueChange(blockId, "guard_requireCitations", checked)}
              disabled={ragConnected}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Refusal policy</Label>
            <Select
              value={
                typeof values?.guard_refusalPolicy === "string"
                  ? (values.guard_refusalPolicy as string)
                  : "regulated-only"
              }
              onValueChange={(next) => onValueChange(blockId, "guard_refusalPolicy", next)}
            >
              <SelectTrigger className="h-8 text-foreground">
                <SelectValue placeholder="Refusal policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off (allow freestyle)</SelectItem>
                <SelectItem value="regulated-only">Regulated only</SelectItem>
                <SelectItem value="always">Always refuse when ungrounded</SelectItem>
              </SelectContent>
            </Select>
            <p>
              Controls whether the model can decline when prompts step outside grounded context or policy.
            </p>
          </div>
        </div>
      )}
      {isRagNode && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Grounding sources</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onValueChange(blockId, "rag_sources", [
                  ...ragSources,
                  { kind: "file", ref: "" },
                ])
              }
            >
              Add source
            </Button>
          </div>
          {ragSources.length === 0 ? (
            <p>No sources yet. Add files, web collections, or managed corpora.</p>
          ) : (
            <div className="space-y-2">
              {ragSources.map((source, index) => (
                <div key={`${source.kind}-${index}`} className="flex flex-wrap gap-2">
                  <Select
                    value={source.kind}
                    onValueChange={(next) => {
                      const nextSources = [...ragSources];
                      nextSources[index] = { ...nextSources[index], kind: next as RagSource["kind"] };
                      onValueChange(blockId, "rag_sources", nextSources);
                    }}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Kind" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="file">File</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                      <SelectItem value="collection">Collection</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    placeholder="Reference or handle"
                    value={source.ref}
                    onChange={(event) => {
                      const nextSources = [...ragSources];
                      nextSources[index] = { ...nextSources[index], ref: event.currentTarget.value };
                      onValueChange(blockId, "rag_sources", nextSources);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextSources = ragSources.filter((_, i) => i !== index);
                      onValueChange(blockId, "rag_sources", nextSources);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-foreground">Top K</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={ragTopK}
                onChange={(e) => onValueChange(blockId, "rag_topK", Number(e.currentTarget.value))}
              />
            </div>
            <div>
              <Label className="text-xs text-foreground">Chunk size</Label>
              <Input
                type="number"
                min={200}
                max={4000}
                value={ragChunkSize}
                onChange={(e) =>
                  onValueChange(blockId, "rag_chunkSize", Number(e.currentTarget.value))
                }
              />
            </div>
            <div>
              <Label className="text-xs text-foreground">Chunk overlap</Label>
              <Input
                type="number"
                min={0}
                max={400}
                value={ragChunkOverlap}
                onChange={(e) =>
                  onValueChange(blockId, "rag_chunkOverlap", Number(e.currentTarget.value))
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Citation style</Label>
            <Select
              value={ragCitationStyle}
              onValueChange={(next) => onValueChange(blockId, "rag_citationStyle", next)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">Inline [n]</SelectItem>
                <SelectItem value="footnote">Footnote</SelectItem>
                <SelectItem value="json">JSON block</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Sample query</Label>
            <Input
              value={ragSampleQuery}
              onChange={(e) => onValueChange(blockId, "rag_sampleQuery", e.currentTarget.value)}
              placeholder="e.g., Federal EV incentives timeline"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Sample context (first passage)</Label>
            <Textarea
              rows={3}
              value={ragSampleContext}
              onChange={(e) => onValueChange(blockId, "rag_sampleContext", e.currentTarget.value)}
              placeholder="Paste a retrieved passage to preview downstream prompts."
            />
          </div>
        </div>
      )}
      {isApprovalNode && (
        <div className="space-y-3 rounded-lg border border-border bg-amber-50 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Approval settings</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onValueChange(blockId, "approval_assignees", [...approvalAssignees, ""])
              }
            >
              Add reviewer
            </Button>
          </div>
          <div className="space-y-2">
            {approvalAssignees.length === 0 && <p>No reviewers yet. Add at least one assignee.</p>}
            {approvalAssignees.map((assignee, index) => (
              <div key={`assignee-${index}`} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="name@org.com"
                  value={assignee}
                  onChange={(e) => {
                    const next = [...approvalAssignees];
                    next[index] = e.currentTarget.value;
                    onValueChange(blockId, "approval_assignees", next);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const next = approvalAssignees.filter((_, i) => i !== index);
                    onValueChange(blockId, "approval_assignees", next);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[120px]">
              <Label className="text-xs text-foreground">SLA (hours)</Label>
              <Input
                type="number"
                min={0}
                value={approvalSlaHours}
                onChange={(e) =>
                  onValueChange(blockId, "approval_slaHours", Number(e.currentTarget.value))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-foreground">Auto-approve if idle</Label>
              <Switch
                checked={approvalAutoApprove}
                onCheckedChange={(checked) => onValueChange(blockId, "approval_autoApprove", checked)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Instructions for reviewers</Label>
            <Textarea
              rows={3}
              value={approvalNotes}
              onChange={(e) => onValueChange(blockId, "approval_notes", e.currentTarget.value)}
              placeholder="Highlight what approvers should check before allowing the flow to continue."
            />
          </div>
        </div>
      )}
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
      {modalityRequirements.length > 0 && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Multimodal payloads</p>
            <p className="text-xs text-muted-foreground">
              Upload, annotate, and structure the required audio, video, or scene data before this
              block executes.
            </p>
          </div>
          <ModalityRequirementSection
            requirements={modalityRequirements}
            state={modalityState}
            onStateChange={(next) => onValueChange(blockId, "modalities", next)}
          />
        </div>
      )}
      {hasSlots ? (
        <div className="space-y-4">
          {metadata?.slots?.map((slot) => (
            <SlotField
              key={slot.name}
              slot={slot}
              value={values?.[slot.name]}
              onChange={(value) => onValueChange(blockId, slot.name, value)}
              blueprint={blueprint}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          This block does not expose slot parameters yet. Additional configuration will appear here as
          schemas are added.
        </div>
      )}
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
  const needsValue = /topic|question|sources/i.test(slot.name ?? "");
  const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  const isEmpty = needsValue && (empty(value) && empty(slot.default));

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
          onChange={(event) => {
            const ta = event.currentTarget;
            // autosize
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 480) + 'px';
            onChange(event.target.value);
          }}
          placeholder={slot.help}
          className={cn("min-h-28 resize-y", isEmpty ? "border-destructive/40" : "")}
          rows={typeof controlProps.rows === "number" ? controlProps.rows : 8}
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
          className="min-h-24 resize-y"
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
      ) : component === "AudioTimelineEditor" ? (
        <WaveformEditor
          value={value as AudioTimelinePayload | undefined}
          onChange={(next) => onChange(next)}
        />
      ) : component === "VideoEventGraphBuilder" ? (
        <VideoEventGraphBuilder
          value={value as VideoEventGraphPayload | undefined}
          onChange={(next) => onChange(next)}
        />
      ) : component === "SceneGraphBuilder" ? (
        <SceneGraphBuilder
          value={value as SceneGraphPayload | undefined}
          onChange={(next) => onChange(next)}
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
          className={cn(isEmpty ? "border-destructive/40" : "")}
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

function summarizeModalityRequirements(
  requirements?: ModalityRequirement[],
): string | undefined {
  if (!requirements || requirements.length === 0) {
    return undefined;
  }
  return requirements
    .map((requirement) => {
      const payloads = requirement.payloads.map((payload) => payload.label).join(", ");
      return `${requirement.label ?? requirement.modality}: ${payloads}`;
    })
    .join(" | ");
}

function createDefaultModalityState(
  requirements?: ModalityRequirement[],
): ModalityState | undefined {
  if (!requirements || requirements.length === 0) {
    return undefined;
  }

  const state: ModalityState = {};
  const typedState = state as Record<string, Record<string, unknown>>;

  for (const requirement of requirements) {
    if (!requirement || !Array.isArray(requirement.payloads)) {
      continue;
    }

    for (const payload of requirement.payloads) {
      if (!payload?.type) {
        continue;
      }

      let defaultValue:
        | AudioTimelinePayload
        | VideoEventGraphPayload
        | SceneGraphPayload
        | Record<string, unknown>
        | undefined;

      switch (payload.type) {
        case "audio_timeline":
          defaultValue = { annotations: [] } as AudioTimelinePayload;
          break;
        case "video_event_graph":
          defaultValue = { events: [], edges: [] } as VideoEventGraphPayload;
          break;
        case "scene_graph":
          defaultValue = { nodes: [], relationships: [] } as SceneGraphPayload;
          break;
        default:
          defaultValue = {};
      }

      const existing = typedState[requirement.modality] ?? {};
      typedState[requirement.modality] = {
        ...existing,
        [payload.type]: defaultValue ?? {},
      };
    }
  }

  return Object.keys(typedState).length > 0 ? state : undefined;
}

function buildDefaultParamsForBlock(
  nodeId: string,
  metadataMap: Map<string, PromptMetadata>,
): Record<string, unknown> {
  const descriptor = resolveBlockDescriptor(nodeId, metadataMap);
  const metadata =
    (descriptor?.metadataId ? metadataMap.get(descriptor.metadataId) : undefined) ??
    metadataMap.get(nodeId);

  const defaults: Record<string, unknown> = {};

  if (metadata?.slots) {
    for (const slot of metadata.slots) {
      if (!slot?.name) continue;
      defaults[slot.name] = slot.default ?? (slot.type === "number" ? 0 : "");
    }
  }

  if (isRagBlock(nodeId)) {
    Object.assign(defaults, cloneRagDefaults());
  }

  if (isApprovalBlock(nodeId)) {
    Object.assign(defaults, cloneApprovalDefaults());
  }

  const modalityDefaults = createDefaultModalityState(
    metadata?.modalities ?? descriptor?.modalities,
  );
  if (modalityDefaults) {
    defaults.modalities = modalityDefaults;
  }

  return defaults;
}

function composeBlockSummary(
  descriptor: BlockDescriptor | undefined,
  metadata: PromptMetadata | undefined,
): string {
  const baseSummary =
    metadata?.when_to_use?.split("\n")[0]?.trim() ??
    descriptor?.description ??
    metadata?.failure_modes?.split("\n")[0]?.trim() ??
    metadata?.acceptance_criteria?.split("\n")[0]?.trim() ??
    "";
  const modalitySummary = summarizeModalityRequirements(
    descriptor?.modalities ?? metadata?.modalities,
  );
  return [baseSummary, modalitySummary].filter(Boolean).join(" • ");
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
  const modalitySummary = summarizeModalityRequirements(metadata.modalities);
  if (modalitySummary) {
    insights.push({
      title: "Modalities",
      detail: modalitySummary,
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
    const defaults = buildDefaultParamsForBlock(nodeId, metadataMap);
    if (Object.keys(defaults).length > 0) {
      result[nodeId] = defaults;
    }
  }
  return result;
}

function makeNodeTypes(opts: {
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onOpenRename: (id: string) => void;
  onCopyId: (id: string) => void;
  onCopyBaseId: (id: string) => void;
  onCopyJson: (id: string) => void;
  onConvertToTemplate: (id: string) => void;
}) {
  return {
    default: memo(function FlowCanvasNode({ id, data, selected }: NodeProps<FlowNodeData>) {
      const isExtra = id.includes('#');
      return (
        <div className="relative">
          <Handle type="target" position={Position.Left} id="in" style={{ top: '50%' }} className="rf-handle" />
          <CanvasNodeCard
            id={id}
            label={data.label}
            summary={data.summary}
            category={data.category}
            selected={selected}
            status={data.status}
            isExtra={isExtra}
            onDuplicate={() => opts.onDuplicateNode(id)}
            onDelete={() => isExtra ? opts.onDeleteNode(id) : undefined}
            onRename={() => opts.onOpenRename(id)}
            onCopyId={() => opts.onCopyId(id)}
            onCopyBaseId={() => opts.onCopyBaseId(id)}
            onCopyJson={() => opts.onCopyJson(id)}
            onConvertToTemplate={() => opts.onConvertToTemplate(id)}
          />
          <Handle type="source" position={Position.Right} id="out" style={{ top: '50%' }} className="rf-handle" />
        </div>
      );
    }),
  } as const;
}
