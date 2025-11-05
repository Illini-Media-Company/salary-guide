import React from "react";
import * as d3 from "d3";


export function Histogram({
  data,                      // array of numbers or objects
  value = (d) => d,          // accessor -> number (e.g., d => d.salary)
  height = 260,
  desiredBins = 12,          // target bin count if binStep not given
  binStep,                   // fixed bin width in same units as data (e.g., 25000)
  xTickFormat = d3.format("$.2s"),
  yTickFormat = d3.format("~s"),
  ariaLabel = "Histogram",
  barRadius = 3,
  barGapPx = 2,              // uniform visual gap between bars
  emptyBinOpacity = 0.15,    // faint fill for empty bins so spacing reads consistently
}) {
  const wrapRef = React.useRef(null);
  const svgRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (!wrapRef.current || !data?.length) return;

    const width = wrapRef.current.clientWidth || 600;
    const m = { t: 16, r: 16, b: 32, l: 56 };
    const W = Math.max(0, width - m.l - m.r);
    const H = Math.max(0, height - m.t - m.b);

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", ariaLabel);

    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    // ---- values & bin edges ----
    const vals = data.map(value).filter((v) => Number.isFinite(v));
    if (!vals.length) return;

    const vmin = d3.min(vals), vmax = d3.max(vals);

    // choose a constant step
    const step = binStep ?? d3.tickStep(vmin, vmax, Math.max(1, desiredBins));

    // align to step so edges are exact multiples
    const minEdge = Math.floor(vmin / step) * step;
    const maxEdge = Math.ceil(vmax / step) * step;

    // explicit thresholds → equal bin widths
    const thresholds = d3.range(minEdge, maxEdge + step, step);

    // x-scale uses aligned edges (no extra .nice())
    const x = d3.scaleLinear().domain([minEdge, maxEdge]).range([0, W]);

    const binGen = d3.bin().domain(x.domain()).thresholds(thresholds);
    const bins = binGen(vals);

    // y = counts
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (b) => b.length) || 0])
      .nice()
      .range([H, 0]);

    // axes
    g.append("g")
      .attr("transform", `translate(0,${H})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(xTickFormat));

    g.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(yTickFormat));

    // bars (draw all bins, even empty ones), consistent width + gap
    g.selectAll("rect.bar")
      .data(bins)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.x0) + barGapPx / 2)
      .attr("y", (d) => y(d.length))
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - barGapPx))
      .attr("height", (d) => H - y(d.length))
      .attr("fill", "#FF6400")
      .attr("opacity", (d) => (d.length === 0 ? emptyBinOpacity : 1))
      .attr("rx", barRadius);

    // optional tooltip
    const tip = g.append("g").style("display", "none");
    const tipBg = tip.append("rect").attr("rx", 4).attr("ry", 4).attr("fill", "black").attr("opacity", 0.9);
    const tipText = tip.append("text").attr("fill", "white").attr("font-size", 11).attr("dy", "0.35em");

    g.selectAll("rect.bar")
      .on("mouseenter", function () {
        d3.select(this).attr("opacity", 0.85);
        tip.style("display", null);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", (d) => (d.length === 0 ? emptyBinOpacity : 1));
        tip.style("display", "none");
      })
      .on("mousemove", function (event, d) {
        const label = `${xTickFormat(d.x0)} - ${xTickFormat(d.x1)} ${d.length} ${d.length === 1 ? "person" : "people"}`;
        tipText.text(label);
        const bb = tipText.node().getBBox();
        tipBg
          .attr("x", bb.x - 6)
          .attr("y", bb.y - 4)
          .attr("width", bb.width + 12)
          .attr("height", bb.height + 8);

        const [mx, my] = d3.pointer(event, this);
        let tx = mx + 10;
        let ty = my - 10 - (bb.height + 8);
        if (tx + bb.width + 12 > W) tx = W - (bb.width + 12);
        if (ty < 0) ty = my + 14;
        tip.attr("transform", `translate(${tx},${ty})`);
      });
  }, [data, value, height, desiredBins, binStep, xTickFormat, yTickFormat, ariaLabel, barRadius, barGapPx, emptyBinOpacity]);

  return (
    <div ref={wrapRef} className="w-full" style={{ minHeight: height }}>
      <svg ref={svgRef} className="w-full" style={{ height }} />
    </div>
  );
}