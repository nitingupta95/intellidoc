"use client";
import { useState, useCallback } from "react";
import {
  Network,
  Filter,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ForceGraph } from "@/components/graph/ForceGraph";
import { NodePanel } from "@/components/graph/NodePanel";
import { ClusterFilter } from "@/components/graph/ClusterFilter";
import { GraphSearch } from "@/components/graph/GraphSearch";
import { useGraphData } from "@/hooks/useGraphData";
import type { GraphNode, EntityType } from "@/types/graph";

export default function KnowledgeGraphPage() {
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showClusters, setShowClusters] = useState(false);

  const { graphData, isLoading, isError } = useGraphData(
    selectedTypes.length ? { types: selectedTypes } : undefined
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setHighlightId(node.id);
  }, []);

  const handleNodeHover = useCallback((_node: GraphNode | null) => {
    // Could add tooltip logic here
  }, []);

  const handleSearchHighlight = useCallback(
    (nodeId: string | null) => {
      setHighlightId(nodeId);
    },
    []
  );

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      setHighlightId(node.id);
    },
    []
  );

  const handleExport = async (format: "json" | "csv") => {
    try {
      const res = await fetch(`/api/graph/export?format=${format}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `intellidoc-graph.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            Knowledge Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize entities, topics, and their relationships.
          </p>
        </div>
        <div className="flex gap-2">
          <GraphSearch
            onHighlight={handleSearchHighlight}
            onSelectNode={handleSearchSelect}
          />
          <Button
            variant="outline"
            className="glass"
            onClick={() => setShowClusters((s) => !s)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Clusters
            {selectedTypes.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {selectedTypes.length}
              </span>
            )}
          </Button>
          <Button
            className="font-medium px-6 shadow-lg shadow-primary/20"
            onClick={() => handleExport("json")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Graph
          </Button>
        </div>
      </header>

      {/* Main canvas area */}
      <div className="flex-1 flex overflow-hidden rounded-xl border border-border/50">
        {/* Cluster filter sidebar */}
        {showClusters && (
          <ClusterFilter
            selected={selectedTypes}
            onChange={setSelectedTypes}
            onClose={() => setShowClusters(false)}
          />
        )}

        {/* Graph canvas */}
        <div className="flex-1 relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Loading knowledge graph...
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3 max-w-sm bg-background/60 p-8 rounded-2xl border border-destructive/30 backdrop-blur-xl">
                <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
                <h3 className="text-lg font-semibold">
                  Failed to load graph
                </h3>
                <p className="text-sm text-muted-foreground">
                  Could not connect to the graph service. Make sure your AI
                  service is running.
                </p>
              </div>
            </div>
          ) : !graphData?.nodes || graphData.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md bg-background/60 p-8 rounded-2xl border border-border/50 backdrop-blur-xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Network size={32} />
                </div>
                <h3 className="text-xl font-heading font-semibold">
                  Graph Visualization Ready
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload and process documents to see entities and
                  relationships appear here. The knowledge graph is
                  automatically built during document ingestion.
                </p>
              </div>
            </div>
          ) : (
            <ForceGraph
              data={graphData}
              highlightNodeId={highlightId}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
            />
          )}

          {/* Stats bar */}
          {graphData?.nodes?.length > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-3 z-10">
              {[
                { label: "Entities", val: graphData.stats.nodeCount },
                { label: "Relationships", val: graphData.stats.edgeCount },
                { label: "Documents", val: graphData.stats.docCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-md border border-border/50 text-center"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="text-sm font-bold text-foreground">{s.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            onClose={() => {
              setSelectedNode(null);
              setHighlightId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
