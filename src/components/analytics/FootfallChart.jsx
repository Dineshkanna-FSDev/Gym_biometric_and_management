import { useState } from 'react';
import { BarChart3 } from 'lucide-react';

/**
 * Daily Footfall bar chart comparing weekday vs. weekend check-in trends.
 */
export default function FootfallChart({ series = [] }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  const maxCount = Math.max(1, ...series.map((d) => d.count));

  const weekdayEntries = series.filter((d) => !d.isWeekend);
  const weekendEntries = series.filter((d) => d.isWeekend);
  const weekdayAvg =
    weekdayEntries.length > 0
      ? (weekdayEntries.reduce((s, d) => s + d.count, 0) / weekdayEntries.length).toFixed(1)
      : '0.0';
  const weekendAvg =
    weekendEntries.length > 0
      ? (weekendEntries.reduce((s, d) => s + d.count, 0) / weekendEntries.length).toFixed(1)
      : '0.0';

  const labelStep = series.length <= 10 ? 1 : series.length <= 31 ? 5 : 15;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Daily Footfall Trend</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Daily check-ins across the selected range (weekday vs. weekend).
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {hoveredDay ? (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
              {hoveredDay.weekday}, {hoveredDay.shortLabel}: {hoveredDay.count}{' '}
              {hoveredDay.count === 1 ? 'check-in' : 'check-ins'}
            </span>
          ) : (
            <div className="flex items-center gap-3 text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-indigo-500" />
                Weekday
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" />
                Weekend
              </span>
            </div>
          )}
        </div>
      </div>

      {series.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
          No footfall data in selected range.
        </div>
      ) : (
        <div className="mt-5 flex-1 flex flex-col justify-between">
          <div className="overflow-x-auto pb-2">
            <div
              className="flex h-44 items-end gap-1"
              style={{ minWidth: series.length > 45 ? `${series.length * 10}px` : '100%' }}
            >
              {series.map((day, idx) => {
                const heightPct = day.count === 0 ? 4 : Math.max(10, Math.round((day.count / maxCount) * 100));
                const barColor =
                  day.count === 0
                    ? 'bg-slate-100 hover:bg-slate-200'
                    : day.isWeekend
                      ? 'bg-amber-400 hover:bg-amber-500'
                      : 'bg-indigo-500 hover:bg-indigo-600';

                return (
                  <div
                    key={day.dateISO}
                    className="group flex h-full flex-1 flex-col items-center justify-end"
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <div
                      title={`${day.weekday} ${day.dateISO}: ${day.count} check-ins`}
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-all ${barColor}`}
                    />
                    <span className="mt-1.5 h-3 text-[9px] font-medium text-slate-400 whitespace-nowrap">
                      {idx % labelStep === 0 || idx === series.length - 1 ? day.shortLabel : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Weekday Avg: </span>
              <span className="font-bold text-slate-900">{weekdayAvg} / day</span>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Weekend Avg: </span>
              <span className="font-bold text-slate-900">{weekendAvg} / day</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
