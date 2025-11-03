import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function SortHeader({ label, active, dir, onClick, alignRight = false }) {
  // Only the arrow button is interactive; the label is static text
  return (
    <div className={`flex items-center gap-1 ${alignRight ? "justify-end" : ""}`}>
      {!alignRight && <span className="text-slate-700">{label}</span>}

      <button
        type="button"
        onClick={onClick}
        aria-label={`Sort by ${label} ${active ? (dir === "asc" ? "descending" : "ascending") : ""}`}
        aria-pressed={active}
        className="p-1 -m-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {active ? (
          dir === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />
        ) : (
          <ArrowUpDown size={16} className="opacity-60" />
        )}
      </button>

      {alignRight && <span className="text-slate-700">{label}</span>}
    </div>
  );
}
