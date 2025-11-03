import { useState, useRef, useEffect } from "react";

export const toNum = (v) => (v == null ? 0 : Number(v));

// Return the salary for a person in a given year.
// Uses top-level `salary` if present; otherwise sums `positions[].positionSalary`.
export function getSalaryForYear(emp, year) {
  const y = Number(year);
  const rec = (emp?.salaries || []).find((s) => Number(s.year) === y);
  if (!rec) return 0;

  const top = toNum(rec.salary);
  if (top > 0) return top;

  const sum = (rec.positions || []).reduce(
    (acc, p) => acc + toNum(p.positionSalary),
    0
  );
  return sum;
}

// Get all positions for a given year; returns [] if none
export function getPositionsForYear(emp, year) {
  const y = Number(year);
  const rec = (emp?.salaries || []).find((s) => Number(s.year) === y);
  return rec?.positions || [];
}

// Choose a "primary" org from a set of positions (prefers paid positions)
export function pickPrimaryOrg(positions) {
  if (!positions?.length) return { department: "—", college: "—", title: "—" };
  const withPay = positions.filter((p) => toNum(p.positionSalary) > 0);
  const chosen = withPay[0] || positions[0];
  return {
    department: chosen.department || chosen.college || "—",
    college: chosen.college || "—",
    title: chosen.title || "—",
  };
}

// Split "First Last [etc]" → naive first/last for table display
export function splitName(full) {
  if (!full) return { firstName: "", lastName: "" };
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop();
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

export function makeYearCollegeIndex(employees) {
  const idx = new Map();
  for (const e of employees || []) {
    const personName = e.name || e.Name; // tolerate both, just in case
    for (const s of e.salaries || e.Salaries || []) {
      const y = Number(s.year || s.Year);
      if (!idx.has(y)) idx.set(y, new Map());
      const byCollege = idx.get(y);
      for (const p of s.positions || s.Positions || []) {
        const college = p.college || p.College;
        const pay = toNum(p.positionSalary ?? p.PositionSalary);
        if (!college || pay <= 0) continue;
        if (!byCollege.has(college)) byCollege.set(college, []);
        byCollege.get(college).push({
          name: personName,
          title: p.title || p.Title || "—",
          salary: pay,
        });
      }
    }
  }
  return idx;
}


export function useResizeObserver() {
  const ref = useRef(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBounds({ width, height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, bounds];
}

