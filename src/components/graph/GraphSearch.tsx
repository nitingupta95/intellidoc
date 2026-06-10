"use client";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
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

interface GraphSearchProps {
  onHighlight: (id: string | null) => void;
  onSelectNode: (node: GraphNode) => void;
}

export function GraphSearch({ onHighlight, onSelectNode }: GraphSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GraphNode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef[0]) clearTimeout(debounceRef[0]);
      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      const timeout = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/graph/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          setResults(data.nodes ?? []);
          setOpen(true);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
      debounceRef[0] = timeout;
    },
    [debounceRef]
  );

  return (
    <div className="relative w-72">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search entities..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full h-9 pl-8 pr-8 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              onHighlight(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.slice(0, 8).map((node) => (
            <button
              key={node.id}
              onClick={() => {
                onHighlight(node.id);
                onSelectNode(node);
                setOpen(false);
                setQuery(node.name);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
            >
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${NODE_COLORS[node.type] ?? "#94A3B8"}20`,
                  color: NODE_COLORS[node.type] ?? "#94A3B8",
                }}
              >
                {node.type}
              </span>
              <span className="flex-1 truncate text-foreground">{node.name}</span>
              <span className="text-xs text-muted-foreground">{node.frequency}×</span>
            </button>
          ))}
        </div>
      )}

      {open && loading && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg z-50 p-3 text-sm text-muted-foreground text-center">
          Searching...
        </div>
      )}
    </div>
  );
}
