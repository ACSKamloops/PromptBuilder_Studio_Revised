"use client";

import { cn } from "@/lib/utils";
import { getNodeTheme } from "@/design/node-theme";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Copy, Pencil, Trash2, MoreVertical } from "lucide-react";

export interface CanvasNodeCardProps {
  id: string;
  label: string;
  summary?: string;
  category?: string;
  selected?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  onDuplicate?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  isExtra?: boolean;
  onCopyId?: () => void;
  onCopyBaseId?: () => void;
  onCopyJson?: () => void;
  onConvertToTemplate?: () => void;
  ghost?: boolean;
}

export function CanvasNodeCard({
  id,
  label,
  summary,
  category,
  selected,
  status = 'idle',
  onDuplicate,
  onDelete,
  onRename,
  isExtra = false,
  onCopyId,
  onCopyBaseId,
  onCopyJson,
  onConvertToTemplate,
  ghost = false,
}: CanvasNodeCardProps) {
  const theme = getNodeTheme(category);
  const Icon = theme.icon;
  const baseId = id.includes('#') ? id.split('#')[0] : id;
  const instance = id.includes('#') ? 'extra' : 'preset';

  return (
    <motion.article
      initial={{ opacity: 0.85, scale: 0.97, y: 3 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      data-testid={`flow-node-${id}`}
      data-node-baseid={baseId}
      data-node-instance={instance}
      className={cn(
        "group relative min-w-[240px] max-w-[340px] rounded-2xl border border-transparent bg-background/70 backdrop-blur-sm transition-all duration-200",
        ghost
          ? "pointer-events-none border-dashed border-border/60 opacity-90"
          : selected
            ? "ring-2 ring-primary/60 shadow-lg"
            : "hover:border-border/70 hover:shadow-md",
      )}
    >
      <div className={cn("node-drag-handle flex items-center gap-2 rounded-2xl rounded-b-none px-3 py-2 text-white", theme.badge)}>
        <div className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/20">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <p className="truncate text-sm font-semibold tracking-wide flex-1">{label}</p>
        <div className="flex items-center gap-1 text-white/85">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-white"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                aria-label="Duplicate node"
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-white"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onRename?.(); }}
                aria-label="Rename node"
              >
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 text-white"
                  disabled={!isExtra}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  aria-label="Delete node"
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{isExtra ? 'Delete' : 'Only extras removable'}</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-white"
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="More actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1">
              <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={(e) => { e.stopPropagation(); onCopyId?.(); }}>Copy ID</button>
              <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={(e) => { e.stopPropagation(); onCopyBaseId?.(); }}>Copy Base ID</button>
              <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={(e) => { e.stopPropagation(); onCopyJson?.(); }}>Copy Node JSON</button>
              <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={(e) => { e.stopPropagation(); onConvertToTemplate?.(); }}>Convert to Template</button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="px-3 pb-3 pt-3 nodrag">
        {summary ? (
          <p className="text-xs text-muted-foreground max-h-24 overflow-hidden leading-relaxed">
            {summary}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">Drag to the canvas and configure in the inspector.</p>
        )}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: theme.dot }} aria-hidden="true" />
            <span className="uppercase tracking-wide">{category ?? "Node"}</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/70">{baseId}</span>
        </div>
      </div>
    </motion.article>
  );
}
