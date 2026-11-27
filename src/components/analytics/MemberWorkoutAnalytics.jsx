import { useState } from 'react';
import { Activity, CalendarCheck2, Clock, Flame, Sun } from 'lucide-react';
import StatCard from '../ui/StatCard';
import { computeMemberWorkoutAnalytics } from '../../utils/analytics';
import { formatDurationMinutes } from '../../utils/formatters';

/**
 * Per-member workout analytics section rendered inside /admin/members/:id.
 * Computes 4 workout KPIs, a 30-day duration bar chart, and Mon-Sun habit breakdown.
 */
export default function MemberWorkoutAnalytics({ logs = [], joiningDate }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  const analytics = computeMemberWorkoutAnalytics(logs, joiningDate);
  const maxMinutes = Math.max(
    60,
    ...analytics.thirtyDaySeries.map((d) => d.minutes)
  );
  const maxWeekdayCount = Math.max(
    1,
    ...analytics.weekdayHabit.map((w) => w.count)
  );
  const topWeekdayCount = Math.max(...analytics.weekdayHabit.map((w) => w.count));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Member Workout Analytics</h2>
        </div>
        <span className="text-xs text-slate-500">
          Computed from completed biometric sessions (excludes auto-closed check-outs)
        </span>
      </div>

      {/* 4 Member Analytics KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Avg. Hours / Day"
          value={analytics.avgHoursLabel}
          subtext={
            analytics.completedCount > 0
              ? `Across ${analytics.completedCount} completed sessions`
              : 'No completed sessions yet'
          }
          icon={Clock}
          accentClass="bg-indigo-50 text-indigo-600"
        />

        <StatCard
          label="Total Visits (30d / All-Time)"
          value={`${analytics.visitsLast30Days} / ${analytics.totalVisitsAllTime}`}
          subtext="Distinct days visited (30 days vs. all-time)"
          icon={CalendarCheck2}
          accentClass="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          label="Weekly Consistency"
          value={`${analytics.avgDaysPerWeek} days/wk`}
          subtext={`Active streak: ${analytics.activeWeekStreak} ${
            analytics.activeWeekStreak === 1 ? 'week' : 'weeks'
          }`}
          icon={Flame}
          accentClass="bg-amber-50 text-amber-600"
        />

        <StatCard
          label="Usual Workout Slot"
          value={analytics.avgCheckInTime}
          subtext={analytics.usualSlot}
          icon={Sun}
          accentClass="bg-sky-50 text-sky-600"
        />
      </div>

      {/* Visual Activity Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 30-Day Attendance & Duration Bar Chart */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                30-Day Attendance &amp; Workout Duration
              </h3>
              <p className="text-[11px] text-slate-500">
                Daily logged workout duration over the last 30 days
              </p>
            </div>

            {hoveredDay ? (
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                {hoveredDay.weekday}, {hoveredDay.shortLabel}:{' '}
                {hoveredDay.minutes > 0
                  ? formatDurationMinutes(hoveredDay.minutes)
                  : hoveredDay.visitedWithoutDuration
                    ? 'Checked in (unclosed)'
                    : 'Rest day'}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Hover bars for duration</span>
            )}
          </div>

          <div className="mt-2 flex h-36 items-end gap-1">
            {analytics.thirtyDaySeries.map((day, idx) => {
              const heightPct =
                day.minutes > 0
                  ? Math.max(12, Math.round((day.minutes / maxMinutes) * 100))
                  : day.visitedWithoutDuration
                    ? 14
                    : 4;

              const barTone =
                day.minutes > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : day.visitedWithoutDuration
                    ? 'bg-amber-400 hover:bg-amber-500'
                    : 'bg-slate-200 hover:bg-slate-300';

              return (
                <div
                  key={day.dateISO}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <div
                    title={`${day.dateISO}: ${
                      day.minutes > 0
                        ? formatDurationMinutes(day.minutes)
                        : day.visitedWithoutDuration
                          ? 'Checked in'
                          : 'No visit'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-sm transition-all ${barTone}`}
                  />
                  <span className="mt-1.5 h-3 text-[9px] font-medium text-slate-400 whitespace-nowrap">
                    {idx % 6 === 0 || idx === 29 ? day.shortLabel : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day-of-Week Habit Breakdown */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <div className="pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Day-of-Week Habit
            </h3>
            <p className="text-[11px] text-slate-500">
              Most frequent training days (Mon – Sun)
            </p>
          </div>

          <div className="space-y-2.5">
            {analytics.weekdayHabit.map((item) => {
              const widthPct =
                item.count > 0 ? Math.max(8, Math.round((item.count / maxWeekdayCount) * 100)) : 0;
              const isTopDay = topWeekdayCount > 0 && item.count === topWeekdayCount;

              return (
                <div key={item.day} className="flex items-center gap-3 text-xs">
                  <span
                    className={`w-8 font-bold ${
                      isTopDay ? 'text-indigo-700' : 'text-slate-600'
                    }`}
                  >
                    {item.day}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        isTopDay ? 'bg-indigo-600' : 'bg-indigo-400'
                      }`}
                    />
                  </div>
                  <span
                    className={`w-7 text-right font-bold ${
                      isTopDay ? 'text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
