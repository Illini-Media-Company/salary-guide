import React from "react";
import * as d3 from "d3";
import employees from "../data/UIUC_salaries.json";

import { BarChart } from "./BarChart";
import {X} from "lucide-react";

export function PersonPanel({ person, onClose, tableYear }) {
  if (!person) return null;

  // Find the real record in employees.json
  const match = React.useMemo(() => {
    const name = `${person.firstName} ${person.lastName}`.trim().toLowerCase();
    return employees.find((e) => e.name.trim().toLowerCase() === name);
  }, [person]);

  // Full history (keep zeros)
  const salaryHistory = React.useMemo(() => {
    return match.salaries
      .map((s) => ({ year: Number(s.year), salary: Number(s.salary ?? 0), positions: s.positions || [] }))
      .sort((a, b) => a.year - b.year);
  }, [match]);

  // Get the record for the selected table year (or fallback to latest)
  const selectedYearRecord = React.useMemo(() => {
    if (!salaryHistory.length) return null;
    if (tableYear) {
      const rec = salaryHistory.find((r) => r.year === Number(tableYear));
      if (rec) return rec;
    }
    return salaryHistory.at(-1); // fallback to most recent
  }, [salaryHistory, tableYear]);

  const positionsForYear = selectedYearRecord?.positions ?? [];
  const departmentsForYear = Array.from(new Set(positionsForYear.map((p) => p.department))).filter(Boolean);
  const recordedSalaryForYear = selectedYearRecord?.salary ?? 0;

  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">
            {match?.name || `${person.firstName} ${person.lastName}`}
          </h3>
          {positionsForYear.length > 0 && (
            <p className="text-sm">
              {positionsForYear.map((p) => p.title).join(", ")}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close person">
          <X size={20} />
        </button>
      </div>

      {/* Salary + meta for the selected year */}
      <div className="space-y-2 mb-4">
        <div className="text-sm">
          <strong>Recorded Salary ({selectedYearRecord?.year ?? "—"}):</strong>{" "}
          {d3.format("$,.0f")(recordedSalaryForYear)}
        </div>
        <div className="text-sm">
          <strong>Departments ({selectedYearRecord?.year ?? "—"}):</strong>{" "}
          {departmentsForYear.length ? departmentsForYear.join(", ") : "—"}
        </div>
      </div>

      <h4 className="text-sm font-semibold mb-2">Salary History</h4>
      <BarChart
        data={salaryHistory}             // [{year, salary, positions?}]
        xKey="year"
        yKey="salary"
        height={200}
        yTickFormat={d3.format("$.2s")}
        tooltipFormat={(d) => `${d.year}: ${d3.format("$.3s")(d.salary)}`}
        ariaLabel={`Salary history for ${match?.name}`}
      />

      <h4 className="text-sm font-semibold mt-4 mb-2">
        Positions ({selectedYearRecord?.year ?? "—"})
      </h4>
      {positionsForYear.length === 0 ? (
        <div className="text-sm">No positions recorded.</div>
      ) : (
        positionsForYear.map((p, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded-lg mb-2">
            <div className="font-medium">{p.title}</div>
            <div className="text-sm">{p.department}</div>
            <div className="text-xs">
              {p.college} • ${d3.format(",.0f")(Number(p.positionSalary ?? 0))} • {p.tenure || "N/A"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}