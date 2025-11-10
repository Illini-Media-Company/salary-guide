import React from "react";
import * as d3 from "d3";
import { useResizeObserver } from "../utils";

export function BarChart({
  data,
  xKey = "year",
  yKey = "value",
  height = 240,
  yTickFormat = d3.format("$.2s"),
  tooltipFormat = (d) => `${d[xKey]}: ${yTickFormat(d[yKey])}`,
  ariaLabel = "Bar chart",
  barRadius = 4,

  minBarWidth = 28,       // min width per bar
  barGap = 6,             // gap between bars (px)
  rotateThreshold = 420,  // rotate labels when inner width below this
  rotateAngle = -35,      // rotation angle
  smallFont = 11,         // label font when rotated
  normalFont = 12,
}) {
  const [wrapRef, bounds] = useResizeObserver();
  const svgRef = React.useRef(null);

  React.useEffect(() => {
    if (!bounds.width || !data?.length) return;

    const m = { t: 16, r: 10, b: 48, l: 48 };

    // Width we need to respect minBarWidth (causes horizontal scroll if needed)
    const innerNeeded = data.length * minBarWidth + (data.length - 1) * barGap;
    const innerAvail = Math.max(bounds.width - m.l - m.r, 60);
    const W = Math.max(innerAvail, innerNeeded);
    const width = W + m.l + m.r;
    const H = height - m.t - m.b;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", ariaLabel);

    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => String(d[xKey])))
      .range([0, W])
      .paddingInner(barGap / (minBarWidth + barGap))
      .paddingOuter(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => +d[yKey]) || 0])
      .nice()
      .range([H, 0]);

    const xAxis = d3.axisBottom(x).tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat(yTickFormat);

    const xg = g.append("g").attr("transform", `translate(0,${H})`).call(xAxis);
    g.append("g").call(yAxis).selectAll("text").attr("font-size", 11);

    // Rotate labels if space is tight
    const rotate = W < rotateThreshold || x.bandwidth() < minBarWidth + 2;
    xg.selectAll("text")
      .attr("font-size", rotate ? smallFont : normalFont)
      .attr("text-anchor", rotate ? "end" : "middle")
      .attr("transform", rotate ? `rotate(${rotateAngle})` : null)
      .attr("dx", rotate ? "-0.4em" : null)
      .attr("dy", rotate ? "0.15em" : "0.71em");

    // Bars
    const bars = g
      .selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(String(d[xKey])))
      .attr("y", (d) => y(+d[yKey]))
      .attr("width", Math.max(1, x.bandwidth()))
      .attr("height", (d) => H - y(+d[yKey]))
      .attr("fill", "#FF6400")
      .attr("rx", barRadius);

    // Tooltip
    const tip = g.append("g").style("display", "none");
    const tipBg = tip.append("rect").attr("rx", 4).attr("ry", 4).attr("fill", "black").attr("opacity", 0.9);
    const tipText = tip.append("text").attr("fill", "white").attr("font-size", 11).attr("dy", "0.35em");

    bars
      .on("mouseenter", function () {
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

        let tx = xCenter - (bb.width + 12) / 2;
        let ty = yTop - (bb.height + 14);
        if (tx < 0) tx = 0;
        if (tx + bb.width + 12 > W) tx = W - (bb.width + 12);
        if (ty < 0) ty = yTop + 10;

        tip.attr("transform", `translate(${tx},${ty})`);
      });
  }, [
    bounds.width,
    data,
    xKey,
    yKey,
    height,
    yTickFormat,
    tooltipFormat,
    barRadius,
    minBarWidth,
    barGap,
    rotateThreshold,
    rotateAngle,
    smallFont,
    normalFont,
    ariaLabel
  ]);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-x-auto"
      style={{ minHeight: height, WebkitOverflowScrolling: "touch" }}
    >
      <svg ref={svgRef} />
    </div>
  );
}
