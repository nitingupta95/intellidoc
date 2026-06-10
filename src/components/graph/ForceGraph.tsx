"use client";
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode, EntityType } from "@/types/graph";

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

interface ForceGraphProps {
  data: GraphData;
  highlightNodeId?: string | null;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
}

export function ForceGraph({ data, highlightNodeId, onNodeClick, onNodeHover }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<any, any> | null>(null);

  const render = useCallback(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth  || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll("*").remove();

    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (e) => g.attr("transform", e.transform))
    );

    // Arrow marker
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20).attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8).attr("markerHeight", 8)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#475569");

    const nodes: any[] = data.nodes.map(n => ({ ...n }));
    const edges: any[] = data.edges.map(e => ({ ...e }));

    simRef.current = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id((d: any) => d.id).distance(80).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(24));

    // Edges
    const link = g.append("g").selectAll("line")
      .data(edges).join("line")
      .attr("stroke", "#334155")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => Math.min(Math.sqrt(d.weight ?? 1) * 1.5, 6))
      .attr("marker-end", "url(#arrowhead)");

    // Edge labels
    const edgeLabel = g.append("g").selectAll("text")
      .data(edges).join("text")
      .attr("font-size", 9)
      .attr("fill", "#64748B")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .text((d: any) => d.type);

    // Nodes
    const node = g.append("g").selectAll<SVGGElement, any>("g")
      .data(nodes).join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, any>()
          .on("start", (e, d) => {
            if (!e.active) simRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d) => {
            if (!e.active) simRef.current?.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on("click", (_, d: any) => onNodeClick(d))
      .on("mouseenter", (_, d: any) => onNodeHover(d))
      .on("mouseleave", () => onNodeHover(null));

    // Node circles
    node.append("circle")
      .attr("r", (d: any) => Math.max(8, Math.min(20, 8 + Math.log(d.frequency + 1) * 3)))
      .attr("fill", (d: any) => NODE_COLORS[d.type as EntityType] ?? "#94A3B8")
      .attr("fill-opacity", (d: any) => highlightNodeId && d.id !== highlightNodeId ? 0.25 : 0.9)
      .attr("stroke", "#1E293B")
      .attr("stroke-width", 1.5);

    // Node labels
    node.append("text")
      .attr("dy", (d: any) => -Math.max(8, Math.min(20, 8 + Math.log(d.frequency + 1) * 3)) - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#CBD5E1")
      .attr("pointer-events", "none")
      .text((d: any) => d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name);

    // Tick
    simRef.current.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      edgeLabel
        .attr("x", (d: any) => ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2)
        .attr("y", (d: any) => ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2);

      node.attr("transform", (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    setTimeout(() => simRef.current?.alphaTarget(0).stop(), 3000);
  }, [data, highlightNodeId, onNodeClick, onNodeHover]);

  useEffect(() => { render(); return () => { simRef.current?.stop(); }; }, [render]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}
