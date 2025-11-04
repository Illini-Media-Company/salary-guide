import React from "react";
import * as d3 from "d3";
import { Search, X } from "lucide-react";

import {makeYearCollegeIndex, getSalaryForYear, getPositionsForYear, pickPrimaryOrg, splitName  } from "./utils";

import {SortHeader} from "./components/SortHeader"
import { SankeyBudget } from "./components/SankeyBudget";
import { DepartmentPanel } from "./components/DepartmentPanel";
import { PersonPanel } from "./components/PersonPanel";

import colleges from "./data/budget.json";
import employees from "./data/UIUC_salaries.json";

// Union of all years in colleges.json
const allYears = Array.from(
  new Set(colleges.flatMap(c => c.Budgets.map(b => b.Year)))
).sort();

function buildBudgetGraphForYear(year) {
  // Extract each college’s budget for the given year
  const entries = colleges.map(c => {
    const row = c.Budgets.find(b => b.Year === year);
    return { name: c.College, value: row ? row.Budget : 0 };
  });

  // Filter out invalid or zero budgets
  const validEntries = entries.filter(e => e.value && e.value > 0);

  // Sort departments by descending budget
  validEntries.sort((a, b) => b.value - a.value);


  // Build Sankey structure
  const nodes = [
    { name: "University Budget" },
    ...validEntries.map(e => ({ name: e.name })),
  ];

  const links = validEntries.map((e, i) => ({
    source: 0,
    target: i + 1,
    value: e.value,
  }));

  return { nodes, links };
}

/* ---------------------------------- APP ---------------------------------- */

export default function SalaryVisualization() {
  // selection
  const [selectedDepartment, setSelectedDepartment] = React.useState(null);
  const [selectedPerson, setSelectedPerson] = React.useState(null);

  // year for Sankey + panel
  const defaultYear = allYears.at(-1);
  const [selectedYear, setSelectedYear] = React.useState(defaultYear);

  // year for the person salary table
  const [selectedTableYear, setSelectedTableYear] = React.useState(defaultYear);


  // search filters
  const [search, setSearch] = React.useState({
    firstName: "",
    lastName: "",
    campus: "",
    department: "",
  });

  // sorting (default salary desc)
  const [sortBy, setSortBy] = React.useState("salary"); // 'salary' | 'name'
  const [sortDir, setSortDir] = React.useState("desc"); // 'asc' | 'desc'

  // pagination
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  // Build year-aware table rows from employees.json
  const yearCollegeIndex = React.useMemo(() => makeYearCollegeIndex(employees), [employees]);


const staffRows = React.useMemo(() => {
  return employees
    .map((e, idx) => {
      const { firstName, lastName } = splitName(e.name);
      const positions = getPositionsForYear(e, selectedTableYear);
      const { department, college, title } = pickPrimaryOrg(positions);
      const salary = getSalaryForYear(e, selectedTableYear);

      return {
        id: idx + 1,
        firstName,
        lastName,
        campus: e.campus || "UIUC",
        department,
        college,
        position: title,
        salary,
        _fullName: e.name,
      };
    })
    .filter((e) => e.salary > 0); // hides ex-employees with no pay that year
}, [selectedTableYear]);

  // dropdown options
  const campuses = React.useMemo(
    () => Array.from(new Set(staffRows.map(d => d.campus))).sort(),
    [staffRows]
  );
  const departments = React.useMemo(
    () => Array.from(new Set(staffRows.map(d => d.department))).sort(),
    [staffRows]
  );


  // filter rows
  const filtered = React.useMemo(() => {
    const f = (s) => s.toLowerCase();
    return staffRows.filter(
      (p) =>
        p.firstName.toLowerCase().includes(f(search.firstName)) &&
        p.lastName.toLowerCase().includes(f(search.lastName)) &&
        (!search.campus || p.campus === search.campus) &&
        (!search.department || p.department === search.department)
    );
  }, [staffRows, search]);

  // sort rows
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

  // paginate rows
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  React.useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [sorted.length, totalPages]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  // UI
  return (
    <div className="w-full h-full min-h-screen p-6">
      {/* Top: Sankey + Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sankey card */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Salary Budget by Department</h2>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(+e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                {allYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SankeyBudget
            data={buildBudgetGraphForYear(selectedYear)}
            selectedDept={selectedDepartment}
            onNodeClick={setSelectedDepartment}
            year={selectedYear}
          />
        </div>

        {/* Department details */}
        <div className="bg-white rounded-xl shadow-sm border p-4 min-h-[620px]">
          {selectedDepartment ? (
            <DepartmentPanel
              department={selectedDepartment}
              data={selectedDepartment}
              year={selectedYear}
              onClose={() => setSelectedDepartment(null)}
              yearCollegeIndex={yearCollegeIndex}
            />
          ) : (
            <div className="h-full grid place-items-center text-slate-500">
              <div className="text-center">
                <svg
                  className="mx-auto h-20 w-20 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="mt-2 font-medium">Select a department</p>
                <p className="text-sm">Click any department to view details.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: People Search */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Search Individuals</h2>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {/* First Name */}
          <input
            type="text"
            placeholder="First Name"
            value={search.firstName}
            onChange={(e) => {
              setSearch((s) => ({ ...s, firstName: e.target.value }));
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Last Name */}
          <input
            type="text"
            placeholder="Last Name"
            value={search.lastName}
            onChange={(e) => {
              setSearch((s) => ({ ...s, lastName: e.target.value }));
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Campus dropdown */}
          <select
            value={search.campus}
            onChange={(e) => {
              setSearch((s) => ({ ...s, campus: e.target.value }));
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Campuses</option>
            {campuses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {/* Department dropdown */}
          <select
            value={search.department}
            onChange={(e) => {
              setSearch((s) => ({ ...s, department: e.target.value }));
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={selectedTableYear}
            onChange={(e) => {
              setSelectedTableYear(+e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Year</option>
                          {allYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}

          </select>


        </div>

        {/* Results + Person detail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Table */}
          <div>
            <div className="border rounded-lg overflow-hidden max-h-[420px]">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <SortHeader
                        label="Name"
                        active={sortBy === "name"}
                        dir={sortDir}
                        onClick={() => {
                          if (sortBy === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setSortBy("name");
                            setSortDir("asc");
                          }
                          setPage(1);
                        }}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Salary"
                        active={sortBy === "salary"}
                        dir={sortDir}
                        onClick={() => {
                          if (sortBy === "salary") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setSortBy("salary");
                            setSortDir("desc"); // default salary desc
                          }
                          setPage(1);
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
                      className={`cursor-pointer hover:bg-blue-50 ${selectedPerson?.id === p.id ? "bg-blue-100" : ""}`}
                      onClick={() => setSelectedPerson(p)}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-900">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-sm text-slate-500">{p.department}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">
                        {d3.format("$.2s")(p.salary)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3 text-sm">
              <div className="text-slate-600">
                Page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{totalPages}</span>
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

          {/* Person details */}
          <div>
            {selectedPerson ? (
              <PersonPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
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
      </div>
    </div>
  );
}