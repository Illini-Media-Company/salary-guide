import React from "react";
import * as d3 from "d3";

import { BarChart } from "./BarChart";
import { Histogram } from "./Histogram";
import { X } from "lucide-react";
import {fetchPrevYearEmployeeCount} from "../utils"

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
  yearCollegeCampusIndex,
  isTotal = false,
  campus,
  budgetData,
}) {
  const [tab, setTab] = React.useState("budget");
  const [prevYearEmployeeCount, setPrevYearEmployeeCount] = React.useState(null);

  // Fetch previous year's employee count for YoY calculation
  React.useEffect(() => {
    let cancelled = false;

    async function loadPrevYearData() {
      setPrevYearEmployeeCount(null);
      const count = await fetchPrevYearEmployeeCount(year, campus, collegeName, isTotal);
      if (!cancelled) {
        setPrevYearEmployeeCount(count);
      }
    }

    loadPrevYearData();

    return () => {
      cancelled = true;
    };
  }, [year, campus, collegeName, isTotal]);

  // Use the passed budget data for this campus
  const colleges = React.useMemo(
    () => budgetData || [],
    [budgetData]
  );

  // 1) Pull people for this (year, campus, college) from the index
  const peopleThisYear = React.useMemo(() => {
    const byYear = yearCollegeCampusIndex?.get(Number(year)) || yearCollegeCampusIndex?.get(String(year));
    if (!byYear) return [];

    if (isTotal) {
      // Total: all campus|college combos that match this campus or UI System
      const arr = [];
      for (const [key, list] of byYear.entries()) {
        const [keyCampus] = key.split("|");
        if (campus === "UI System" || keyCampus === campus) {
          if (Array.isArray(list)) arr.push(...list);
        }
      }
      return arr;
    }

    // College-specific: campus|college composite key
    const compositeKey = `${campus}|${collegeName}`;
    const arr = byYear.get(compositeKey) || [];
    return Array.isArray(arr) ? [...arr] : [];
  }, [year, collegeName, campus, isTotal, yearCollegeCampusIndex]);

  // 2) Consolidate multiple entries per person
  //    For department view: use collegeSalary (sum of positions in this college)
  //    For total view: use collegeSalary summed across all their college appearances
  const peopleCombined = React.useMemo(() => {
    const map = new Map();

    for (const p of peopleThisYear) {
      const key = p.name || "Unknown";
      const existing = map.get(key) || {
        name: key,
        collegeSalary: 0,  // salary from positions in this college/these colleges
        totalSalary: 0,    // total salary across all positions
        positions: new Set(),
      };

      // Use collegeSalary (department-specific) instead of totalSalary
      const collegeSalaryVal = Number(p.collegeSalary || 0);
      existing.collegeSalary += collegeSalaryVal;

      // Keep track of total salary (max, since same person may appear multiple times)
      const totalSalaryVal = Number(p.totalSalary || 0);
      if (totalSalaryVal > existing.totalSalary) {
        existing.totalSalary = totalSalaryVal;
      }

      if (Array.isArray(p.titles)) {
        for (const t of p.titles) {
          if (t) existing.positions.add(t);
        }
      } else if (p.title) {
        existing.positions.add(p.title);
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).map((p) => ({
      ...p,
      positions: Array.from(p.positions),
    }));
  }, [peopleThisYear]);

  // 3) Salary values for histogram - use collegeSalary (department-specific)
  const salaryValues = React.useMemo(
    () => peopleCombined.map((p) => p.collegeSalary ?? 0).filter(s => s > 0),
    [peopleCombined]
  );

  // 4) Compute stats + budget series
  const stats = React.useMemo(() => {
    let budget = 0;
    let prevBudget = 0;
    let yearlyData = [];

    const currentYear = Number(year);
    const prevYear = currentYear - 1;

    if (isTotal) {
      // Aggregate budgets across all colleges for this campus (or system)
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

      budget = byYear.get(currentYear) ?? 0;
      prevBudget = byYear.get(prevYear) ?? 0;
    } else {
      // College-specific budgets
      const col = colleges.find((c) => c.College === collegeName);
      budget =
        col?.Budgets?.find((b) => Number(b.Year) === currentYear)?.Budget ?? 0;
      prevBudget =
        col?.Budgets?.find((b) => Number(b.Year) === prevYear)?.Budget ?? 0;

      yearlyData = (col?.Budgets ?? [])
        .slice()
        .sort((a, b) => Number(a.Year) - Number(b.Year))
        .map((r) => ({ year: r.Year, budget: r.Budget }));
    }

    const employeesCount = peopleCombined.length;

    // Use collegeSalary for calculations (department-specific portion)
    const salaries = peopleCombined
      .map((p) => p.collegeSalary || 0)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);

    const totalCollegeSalary = salaries.reduce((sum, s) => sum + s, 0);
    
    const avgSalary = salaries.length
      ? Math.round(totalCollegeSalary / salaries.length)
      : 0;

    // Median salary
    let medianSalary = 0;
    if (salaries.length > 0) {
      const mid = Math.floor(salaries.length / 2);
      medianSalary = salaries.length % 2 === 0
        ? Math.round((salaries[mid - 1] + salaries[mid]) / 2)
        : salaries[mid];
    }

    // Top earners by collegeSalary (what they earn from THIS department)
    const topEarners = [...peopleCombined]
      .sort((a, b) => (b.collegeSalary || 0) - (a.collegeSalary || 0))
      .slice(0, 3)
      .map((e) => ({
        name: e.name,
        position: e.positions.join(", ") || "—",
        collegeSalary: e.collegeSalary || 0,
        totalSalary: e.totalSalary || 0,
      }));

    const topSalary = topEarners[0]?.collegeSalary ?? 0;

    // YoY budget/department percentage increase
    let budgetYoY = null;
    if (prevBudget > 0 && budget > 0) {
      budgetYoY = ((budget - prevBudget) / prevBudget) * 100;
    }

    // YoY employee count increase
    let employeeYoY = null;
    if (prevYearEmployeeCount !== null && prevYearEmployeeCount > 0 && employeesCount > 0) {
      employeeYoY = ((employeesCount - prevYearEmployeeCount) / prevYearEmployeeCount) * 100;
    }

    return {
      budget,
      prevBudget,
      employeesCount,
      avgSalary,
      medianSalary,
      topEarners,
      yearlyData,
      topSalary,
      budgetYoY,
      employeeYoY,
    };
  }, [collegeName, year, peopleCombined, isTotal, colleges, prevYearEmployeeCount]);

  const isDataMissing =
    !isTotal && (stats.yearlyData.length === 0 || stats.budget === 0);

  if (isDataMissing) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50 border border-red-300 rounded-lg shadow-inner">
        <X size={32} className="text-orange-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
          Data Unavailable
        </h2>
        <p className="text-md text-gray-600 text-center">
          The budget and salary data for <b>{collegeName}</b> in <b>{year}</b>{" "}
          could not be found in <b>{campus}</b>. This often happens when
          department names change over time.
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="mt-6 px-4 py-2 bg-blue-500 text-gray-800 rounded-lg shadow hover:bg-blue-600 transition duration-150"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {isTotal ? `Total Budget for ${campus}` : collegeName}
          </h2>
          <p className="text-sm">
            Budget in <span className="font-medium">{year}</span>:{" "}
            {d3.format("$,.0f")(stats.budget)}
          </p>
        </div>

        {!isTotal && (
          <button onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        )}
      </div>

      {/* Tabs (no histogram for total) */}
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

      {/* Summary cards*/}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <StatCard
          label={`Avg Salary (${year})`}
          value={d3.format("$.3s")(stats.avgSalary)}
        />
        <StatCard
          label={`Employee Count (${year})`}
          value={stats.employeesCount}
        />
        <StatCard
          label={`Top Salary (${year})`}
          value={d3.format("$.3s")(stats.topSalary)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard
          label={`Median Salary (${year})`}
          value={stats.medianSalary > 0 ? d3.format("$.3s")(stats.medianSalary) : "—"}
        />
        <StatCard
          label="Employee Count YoY"
          value={
            stats.employeeYoY !== null
              ? `${stats.employeeYoY >= 0 ? "+" : ""}${stats.employeeYoY.toFixed(1)}%`
              : "—"
          }
        />
        <StatCard
          label="Total Budget Change YoY"
          value={
            stats.budgetYoY !== null
              ? `${stats.budgetYoY >= 0 ? "+" : ""}${stats.budgetYoY.toFixed(1)}%`
              : "—"
          }
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
                  <div className="text-sm text-slate-600">{p.position}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {d3.format("$.3s")(p.collegeSalary)}
                  </div>
                  {p.totalSalary > p.collegeSalary && (
                    <div className="text-xs text-slate-500">
                      Total: {d3.format("$.3s")(p.totalSalary)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}