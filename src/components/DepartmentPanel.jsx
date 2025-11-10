import React from "react";
import * as d3 from "d3";
import colleges from "../data/UIUC_budget25.json";

import { BarChart } from "./BarChart";
import { Histogram } from "./Histogram";

import {X} from "lucide-react";


function StatCard({ label, value }) {
  return (
    <div className={`rounded-lg p-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs"><p>{label}</p></span>
      </div>
      <div className="text-xl font-semibold"><p>{value}</p></div>
    </div>
  );
}
export function DepartmentPanel({ department: collegeName, year, onClose, yearCollegeIndex }) {
  const [tab, setTab] = React.useState("budget");

  // Pull all people for this (year, college) from the index
  const peopleThisYear = React.useMemo(() => {
    const byYear = yearCollegeIndex?.get(Number(year));
    const arr = byYear?.get(collegeName) || [];
    return Array.isArray(arr) ? [...arr] : [];
  }, [year, collegeName, yearCollegeIndex]);

  // Consolidate multiple positions for the same person
  const peopleCombined = React.useMemo(() => {
    const map = new Map();
    for (const p of peopleThisYear) {
      const key = p.name || "Unknown";
      const existing = map.get(key) || { name: key, totalSalary: 0, positions: [] };
      existing.totalSalary += Number(p.salary || 0);
      if (p.title) existing.positions.push(p.title);
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [peopleThisYear]);

  // Salary values for histogram (based on total salary per person)
  const salaryValues = React.useMemo(
    () => peopleCombined.map((p) => p.totalSalary ?? 0),
    [peopleCombined]
  );

  const stats = React.useMemo(() => {
    // College budget that year (from colleges.json)
    const col = colleges.find((c) => c.College === collegeName);
    const budget =
      col?.Budgets?.find((b) => Number(b.Year) === Number(year))?.Budget ?? 0;

    // Employees (unique people)
    const employeesCount = peopleCombined.length;

    // Average salary
    const avgSalary = employeesCount
      ? Math.round(
          peopleCombined.reduce((s, x) => s + (x.totalSalary || 0), 0) /
            employeesCount
        )
      : 0;

    // Top earners by total salary
    const topEarners = [...peopleCombined]
      .sort((a, b) => b.totalSalary - a.totalSalary)
      .slice(0, 3)
      .map((e) => ({
        name: e.name,
        position: e.positions.join(", ") || "—",
        salary: e.totalSalary,
      }));

    // Budget trend (for bar chart)
    const yearlyData = (col?.Budgets ?? [])
      .slice()
      .sort((a, b) => Number(a.Year) - Number(b.Year))
      .map((r) => ({ year: r.Year, budget: r.Budget }));

    const topSalary = topEarners[0]?.salary ?? 0;

    return { budget, employeesCount, avgSalary, topEarners, yearlyData, topSalary };
  }, [collegeName, year, peopleCombined]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">{collegeName}</h2>
          <p className="text-sm">
            Figures shown for <span className="font-medium">{year}</span> · Budget{" "}
            {d3.format("$.3s")(stats.budget)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab("budget")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium`}
        >
          Budget Over Years
        </button>
        <button
          onClick={() => setTab("hist")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium`}
        >
          Salary Distribution
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white border rounded-lg p-4 mb-4 min-h-[300px]">
        {tab === "budget" ? (
          <BarChart
            data={stats.yearlyData.map((d) => ({ year: d.year, value: d.budget }))}
            xKey="year"
            yKey="value"
            height={260}
            yTickFormat={d3.format("$.2s")}
            tooltipFormat={(d) => `${d.year}: ${d3.format("$.3s")(d.value)}`}
            ariaLabel={`Budget trend for ${collegeName}`}
          />
        ) : (
          <Histogram
            data={salaryValues}
            value={(d) => d}
            desiredBins={12}
            height={260}
            xTickFormat={d3.format("$.2s")}
            yTickFormat={d3.format("~s")}
            ariaLabel={`Salary distribution for ${collegeName} in ${year}`}
          />
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={`Avg Salary (${year})`} value={d3.format("$.2s")(stats.avgSalary)} />
        <StatCard label={`Employees (${year})`} value={stats.employeesCount} />
        <StatCard label={`Top Salary (${year})`} value={d3.format("$.2s")(stats.topSalary)} />
      </div>

      {/* Top earners list */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-2">Top earners in {year}</h3>
        <div className="space-y-2">
          {stats.topEarners.map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm">{p.position}</div>
              </div>
              <div className="font-semibold">{d3.format("$.2s")(p.salary)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
