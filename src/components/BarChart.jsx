import React from "react";
import * as d3 from "d3";
import { useResizeObserver } from "../utils";

export function BarChart({
  data,             // [{ year: 2020, value: 1_000_000 }, ...]
  xKey = "year",
  yKey = "value",
  height = 240,
  yTickFormat = d3.format("$.2s"),
  tooltipFormat = (d) => `${d[xKey]}: ${yTickFormat(d[yKey])}`,
  ariaLabel = "Bar chart",
  barRadius = 4,
}) {
  const [wrapRef, bounds] = useResizeObserver();
  const svgRef = React.useRef(null);

  React.useEffect(() => {
    if (!bounds.width || !data?.length) return;

    const width = bounds.width;
    const m = { t: 16, r: 16, b: 36, l: 56 };
    const W = width - m.l - m.r;
    const H = height - m.t - m.b;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", ariaLabel);

    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    // scales
    const x = d3.scaleBand()
      .domain(data.map(d => String(d[xKey])))
      .range([0, W])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d[yKey]) || 0]).nice()
      .range([H, 0]);

    // axes
    g.append("g")
      .attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x).tickFormat(d => d).tickSizeOuter(0));

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(yTickFormat));

    // bars
    const bars = g.selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(String(d[xKey])))
      .attr("y", d => y(+d[yKey]))
      .attr("width", x.bandwidth())
      .attr("height", d => H - y(+d[yKey]))
      .attr("fill", "#FF6400")
      .attr("rx", barRadius);

    // tooltip group
    const tip = g.append("g").style("display", "none");
    const tipBg = tip.append("rect")
      .attr("rx", 4).attr("ry", 4)
      .attr("fill", "black").attr("opacity", 0.9);
    const tipText = tip.append("text")
      .attr("fill", "white")
      .attr("font-size", 11)
      .attr("dy", "0.35em");

    // hover interaction
    bars.on("mouseenter", function (event, d) {
        tip.style("display", null);
        d3.select(this).attr("opacity", 0.85);
      })
      .on("mouseleave", function () {
        tip.style("display", "none");
        d3.select(this).attr("opacity", 1);
      })
      .on("mousemove", function (event, d) {
        const xCenter = (x(String(d[xKey])) ?? 0) + x.bandwidth() / 2;
        const yTop = y(+d[yKey]);

        const label = tooltipFormat(d);
        tipText.text(label);
        const bb = tipText.node().getBBox();
        tipBg
          .attr("x", bb.x - 6)
          .attr("y", bb.y - 4)
          .attr("width", bb.width + 12)
          .attr("height", bb.height + 8);

        // position tooltip above the bar, with clamping
        let tx = xCenter - (bb.width + 12) / 2;
        let ty = yTop - (bb.height + 14);
        if (tx < 0) tx = 0;
        if (tx + bb.width + 12 > W) tx = W - (bb.width + 12);
        if (ty < 0) ty = yTop + 10; // if too high, place under the bar

        tip.attr("transform", `translate(${tx},${ty})`);
      });

  }, [bounds.width, height, data, xKey, yKey, ariaLabel, yTickFormat, tooltipFormat, barRadius]);

  return (
    <div ref={wrapRef} className="w-full" style={{ minHeight: height }}>
      <svg ref={svgRef} className="w-full" style={{ height }} />
    </div>
  );
}

