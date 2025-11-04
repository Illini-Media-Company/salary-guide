import React from "react";
import * as d3 from "d3";
import employees from "../data/UIUC_salaries.json";

import { BarChart } from "./BarChart";

import {X} from "lucide-react";


export function PersonPanel({ person, onClose }) {
  if (!person) return null;

  // Find the real record in employees.json
  const match = React.useMemo(() => {
    const name = `${person.firstName} ${person.lastName}`.trim().toLowerCase();
    return employees.find(e => e.name.trim().toLowerCase() === name);
  }, [person]);

  const salaryHistory = React.useMemo(() => {
    if (!match?.salaries?.length)
      return [{ year: new Date().getFullYear(), salary: person.salary ?? 0 }];

    return match.salaries
      .map(s => ({ year: Number(s.year), salary: Number(s.salary ?? 0) }))  // keep zeros
      .sort((a, b) => a.year - b.year);
  }, [match, person]);

  const currentPositions = match?.salaries?.[match.salaries.length - 1]?.positions || [];

  return (
    <div className="bg-white rounded-lg border p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">{match?.name || `${person.firstName} ${person.lastName}`}</h3>
          {currentPositions.length > 0 && (
            <p className="text-sm">
              {currentPositions.map(p => p.title).join(", ")}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close person">
          <X size={20} />
        </button>
      </div>

      {/* Salary info */}
      <div className="space-y-2 mb-4">
        <div className="text-sm">
          <strong>Last Recorded Salary:</strong>{" "}
          {d3.format("$,.0f")(salaryHistory.at(-1)?.salary ?? 0)}
        </div>
        <div className="text-sm">
          <strong>Departments:</strong>{" "}
          {Array.from(new Set(currentPositions.map(p => p.department))).join(", ") || "—"}
        </div>
      </div>

      <h4 className="text-sm font-semibold mb-2">
        Salary History
      </h4>
      <BarChart
        data={salaryHistory}
        xKey="year"
        yKey="salary"
        height={200}
        yTickFormat={d3.format("$.2s")}
        tooltipFormat={(d) => `${d.year}: ${d3.format("$.3s")(d.salary)}`}
        ariaLabel={`Salary history for ${match?.name}`}
      />

      <h4 className="text-sm font-semibold mt-4 mb-2">
        Last Recorded Positions
      </h4>
      {currentPositions.map((p, i) => (
        <div key={i} className="p-3 bg-slate-50 rounded-lg mb-2">
          <div className="font-medium">{p.title}</div>
          <div className="text-sm ">{p.department}</div>
          <div className="text-xs">
            {p.college} • ${d3.format(",.0f")(p.positionSalary)} •{" "}
            {p.tenure || "N/A"}
          </div>
        </div>
      ))}
    </div>
  );
}