import {useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";
import { useResizeObserver } from "../utils";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";

export function SankeyBudget({ data, selectedDept, onNodeClick, year }) {
  const [wrapRef, bounds] = useResizeObserver();
  const svgRef = useRef(null);

  const sankeyData = useMemo(
    () => ({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    }),
    [data]
  );

  useEffect(() => {
    if (!bounds.width) return;

    // sizing and layout
    const width = Math.max(900, bounds.width);
    const height = 750;

    const margin = { top: 24, right: 24, bottom: 24, left: 24 };
    const labelGutter = 250;
    const innerWidth = width - margin.left - margin.right - labelGutter;
    const innerHeight = height - margin.top - margin.bottom;

    const nodeW = 24;
    const nodePad = 15;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    // groups: sankey drawing area vs label gutter
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const gLabels = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + innerWidth + 8},${margin.top})`
      );

    const sk = d3Sankey()
      .nodeWidth(nodeW)
      .nodePadding(nodePad)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .nodeSort((a, b) => 0);

    const graph = sk(sankeyData);

    // center the single left/root node vertically
    const leftX = d3.min(graph.nodes, (d) => d.x0);
    const sourceNodes = graph.nodes.filter((n) => n.x0 === leftX);
    if (sourceNodes.length === 1) {
      const node = sourceNodes[0];
      const totalHeight = innerHeight;
      const nodeHeight = node.y1 - node.y0;
      const offset = (totalHeight - nodeHeight) / 2 - node.y0;

      node.y0 += offset;
      node.y1 += offset;
      graph.links.forEach((l) => {
        if (l.source === node) l.y0 += offset;
        if (l.target === node) l.y1 += offset;
      });
    }


    g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d) => (d.target.name === selectedDept ? "#FF6400" : "#ff660087"))
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .style("cursor", "pointer")
      .on("click", (_e, d) => onNodeClick(d.target.name))
      .append("title")
      .text(
        (d) => `${d.source.name} → ${d.target.name}: ${d3.format("$.3s")(d.value)} (${year})`
      );

    const nodeG = g
      .append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .style("cursor", (d) => (d.name !== "University Budget" ? "pointer" : "default"))
      .on("click", (_e, d) => {
        if (d.name !== "University Budget") onNodeClick(d.name);
      });

    nodeG
      .append("rect")
      .attr("height", (d) => d.y1 - d.y0) // keep layout height (don't override) so links match
      .attr("width", (d) => d.x1 - d.x0)
      .attr("fill", (d) => (d.name === selectedDept ? "#FF6400" : "#FF6400"))
      .attr("stroke", (d) => ((d.y1 - d.y0) < 6 ? "#FF6400" : "none"))
      .attr("stroke-width", (d) => ((d.y1 - d.y0) < 6 ? 1 : 0))
      .append("title")
      .text((d) => `${d.name}\n${d3.format("$.3s")(d.value)} (${year})`);


    // UNIVERSITY BUDGET LABEL!
    const rootNodeG = nodeG.filter((d) => d.name === "University Budget");
    if (!rootNodeG.empty()) {
      rootNodeG
        .append("text")
        .attr("x", 250) // to the left of the left edge of the rect
        .attr("y", (d) => (d.y1 - d.y0) / 2) // vertically centered on the node
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-weight", 500)
        .attr("font-size", 14)
        .attr("fill", "#000")
        .style("pointer-events", "none") // ensure no hover/click behavior
        .text((d) => `University Budget — ${d3.format("$,.0f")(d.value)}`);
    }

    // DEPARTMENT LABELS (single line with collision spacing)
    const fmt = d3.format("$,.0f");
    const nodesForLabels = graph.nodes
      .filter((d) => d.name !== "University Budget")
      .sort((a, b) => ((a.y0 + a.y1) / 2) - ((b.y0 + b.y1) / 2));

    // collision avoidance: enforce a minimum vertical gap between label centers
    const minGap = 14; // px between label centers
    const labelPositions = [];
    nodesForLabels.forEach((d, i) => {
      let y = (d.y0 + d.y1) / 2;
      if (i > 0) {
        const prev = labelPositions[i - 1];
        if (y - prev < minGap) y = prev + minGap;
      }
      labelPositions.push(Math.min(y, innerHeight - 2)); // clamp near bottom just in case
    });

    // add a transparent hitbox for easier clicking
    const hitH = 18;
    gLabels
      .selectAll("rect.hit")
      .data(nodesForLabels)
      .join("rect")
      .attr("class", "hit")
      .attr("x", -6)
      .attr("y", (_d, i) => labelPositions[i] - hitH / 2)
      .attr("width", labelGutter)
      .attr("height", hitH)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", (_e, d) => onNodeClick(d.name));

    // label text
    gLabels
      .selectAll("text.node-label")
      .data(nodesForLabels)
      .join("text")
      .attr("class", "node-label")
      .attr("x", 0)
      .attr("y", (_d, i) => labelPositions[i])
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .attr("font-weight", 500)
      .attr("font-size", 13)
      .attr("fill", "#000") // force black to avoid iOS dark-mode inversion
      .style("cursor", "pointer")
      .text((d) => `${d.name} — ${fmt(d.value)}`)
      .on("click", (_e, d) => onNodeClick(d.name));

  }, [bounds.width, sankeyData, selectedDept, onNodeClick, year]);

  return (
    <div ref={wrapRef} className="w-full h-[560px]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
