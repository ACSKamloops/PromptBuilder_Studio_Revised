import {
  BadgeCheck,
  Brain,
  Compass,
  Database,
  Layers,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NodeTheme {
  base: string;
  selected: string;
  badge: string;
  icon: LucideIcon;
}

const CATEGORY_THEME_MAP: Record<string, NodeTheme> = {
  mandate: {
    base: "border-sky-200 bg-sky-50/80 hover:border-sky-300",
    selected: "border-sky-500 ring-2 ring-sky-400/50 shadow-sky-200",
    badge: "bg-sky-100 text-sky-700",
    icon: Target,
  },
  grounding: {
    base: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300",
    selected: "border-emerald-500 ring-2 ring-emerald-400/50 shadow-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    icon: Database,
  },
  verification: {
    base: "border-amber-200 bg-amber-50/80 hover:border-amber-300",
    selected: "border-amber-500 ring-2 ring-amber-400/50 shadow-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: BadgeCheck,
  },
  structure: {
    base: "border-indigo-200 bg-indigo-50/80 hover:border-indigo-300",
    selected: "border-indigo-500 ring-2 ring-indigo-400/50 shadow-indigo-200",
    badge: "bg-indigo-100 text-indigo-700",
    icon: Layers,
  },
  strategy: {
    base: "border-purple-200 bg-purple-50/80 hover:border-purple-300",
    selected: "border-purple-500 ring-2 ring-purple-400/50 shadow-purple-200",
    badge: "bg-purple-100 text-purple-700",
    icon: Compass,
  },
  output: {
    base: "border-rose-200 bg-rose-50/75 hover:border-rose-300",
    selected: "border-rose-500 ring-2 ring-rose-400/50 shadow-rose-200",
    badge: "bg-rose-100 text-rose-700",
    icon: Sparkles,
  },
  evaluation: {
    base: "border-slate-200 bg-slate-50/80 hover:border-slate-300",
    selected: "border-slate-500 ring-2 ring-slate-400/50 shadow-slate-200",
    badge: "bg-slate-100 text-slate-700",
    icon: Workflow,
  },
};

const DEFAULT_THEME: NodeTheme = {
  base: "border-border bg-card/85 hover:border-primary/40",
  selected: "border-primary ring-2 ring-primary/40 shadow-primary/10",
  badge: "bg-muted text-muted-foreground",
  icon: Brain,
};

export type { NodeTheme };

export function getNodeTheme(category?: string): NodeTheme {
  if (!category) {
    return DEFAULT_THEME;
  }
  const key = category.toLowerCase();
  return CATEGORY_THEME_MAP[key] ?? DEFAULT_THEME;
}
