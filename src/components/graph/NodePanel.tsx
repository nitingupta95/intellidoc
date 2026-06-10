"use client";
import { X } from "lucide-react";
import type { GraphNode, EntityType } from "@/types/graph";

const NODE_COLORS: Record<EntityType, string> = {
  PERSON:       "#60A5FA",
  ORGANIZATION: "#34D399",
  LOCATION:     "#F59E0B",
  CONCEPT:      "#A78BFA",
  PRODUCT:      "#F472B6",
  EVENT:        "#FB923C",
  DATE:         "#94A3B8",
  METRIC:       "#2DD4BF",
  TOPIC:        "#C084FC",
};

interface NodePanelProps {
  node: GraphNode;
  onClose: () => void;
}

export function NodePanel({ node, onClose }: NodePanelProps) {
  const color = NODE_COLORS[node.type] ?? "#94A3B8";

  return (
    <div className="w-80 border-l border-border bg-card/80 backdrop-blur-xl flex flex-col animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-1.5"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {node.type}
          </span>
          <h3 className="text-sm font-semibold text-foreground truncate">{node.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Description */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground/80">
            {node.description || "No description available."}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-accent/50 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{node.frequency}</p>
            <p className="text-xs text-muted-foreground">Mentions</p>
          </div>
          <div className="rounded-lg bg-accent/50 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{node.docIds?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
        </div>

        {/* Document list */}
        {node.docIds && node.docIds.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Found in documents</p>
            <div className="space-y-1.5">
              {node.docIds.map((id) => (
                <div
                  key={id}
                  className="text-xs text-foreground/70 bg-accent/30 px-2 py-1 rounded truncate"
                >
                  {id}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
