/**
 * Reusable KPI summary card for dashboard and analytics views.
 */
export default function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  accentClass = 'bg-indigo-50 text-indigo-600',
  valueClass = 'text-slate-900',
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}>
            {value}
          </p>
          {subtext && (
            <p className="mt-1 truncate text-xs text-slate-500">{subtext}</p>
          )}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
