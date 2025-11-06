"use client";

import { cn } from "@/lib/utils";
import { getNodeTheme } from "@/design/node-theme";

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

  return (
    <article
      data-testid={`flow-node-${id}`}
      className={cn(
        "group relative rounded-xl border px-4 py-3 shadow-sm transition-all duration-200",
        theme.base,
        selected ? theme.selected : "hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {summary && (
            <p className="text-xs text-muted-foreground max-h-20 overflow-hidden">
              {summary}
            </p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            theme.badge,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Category:</span>
          <span>{category ?? "Node"}</span>
        </span>
      </div>
    </article>
  );
}
