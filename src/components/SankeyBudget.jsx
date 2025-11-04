import React, {useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";
import { useResizeObserver } from "../utils";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";

export function SankeyBudget({ data, selectedDept, onNodeClick, year }) {
  const [wrapRef, bounds] = useResizeObserver();
  const svgRef = useRef(null);

  const sankeyData = useMemo(() => ({
    nodes: data.nodes.map(d => ({ ...d })),
    links: data.links.map(d => ({ ...d })),
  }), [data]);

  useEffect(() => {
    if (!bounds.width) return;

    const width = Math.max(640, bounds.width);
    const height = 600;
    const nodeW = 20;
    const nodePad = 12;

    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    const sk = d3Sankey()
      .nodeWidth(nodeW)
      .nodePadding(nodePad)
      .extent([[24, 24], [width - 24, height - 24]]).nodeSort((a, b) => 0);

    const graph = sk(sankeyData);

    const leftX = d3.min(graph.nodes, d => d.x0);
    const sourceNodes = graph.nodes.filter(n => n.x0 === leftX);

    if (sourceNodes.length === 1) {
      const node = sourceNodes[0];
      const totalHeight = height - 48; // account for top/bottom padding
      const nodeHeight = node.y1 - node.y0;
      const offset = (totalHeight - nodeHeight) / 2 - node.y0;

      // Shift node vertically
      node.y0 += offset;
      node.y1 += offset;

      // Shift all links connected to this node
      graph.links.forEach(l => {
        if (l.source === node) {
          l.y0 += offset;
        }
        if (l.target === node) {
          l.y1 += offset;
        }
      });
    }

    // LINKS
    svg.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", d => d.target.name === selectedDept ? "#FF6400" : "#ff660087")
      // .attr("stroke-opacity", 0.45)
      .attr("stroke-width", d => Math.max(1, d.width))
      .style("cursor", "pointer")
      .on("click", (_e, d) => onNodeClick(d.target.name))
      .append("title")
      .text(d => `${d.source.name} → ${d.target.name}: ${d3.format("$.3s")(d.value)} (${year})`);

    // NODES
    const node = svg.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .style("cursor", d => d.name !== "University Budget" ? "pointer" : "default")
      .on("click", (_e, d) => { if (d.name !== "University Budget") onNodeClick(d.name); });

    node.append("rect")
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      // .attr("rx", 4)
      .attr("fill", "#FF6400")
      .append("title")
      .text(d => `${d.name}\n${d3.format("$.3s")(d.value)} (${year})`);

    // OUTSIDE LABELS: name + dollar value
    const fmt = d3.format("$,.0f");
    node.append("text")
      .attr("x", d => (d.x0 < width / 2 ? (d.x1 - d.x0) + 8 : -8))
      .attr("y", d => (d.y1 - d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => (d.x0 < width / 2 ? "start" : "end"))
      .attr("class", "font-normal fill-slate-900 text-[13px]")
      .text(d => `${d.name}  ${fmt(d.value)}`);

  }, [bounds.width, sankeyData, selectedDept, onNodeClick, year]);

  return (
    <div ref={wrapRef} className="w-full h-[560px]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
