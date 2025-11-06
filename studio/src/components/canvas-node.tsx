"use client";

import { cn } from "@/lib/utils";
import { getNodeTheme } from "@/design/node-theme";
import { motion } from "framer-motion";

export interface CanvasNodeCardProps {
  id: string;
  label: string;
  summary?: string;
  category?: string;
  selected?: boolean;
}

export function CanvasNodeCard({
  id,
  label,
  summary,
  category,
  selected,
}: CanvasNodeCardProps) {
  const theme = getNodeTheme(category);
  const Icon = theme.icon;
  const baseId = id.includes('#') ? id.split('#')[0] : id;
  const instance = id.includes('#') ? 'extra' : 'preset';

  return (
    <motion.article
      initial={{ opacity: 0.8, scale: 0.96, y: 2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      data-testid={`flow-node-${id}`}
      data-node-baseid={baseId}
      data-node-instance={instance}
      className={cn(
        "group relative min-w-[240px] max-w-[340px] rounded-xl border p-0 shadow-sm transition-all duration-200 bg-card",
        theme.base,
        selected ? theme.selected : "hover:shadow-md",
      )}
    >
      <div className={cn("node-drag-handle flex items-center gap-3 rounded-t-xl px-3 py-2", theme.badge)}>
        <div className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/70">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
      </div>
      <div className="px-3 pb-3 pt-2">
        {summary && (
          <p className="text-xs text-muted-foreground max-h-24 overflow-hidden leading-relaxed">
            {summary}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            theme.badge,
          )}
          >
            <span>{category ?? "Node"}</span>
          </span>
        </div>
      </div>
    </motion.article>
  );
}
