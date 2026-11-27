import { useState } from 'react';
import { Clock } from 'lucide-react';
import { OPERATING_HOURS, WEEKDAYS, formatHourLabel } from '../../utils/analytics';

function getIntensityClass(count, maxCount) {
  if (!count || maxCount === 0) return 'bg-slate-100 text-slate-300';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'bg-indigo-100 text-indigo-800';
  if (ratio <= 0.5) return 'bg-indigo-300 text-indigo-950';
  if (ratio <= 0.75) return 'bg-indigo-500 text-white';
  return 'bg-indigo-700 text-white';
}

/**
 * Day x Hour IST (Asia/Kolkata) Peak Hour Heatmap (Mon-Sun x 05:00-22:00).
 */
export default function PeakHourHeatmap({ heatmap }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const { counts = {}, maxCount = 0 } = heatmap || {};

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Peak Hour Heatmap (IST 05:00 – 22:00)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Check-in density grouped by weekday and hour in Asia/Kolkata time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hoveredCell ? (
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {hoveredCell.day} {formatHourLabel(hoveredCell.hour)} — {hoveredCell.count}{' '}
              {hoveredCell.count === 1 ? 'check-in' : 'check-ins'}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Low</span>
              <span className="h-3 w-3 rounded bg-slate-100 border border-slate-200" />
              <span className="h-3 w-3 rounded bg-indigo-100" />
              <span className="h-3 w-3 rounded bg-indigo-300" />
              <span className="h-3 w-3 rounded bg-indigo-500" />
              <span className="h-3 w-3 rounded bg-indigo-700" />
              <span>Peak</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Hour Column Headers */}
          <div className="grid grid-cols-[52px_repeat(18,minmax(0,1fr))] gap-1 pb-1.5">
            <div />
            {OPERATING_HOURS.map((hour) => (
              <div
                key={hour}
                className="text-center font-mono text-[10px] font-semibold text-slate-400"
              >
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Weekday Rows */}
          <div className="space-y-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="grid grid-cols-[52px_repeat(18,minmax(0,1fr))] items-center gap-1"
              >
                <div className="text-xs font-bold text-slate-600">{day}</div>
                {OPERATING_HOURS.map((hour) => {
                  const count = counts?.[day]?.[hour] || 0;
                  const tone = getIntensityClass(count, maxCount);
                  return (
                    <button
                      key={`${day}-${hour}`}
                      type="button"
                      title={`${day} ${formatHourLabel(hour)} IST: ${count} check-ins`}
                      onMouseEnter={() => setHoveredCell({ day, hour, count })}
                      onFocus={() => setHoveredCell({ day, hour, count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`flex h-7 items-center justify-center rounded-md text-[10px] font-bold transition hover:ring-2 hover:ring-indigo-400 ${tone}`}
                    >
                      {count > 0 ? count : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
