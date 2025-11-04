import React from "react";
import * as d3 from "d3";
import colleges from "../data/budget.json";

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

  // Pull people for this (year, college) from the prebuilt index
  const peopleThisYear = React.useMemo(() => {
    const byYear = yearCollegeIndex?.get(Number(year));
    const arr = byYear?.get(collegeName) || [];
    // Defensive clone to avoid mutating the index
    return Array.isArray(arr) ? [...arr] : [];
  }, [year, collegeName, yearCollegeIndex]);

  // Salary values for histogram
  const salaryValues = React.useMemo(
    () => peopleThisYear.map(p => Number(p.salary ?? 0)), // include zero
    [peopleThisYear]
  );

  const stats = React.useMemo(() => {
    // 1) College budget that year (from colleges.json)
    const col = colleges.find((c) => c.College === collegeName);
    const budget = col?.Budgets?.find((b) => Number(b.Year) === Number(year))?.Budget ?? 0;

    // 2) Employees in this college (for that year)
    const employeesCount = peopleThisYear.length;

    // 3) Avg salary among those with salary
    const avgSalary = employeesCount
      ? Math.round(peopleThisYear.reduce((s, x) => s + (x.salary || 0), 0) / employeesCount)
      : 0;

    // 4) Top earners (already small array)
    const topEarners = [...peopleThisYear]
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .slice(0, 3)
      .map((e) => ({
        name: e.name,
        position: e.title || "—",
        salary: e.salary || 0,
      }));

    // 5) Budget trend (full series for the college)
    const yearlyData = (col?.Budgets ?? [])
      .slice()
      .sort((a, b) => Number(a.Year) - Number(b.Year))
      .map((r) => ({ year: r.Year, budget: r.Budget }));

    return { budget, employeesCount, avgSalary, topEarners, yearlyData };
  }, [collegeName, year, peopleThisYear]);

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

      {/* Chart card */}
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
        <StatCard label={`Top Salary (${year})`} value={d3.format("$.2s")(stats.topEarners?.[0]?.salary ?? 0)} />
      </div>

      {/* Top earners */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-2">Top earners in {year}</h3>
        <div className="space-y-2">
          {stats.topEarners.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
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
