"use client";

import { memo, useMemo, useState, type MouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow";

type SmartEdgeData = {
  editable?: boolean;
  onChangeLabel?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  onQuickInsert?: (id: string) => void;
};

export const SmartEdge = memo(function SmartEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, label, selected, data }: EdgeProps<SmartEdgeData>) {
  const [path, labelX, labelY] = useMemo(
    () => getBezierPath({ sourceX, sourceY, targetX, targetY }),
    [sourceX, sourceY, targetX, targetY],
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(label ?? ""));
  const editable = Boolean(data?.editable);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            zIndex: 30,
          }}
        >
          {editing ? (
            <input
              className="rounded border bg-card px-1 py-0.5 text-xs shadow"
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  data?.onChangeLabel?.(id, value.trim());
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={() => {
                data?.onChangeLabel?.(id, value.trim());
                setEditing(false);
              }}
              autoFocus
              style={{ minWidth: 40 }}
            />
          ) : (
            <div className={`flex items-center gap-1 rounded bg-white/70 px-1 py-0.5 text-[10px] shadow ${selected ? "outline outline-1 outline-ring" : ""}`}>
              <button
                data-testid={`edge-label-${id}`}
                className="underline-offset-2 hover:underline"
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  if (!editable) return;
                  if (e.altKey || e.shiftKey) {
                    data?.onQuickInsert?.(id);
                    return;
                  }
                  setValue(String(label ?? ""));
                  setEditing(true);
                }}
              >
                {String(label ?? "")}
              </button>
              {editable ? (
                <button
                  data-testid={`edge-delete-${id}`}
                  aria-label="Delete edge"
                  className="rounded px-1 text-[10px] hover:bg-rose-50 hover:text-rose-600"
                  onClick={(e) => { e.stopPropagation(); data?.onDelete?.(id); }}
                >
                  ×
                </button>
              ) : null}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
