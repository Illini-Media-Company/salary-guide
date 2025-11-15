import React from "react";
import * as d3 from "d3";
import colleges from "../data/budget25(proposed).json";

import { BarChart } from "./BarChart";
import { Histogram } from "./Histogram";
import { X } from "lucide-react";

function formatBudget(d) {
  return d3.format("$.3s")(d).replace("G", "B");
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">
          <p>{label}</p>
        </span>
      </div>
      <div className="text-xl font-semibold">
        <p>{value}</p>
      </div>
    </div>
  );
}

export function DepartmentPanel({
  department: collegeName,
  year,
  onClose,
  yearCollegeIndex,
  isTotal = false,
}) {
  const [tab, setTab] = React.useState("budget");

  // Pull people for this (year, college) from the prebuilt index
  const peopleThisYear = React.useMemo(() => {
    const byYear = yearCollegeIndex?.get(Number(year));
    if (!byYear) return [];

    if (isTotal) {
      // All colleges combined for this year
      const arr = [];
      for (const list of byYear.values()) {
        if (Array.isArray(list)) arr.push(...list);
      }
      return arr;
    }

    const arr = byYear.get(collegeName) || [];
    return Array.isArray(arr) ? [...arr] : [];
  }, [year, collegeName, yearCollegeIndex, isTotal]);

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
    let budget = 0;
    let yearlyData = [];

    if (isTotal) {
      // Aggregate budgets across all colleges
      const byYear = new Map();
      for (const c of colleges) {
        for (const b of c.Budgets || []) {
          const y = Number(b.Year);
          const curr = byYear.get(y) || 0;
          byYear.set(y, curr + Number(b.Budget || 0));
        }
      }
      yearlyData = Array.from(byYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([y, val]) => ({ year: y, budget: val }));

      budget =
        yearlyData.find((d) => Number(d.year) === Number(year))?.budget ?? 0;
    } else {
      // College-specific budgets
      const col = colleges.find((c) => c.College === collegeName);
      budget =
        col?.Budgets?.find((b) => Number(b.Year) === Number(year))?.Budget ??
        0;

      yearlyData = (col?.Budgets ?? [])
        .slice()
        .sort((a, b) => Number(a.Year) - Number(b.Year))
        .map((r) => ({ year: r.Year, budget: r.Budget }));
    }

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

    const topSalary = topEarners[0]?.salary ?? 0;

    return { budget, employeesCount, avgSalary, topEarners, yearlyData, topSalary };
  }, [collegeName, year, peopleCombined, isTotal]);


  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {isTotal ? "Total University" : collegeName}
          </h2>
          <p className="text-sm">
            Budget in <span className="font-medium">{year}</span>: {d3.format("$,.0f")(stats.budget)}
          </p>
          
        </div>

        {/* Only show close button for college-specific views */}
        {!isTotal && (
          <button onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        )}
      </div>

      {/* Tabs */}
      {!isTotal && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab("budget")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            Budget Over Years
          </button>
          <button
            onClick={() => setTab("hist")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            Salary Distribution in <span className="font-medium">{year}</span>
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white border rounded-lg p-4 mb-4 min-h-[300px]">
        {/* For total university: always show budget chart, no histogram */}
        {isTotal || tab === "budget" ? (
          <BarChart
            data={stats.yearlyData.map((d) => ({
              year: d.year,
              value: d.budget,
            }))}
            xKey="year"
            yKey="value"
            height={260}
            yTickFormat={formatBudget}
            tooltipFormat={(d) => `${d.year}: ${formatBudget(d.value)}`}
            ariaLabel={
              isTotal
                ? "Total university budget over time"
                : `Budget trend for ${collegeName}`
            }
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
        <StatCard
          label={`Avg Salary (${year})`}
          value={d3.format("$.2s")(stats.avgSalary)}
        />
        <StatCard
          label={`Employees (${year})`}
          value={stats.employeesCount}
        />
        <StatCard
          label={`Top Salary (${year})`}
          value={d3.format("$.2s")(stats.topSalary)}
        />
      </div>

      {isTotal && (
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-xs mt-1">
              Click on the budget-flow graph to see college-specific breakdowns!
            </h2>
          </div>
          )}

      {/* Top earners list */}
      {!isTotal && (
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">
            Top earners in {year}
          </h3>
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
                <div className="font-semibold">
                  {d3.format("$.3s")(p.salary)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
