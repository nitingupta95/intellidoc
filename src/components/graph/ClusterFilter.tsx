"use client";
import { X } from "lucide-react";
import type { EntityType } from "@/types/graph";

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

const ALL_TYPES: EntityType[] = [
  "PERSON", "ORGANIZATION", "LOCATION", "CONCEPT",
  "PRODUCT", "EVENT", "TOPIC", "METRIC", "DATE",
];

interface ClusterFilterProps {
  selected: EntityType[];
  onChange: React.Dispatch<React.SetStateAction<EntityType[]>>;
  onClose: () => void;
}

export function ClusterFilter({ selected, onChange, onClose }: ClusterFilterProps) {
  const toggle = (type: EntityType) => {
    onChange((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="w-56 border-r border-border bg-card/80 backdrop-blur-xl flex flex-col animate-in slide-in-from-left-5 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground">Clusters</h4>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {ALL_TYPES.map((type) => {
          const isSelected = selected.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm transition-colors ${
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground/80"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              <span className="flex-1 text-left">{type}</span>
              {isSelected && (
                <span className="text-xs text-primary">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      {selected.length > 0 && (
        <div className="p-2 border-t border-border">
          <button
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-primary w-full text-left px-2.5 py-1.5 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
