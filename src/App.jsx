import React from "react";
import * as d3 from "d3";
import { Search } from "lucide-react";

import {
  CAMPUSES,
  YEARS,
  useSalaryData,
  getSalary,
  getPositions,
  pickPrimaryOrg,
  splitName,
  makeCollegeCampusIndex,
} from "./utils";

import { SortHeader } from "./components/SortHeader";
import { SankeyBudget } from "./components/SankeyBudget";
import { DepartmentPanel } from "./components/DepartmentPanel";
import { PersonPanel } from "./components/PersonPanel";

export default function SalaryVisualization() {
  // Selection state
  const [selectedDepartment, setSelectedDepartment] = React.useState(null);
  const [selectedPerson, setSelectedPerson] = React.useState(null);

  // Budget data (loaded once)
  const [budgetDataMap, setBudgetDataMap] = React.useState(new Map());
  const [budgetLoading, setBudgetLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadBudgets() {
      try {
        const [uiuc, uic, uis, system] = await Promise.all([
          fetch("/salary-guide/data/UIUC_budget.json").then((r) => r.json()),
          fetch("/salary-guide/data/UIC_budget.json").then((r) => r.json()),
          fetch("/salary-guide/data/UIS_budget.json").then((r) => r.json()),
          fetch("/salary-guide/data/System_budget.json").then((r) => r.json()),
        ]);
        setBudgetDataMap(
          new Map([
            ["UIUC", uiuc],
            ["UIC", uic],
            ["UIS", uis],
            ["UI System", system],
          ])
        );
      } catch (err) {
        console.error("Failed to load budget data:", err);
      } finally {
        setBudgetLoading(false);
      }
    }
    loadBudgets();
  }, []);

  // SANKEY PANEL: campus + year selection
  const [sankeyCampus, setSankeyCampus] = React.useState("UIUC");
  const [sankeyYear, setSankeyYear] = React.useState(YEARS[YEARS.length - 1]);

  // Reset department when campus changes
  React.useEffect(() => {
    setSelectedDepartment(null);
  }, [sankeyCampus]);

  const sankeyAvailableYears = React.useMemo(() => {
    const budgetData = budgetDataMap.get(sankeyCampus) || [];
    if (!budgetData.length) return YEARS.map(String);
    const years = new Set();
    budgetData.forEach((c) => c.Budgets.forEach((b) => years.add(String(b.Year))));
    return Array.from(years).sort();
  }, [sankeyCampus, budgetDataMap]);

  React.useEffect(() => {
    if (sankeyAvailableYears.length > 0 && !sankeyAvailableYears.includes(sankeyYear)) {
      setSankeyYear(sankeyAvailableYears[sankeyAvailableYears.length - 1]);
    }
  }, [sankeyAvailableYears, sankeyYear]);

  const {
    data: sankeyEmployees,
    loading: sankeyLoading,
    error: sankeyError,
  } = useSalaryData(sankeyYear, sankeyCampus);

  // runs only when data changes, loading a single campus+year data file at a time
  const yearCollegeCampusIndex = React.useMemo(() => {
    const idx = new Map();
    idx.set(sankeyYear, makeCollegeCampusIndex(sankeyEmployees));
    return idx;
  }, [sankeyEmployees, sankeyYear]);

  // LOOKUP TABLE: independent campus + year selection
  const [tableCampus, setTableCampus] = React.useState("UIUC");
  const [tableYear, setTableYear] = React.useState(YEARS[YEARS.length - 1]);

  const {
    data: tableEmployees,
    loading: tableLoading,
    error: tableError,
  } = useSalaryData(tableYear, tableCampus);

  const [search, setSearch] = React.useState({
    firstName: "",
    lastName: "",
    department: "",
  });

  const [sortBy, setSortBy] = React.useState("salary");
  const [sortDir, setSortDir] = React.useState("desc");

  const [page, setPage] = React.useState(1);
  const pageSize = 5;

  React.useEffect(() => {
    setSearch({ firstName: "", lastName: "", department: "" });
    setSelectedPerson(null);
    setPage(1);
  }, [tableCampus, tableYear]);

  const staffRows = React.useMemo(() => {
    return tableEmployees.map((emp, idx) => {
      const { firstName, lastName } = splitName(emp.name);
      const positions = getPositions(emp);
      const { department, college, title, campus } = pickPrimaryOrg(positions);
      const salary = getSalary(emp);

      return {
        id: idx,
        firstName,
        lastName,
        campus: campus || tableCampus,
        department,
        college,
        position: title,
        salary,
        _fullName: emp.name,
        _emp: emp,
      };
    });
  }, [tableEmployees, tableCampus]);

  const departments = React.useMemo(
    () => Array.from(new Set(staffRows.map((d) => d.department))).sort(),
    [staffRows]
  );

  const filtered = React.useMemo(() => {
    const f = (s) => s.toLowerCase();
    return staffRows.filter(
      (p) =>
        p.firstName.toLowerCase().includes(f(search.firstName)) &&
        p.lastName.toLowerCase().includes(f(search.lastName)) &&
        (!search.department || p.department === search.department)
    );
  }, [staffRows, search]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortBy === "salary") {
        return sortDir === "asc" ? a.salary - b.salary : b.salary - a.salary;
      } else {
        const an = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bn = `${b.lastName} ${b.firstName}`.toLowerCase();
        return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      }
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [sorted.length, totalPages, page]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  const resetPage = () => setPage(1);

  function buildBudgetGraphForYear(year) {
    const budgetData = budgetDataMap.get(sankeyCampus) || [];

    const entries = budgetData.map((c) => {
      const row = c.Budgets.find((b) => b.Year === year);
      return { name: c.College, value: row ? row.Budget : 0 };
    });

    const validEntries = entries.filter((e) => e.value && e.value > 0);
    validEntries.sort((a, b) => b.value - a.value);

    const nodes = [
      { name: "University Budget" },
      ...validEntries.map((e) => ({ name: e.name })),
    ];

    const links = validEntries.map((e, i) => ({
      source: 0,
      target: i + 1,
      value: e.value,
    }));

    return { nodes, links };
  }

  return (
    <div className="w-full h-full min-h-screen p-6">
      {/* Top: Sankey + Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sankey card */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-slate-900">
              Salary Budget by Department
            </h2>

            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-slate-600">Campus</span>
                <select
                  value={sankeyCampus}
                  onChange={(e) => setSankeyCampus(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-slate-600">Year</span>
                <select
                  value={sankeyYear}
                  onChange={(e) => setSankeyYear((e.target.value))}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  {sankeyAvailableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {sankeyLoading || budgetLoading ? (
            <div className="h-[500px] flex items-center justify-center text-slate-500">
              Loading data...
            </div>
          ) : sankeyError ? (
            <div className="h-[500px] flex items-center justify-center text-red-500">
              Error loading data
            </div>
          ) : (
            <SankeyBudget
              data={buildBudgetGraphForYear(sankeyYear)}
              selectedDept={selectedDepartment}
              onNodeClick={setSelectedDepartment}
              year={sankeyYear}
            />
          )}
        </div>

        {/* Department details */}
        <div className="bg-white rounded-xl shadow-sm border p-4 min-h-[620px]">
          {sankeyLoading || budgetLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Loading...
            </div>
          ) : (
            <DepartmentPanel
              department={selectedDepartment || "Total University"}
              year={sankeyYear}
              onClose={selectedDepartment ? () => setSelectedDepartment(null) : undefined}
              yearCollegeCampusIndex={yearCollegeCampusIndex}
              isTotal={!selectedDepartment}
              campus={sankeyCampus}
              budgetData={budgetDataMap.get(sankeyCampus) || []}
            />
          )}
        </div>
      </div>

      {/* Bottom: People Search */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-semibold text-slate-900">
            Search Individuals
          </h2>

          {/* Campus + Year selectors */}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Campus</span>
              <select
                value={tableCampus}
                onChange={(e) => setTableCampus(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm font-medium"
              >
                {CAMPUSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Year</span>
              <select
                value={tableYear}
                onChange={(e) => setTableYear(Number(e.target.value))}
                className="border rounded-md px-2 py-1 text-sm font-medium"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Text filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <input
            type="text"
            placeholder="First Name"
            value={search.firstName}
            onChange={(e) => {
              setSearch((s) => ({ ...s, firstName: e.target.value }));
              resetPage();
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="text"
            placeholder="Last Name"
            value={search.lastName}
            onChange={(e) => {
              setSearch((s) => ({ ...s, lastName: e.target.value }));
              resetPage();
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={search.department}
            onChange={(e) => {
              setSearch((s) => ({ ...s, department: e.target.value }));
              resetPage();
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Loading / Error states */}
        {tableLoading && (
          <div className="text-center py-8 text-slate-500">
            Loading {tableCampus} {tableYear} data...
          </div>
        )}

        {tableError && (
          <div className="text-center py-8 text-red-500">
            Error loading data for {tableCampus} {tableYear}
          </div>
        )}

        {/* Results + Person detail */}
        {!tableLoading && !tableError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table column */}
            <div className="min-w-0">
              <div
                className="border rounded-lg overflow-y-auto"
                style={{ height: 44 + pageSize * 64 }}
              >
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[70%]" />
                    <col className="w-[30%]" />
                  </colgroup>

                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="h-11">
                      <th className="px-4 text-left align-middle">
                        <SortHeader
                          label="Name"
                          active={sortBy === "name"}
                          dir={sortDir}
                          onClick={() => {
                            if (sortBy === "name")
                              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            else {
                              setSortBy("name");
                              setSortDir("asc");
                            }
                            resetPage();
                          }}
                        />
                      </th>
                      <th className="px-4 text-right align-middle">
                        <SortHeader
                          label="Salary"
                          active={sortBy === "salary"}
                          dir={sortDir}
                          onClick={() => {
                            if (sortBy === "salary")
                              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            else {
                              setSortBy("salary");
                              setSortDir("desc");
                            }
                            resetPage();
                          }}
                          alignRight
                        />
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageRows.map((p) => (
                      <tr
                        key={p.id}
                        className={`h-16 cursor-pointer hover:bg-orange-300 ${
                          selectedPerson?.id === p.id ? "bg-orange-400" : ""
                        }`}
                        onClick={() => setSelectedPerson(p)}
                      >
                        <td className="px-4 align-middle">
                          <div className="font-medium truncate">
                            {p.firstName} {p.lastName}
                          </div>
                          <div className="text-sm text-slate-500 truncate">
                            {p.department}
                          </div>
                        </td>
                        <td className="px-4 text-right font-medium align-middle">
                          {d3.format("$.3s")(p.salary)}
                        </td>
                      </tr>
                    ))}

                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                          No results found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="text-slate-600">
                  {sorted.length > 0 ? (
                    <>
                      Page <span className="font-semibold">{page}</span> of{" "}
                      <span className="font-semibold">{totalPages}</span>
                      <span className="ml-2 text-slate-400">
                        ({sorted.length.toLocaleString()} results)
                      </span>
                    </>
                  ) : (
                    "No results"
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 border rounded disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    className="px-2 py-1 border rounded disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Person details column */}
            <div className="min-w-0">
              {selectedPerson ? (
                <PersonPanel
                  person={selectedPerson}
                  onClose={() => setSelectedPerson(null)}
                  tableYear={tableYear}
                />
              ) : (
                <div className="h-full min-h-[260px] grid place-items-center rounded-lg border-2 border-dashed">
                  <div className="text-center text-slate-500">
                    <Search size={44} className="mx-auto mb-2 opacity-60" />
                    <p>Select a person to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}