import React from "react";
import * as d3 from "d3";
import { X } from "lucide-react";

import { BarChart } from "./BarChart";
import { YEARS, CAMPUSES } from "../utils";

async function fetchPersonHistory(personName, campus) {
  const normalizedName = personName.trim().toLowerCase();

  // Fetch each year in parallel
  const results = await Promise.all(
    YEARS.map(async (year) => {
      try {
        const response = await fetch(`/salary-guide/data/${year}/${campus}.json`);
        if (!response.ok) return null;
        
        const employees = await response.json();
        const match = employees.find(
          (e) => e.name?.trim().toLowerCase() === normalizedName
        );
        
        if (match) {
          return {
            year,
            salary: Number(match.salary ?? 0),
            positions: match.positions || [],
          };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r) => r !== null)
    .sort((a, b) => a.year - b.year);
}


async function fetchPersonAllCampuses(personName, year) {
  const normalizedName = personName.trim().toLowerCase();

  const results = await Promise.all(
    CAMPUSES.map(async (campus) => {
      try {
        const response = await fetch(`/salary-guide/data/${year}/${campus}.json`);
        if (!response.ok) return null;
        
        const employees = await response.json();
        const match = employees.find(
          (e) => e.name?.trim().toLowerCase() === normalizedName
        );
        
        if (match) {
          return {
            campus,
            salary: Number(match.salary ?? 0),
            positions: (match.positions || []).map(p => ({
              ...p,
              campus: p.campus || campus, // ensure campus is set
            })),
          };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  return results.filter((r) => r !== null);
}

export function PersonPanel({ person, onClose, tableYear }) {
  if (!person) return null;

  const fullName = `${person.firstName} ${person.lastName}`.trim();
  const primaryCampus = person.campus || "UIUC";

  const [salaryHistory, setSalaryHistory] = React.useState(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const [allCampusData, setAllCampusData] = React.useState(null);
  const [allCampusLoading, setAllCampusLoading] = React.useState(false);

  // Fetch salary history when person changes
  React.useEffect(() => {
    let cancelled = false;
    
    async function loadHistory() {
      setHistoryLoading(true);
      setSalaryHistory(null);
      
      try {
        const history = await fetchPersonHistory(fullName, primaryCampus);
        if (!cancelled) {
          setSalaryHistory(history);
        }
      } catch (err) {
        console.error("Failed to load salary history:", err);
        if (!cancelled) {
          setSalaryHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [fullName, primaryCampus]);

  // Fetch all-campus data when person or year changes
  React.useEffect(() => {
    let cancelled = false;
    
    async function loadAllCampuses() {
      setAllCampusLoading(true);
      setAllCampusData(null);
      
      try {
        const data = await fetchPersonAllCampuses(fullName, tableYear);
        if (!cancelled) {
          setAllCampusData(data);
        }
      } catch (err) {
        console.error("Failed to load all-campus data:", err);
        if (!cancelled) {
          setAllCampusData([]);
        }
      } finally {
        if (!cancelled) {
          setAllCampusLoading(false);
        }
      }
    }

    loadAllCampuses();

    return () => {
      cancelled = true;
    };
  }, [fullName, tableYear]);

  const allPositionsForYear = React.useMemo(() => {
    if (!allCampusData) return person._emp?.positions || [];
    
    const positions = [];
    for (const campusData of allCampusData) {
      positions.push(...campusData.positions);
    }
    return positions;
  }, [allCampusData, person]);

  const departmentsForYear = React.useMemo(() => 
    Array.from(new Set(allPositionsForYear.map((p) => p.department))).filter(Boolean),
    [allPositionsForYear]
  );

  const campusesForYear = React.useMemo(() =>
    Array.from(new Set(allPositionsForYear.map((p) => p.campus))).filter(Boolean),
    [allPositionsForYear]
  );

  const totalSalaryForYear = React.useMemo(() => {
    if (!allCampusData || allCampusData.length === 0) return person.salary ?? 0;
    return Math.max(...allCampusData.map(d => d.salary));
  }, [allCampusData, person]);

  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">{fullName}</h3>
          {allPositionsForYear.length > 0 && (
            <p className="text-sm text-slate-600">
              {[...new Set(allPositionsForYear.map((p) => p.title))].join(", ")}
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
          <strong>Salary ({tableYear}):</strong>{" "}
          {d3.format("$,.0f")(totalSalaryForYear)}
        </div>
        <div className="text-sm">
          <strong>Departments ({tableYear}):</strong>{" "}
          {allCampusLoading ? (
            <span className="text-slate-400">loading...</span>
          ) : departmentsForYear.length ? (
            departmentsForYear.join(", ")
          ) : (
            "—"
          )}
        </div>
        <div className="text-sm">
          <strong>Campus{campusesForYear.length > 1 ? "es" : ""} ({tableYear}):</strong>{" "}
          {allCampusLoading ? (
            <span className="text-slate-400">loading...</span>
          ) : campusesForYear.length ? (
            campusesForYear.join(", ")
          ) : (
            primaryCampus
          )}
        </div>
      </div>

      {/* Salary History */}
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold">Salary History</h4>
        {historyLoading && (
          <span className="text-xs text-slate-400">(loading...)</span>
        )}
      </div>
      
      {historyLoading ? (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
          Loading salary history...
        </div>
      ) : salaryHistory && salaryHistory.length > 0 ? (
        <BarChart
          data={salaryHistory}
          xKey="year"
          yKey="salary"
          height={200}
          yTickFormat={d3.format("$.2s")}
          tooltipFormat={(d) => `${d.year}: ${d3.format("$.3s")(d.salary)}`}
          ariaLabel={`Salary history for ${fullName}`}
        />
      ) : (
        <div className="text-sm text-slate-500 py-4">
          No salary history available.
        </div>
      )}

      {/* Positions for current year - all campuses */}
      <div className="flex items-center gap-2 mt-4 mb-2">
        <h4 className="text-sm font-semibold">Positions ({tableYear})</h4>
        {allCampusLoading && (
          <span className="text-xs text-slate-400">(loading...)</span>
        )}
      </div>
      
      {allCampusLoading ? (
        <div className="text-sm text-slate-400 py-2">Loading positions...</div>
      ) : allPositionsForYear.length === 0 ? (
        <div className="text-sm text-slate-500">No positions recorded.</div>
      ) : (
        allPositionsForYear.map((p, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded-lg mb-2">
            <div className="font-medium">{p.title}</div>
            <div className="text-sm text-slate-600">{p.department}</div>
            <div className="text-xs text-slate-500">
              {p.campus} • {p.college} •{" "}
              {d3.format("$,.0f")(Number(p.positionSalary ?? 0))}
              {p.tenure ? ` • ${p.tenure}` : ""}
            </div>
          </div>
        ))
      )}
    </div>
  );
}