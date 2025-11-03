import React from "react";
import * as d3 from "d3";
// import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import { Search, X } from "lucide-react";

import {makeYearCollegeIndex, getSalaryForYear, getPositionsForYear, pickPrimaryOrg, splitName  } from "./utils";

import {SortHeader} from "./components/SortHeader"
import {Histogram} from "./components/Histogram"
import { BarChart } from "./components/BarChart";
import { SankeyBudget } from "./components/SankeyBudget";

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




/* --------------------------- MAIN PANELS/SCREENS --------------------------- */
function StatCard({ label, value, bg }) {
  return (
    <div className={`${bg} rounded-lg p-3`}>
      <div className="flex items-center gap-2 text-slate-600 mb-1">
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function DepartmentPanel({ department: collegeName, year, onClose, yearCollegeIndex }) {
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
          <h2 className="text-2xl font-semibold text-slate-900">{collegeName}</h2>
          <p className="text-sm text-slate-500">
            Figures shown for <span className="font-medium">{year}</span> · Budget{" "}
            {d3.format("$.3s")(stats.budget)}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab("budget")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === "budget" ? "bg-blue-600 text-slate" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Budget Over Years
        </button>
        <button
          onClick={() => setTab("hist")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === "hist" ? "bg-blue-600 text-slate" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
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
        <StatCard label={`Avg Salary (${year})`} value={d3.format("$.2s")(stats.avgSalary)} bg="bg-blue-50" />
        <StatCard label={`Employees (${year})`} value={stats.employeesCount} bg="bg-green-50" />
        <StatCard label={`Top Salary (${year})`} value={d3.format("$.2s")(stats.topEarners?.[0]?.salary ?? 0)} bg="bg-purple-50" />
      </div>

      {/* Top earners */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Top earners in {year}</h3>
        <div className="space-y-2">
          {stats.topEarners.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="font-medium text-slate-900">{p.name}</div>
                <div className="text-sm text-slate-500">{p.position}</div>
              </div>
              <div className="font-semibold text-slate-900">{d3.format("$.2s")(p.salary)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function PersonPanel({ person, onClose }) {
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
          <h3 className="text-xl font-semibold text-slate-900">{match?.name || `${person.firstName} ${person.lastName}`}</h3>
          {currentPositions.length > 0 && (
            <p className="text-sm text-slate-500">
              {currentPositions.map(p => p.title).join(", ")}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Close person"
        >
          <X size={20} />
        </button>
      </div>

      {/* Salary info */}
      <div className="space-y-2 mb-4">
        <div className="text-sm text-slate-600">
          <strong>Last Recorded Salary:</strong>{" "}
          {d3.format("$,.0f")(salaryHistory.at(-1)?.salary ?? 0)}
        </div>
        <div className="text-sm text-slate-600">
          <strong>Departments:</strong>{" "}
          {Array.from(new Set(currentPositions.map(p => p.department))).join(", ") || "—"}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-700 mb-2">
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

      <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
        Last Recorded Positions
      </h4>
      {currentPositions.map((p, i) => (
        <div key={i} className="p-3 bg-slate-50 rounded-lg mb-2">
          <div className="font-medium text-slate-900">{p.title}</div>
          <div className="text-sm text-slate-600">{p.department}</div>
          <div className="text-xs text-slate-500">
            {p.college} • ${d3.format(",.0f")(p.positionSalary)} •{" "}
            {p.tenure || "N/A"}
          </div>
        </div>
      ))}
    </div>
  );
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
        campus: e.campus || "Main",
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
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Top: Sankey + Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sankey card */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Salary Budget by Department</h2>

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
                <p className="text-sm">Click any segment in the Sankey to view details.</p>
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