/**
 * Reusable animate-pulse loading skeletons for KPI grids, tables, and profiles.
 */

export function KpiGridSkeleton({ count = 6, colsClass = 'grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' }) {
  return (
    <div className={`grid ${colsClass}`}>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-7 w-16 rounded bg-slate-200" />
              <div className="h-2.5 w-28 rounded bg-slate-100" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 6 }) {
  return Array.from({ length: rows }, (_, rowIdx) => (
    <tr key={rowIdx} className="animate-pulse">
      {Array.from({ length: cols }, (_, colIdx) => (
        <td key={colIdx} className="px-5 py-4">
          <div
            className={`h-3.5 rounded bg-slate-200 ${
              colIdx === 0 ? 'w-32' : colIdx === cols - 1 ? 'ml-auto w-16' : 'w-20'
            }`}
          />
        </td>
      ))}
    </tr>
  ));
}

export function CardListSkeleton({ rows = 4 }) {
  return (
    <div className="animate-pulse divide-y divide-slate-100 px-5">
      {Array.from({ length: rows }, (_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-3 py-3.5">
          <div className="space-y-2">
            <div className="h-3.5 w-36 rounded bg-slate-200" />
            <div className="h-2.5 w-24 rounded bg-slate-100" />
          </div>
          <div className="h-5 w-16 rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
