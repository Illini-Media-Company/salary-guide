import { useState, useRef, useEffect } from "react";

export const toNum = (v) => (v == null ? 0 : Number(v));

export const CAMPUSES = ["UIUC", "UIC", "UIS", "UI System"];
export const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i); // THIS NEEDS TO CHANGE WHEN NEW DATA IS ADDED

export async function loadSalaryData(year, campus) {
  try {
    const url = `${import.meta.env.BASE_URL}/data/${year}/${campus}.json`;
    
    console.log(`Fetching salary data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Loaded ${data?.length || 0} employees from ${url}`);
    return data;
  } catch (error) {
    console.error(`Failed to load salary data for ${year}/${campus}:`, error);
    return [];
  }
}

export function useSalaryData(year, campus) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setData([]);
      setLoading(true);
      setError(null);

      try {
        const result = await loadSalaryData(year, campus);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (year && campus) {
      fetchData();
    } else {
      setData([]);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [year, campus]);

  return { data, loading, error };
}

export function getSalary(emp) {
  if (!emp) return 0;

  const top = toNum(emp.salary);
  if (top > 0) return top;

  // Fallback: sum position salaries
  return (emp.positions || []).reduce(
    (acc, p) => acc + toNum(p.positionSalary),
    0
  );
}

export function getPositions(emp) {
  return emp?.positions || [];
}

export function pickPrimaryOrg(positions) {
  if (!positions?.length) {
    return { department: "—", college: "—", title: "—", campus: "—" };
  }

  const withPay = positions.filter((p) => toNum(p.positionSalary) > 0);
  const chosen = withPay[0] || positions[0];

  return {
    department: chosen.department || chosen.college || "—",
    college: chosen.college || "—",
    title: chosen.title || "—",
    campus: chosen.campus || "—",
  };
}

export function splitName(full) {
  if (!full) return { firstName: "", lastName: "" };

  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  const lastName = parts.pop();
  const firstName = parts.join(" ");
  return { firstName, lastName };
}


/**
 * Build an index keyed by "Campus|College" for loaded employee data.
 * Only call this on data that's already in memory.
 * 
 * Returns: Map<"Campus|College", Array<{ name, salary, titles[] }>>
 */
export function makeCollegeCampusIndex(employees) {
  const idx = new Map();

  for (const emp of employees || []) {
    const personName = emp.name;
    const totalSalary = getSalary(emp);

    if (totalSalary <= 0) continue;

    // Track unique Campus|College keys for this person
    const keysForPerson = new Map();

    for (const p of emp.positions || []) {
      const campus = p.campus;
      const college = p.college;
      if (!campus || !college) continue;

      const compositeKey = `${campus}|${college}`;

      let entry = keysForPerson.get(compositeKey);
      if (!entry) {
        entry = { titles: new Set() };
        keysForPerson.set(compositeKey, entry);
      }
      if (p.title) entry.titles.add(p.title);
    }

    for (const [compositeKey, { titles }] of keysForPerson.entries()) {
      if (!idx.has(compositeKey)) {
        idx.set(compositeKey, []);
      }

      idx.get(compositeKey).push({
        name: personName,
        salary: totalSalary,
        titles: Array.from(titles),
      });
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