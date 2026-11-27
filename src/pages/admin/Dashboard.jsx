import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Cake,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  MessageSquare,
  Play,
  RefreshCw,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayISO } from '../../lib/subscriptionPlans';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import StreakBadge from '../../components/ui/StreakBadge';
import MemberLink from '../../components/ui/MemberLink';
import {
  CardListSkeleton,
  KpiGridSkeleton,
  TableRowsSkeleton,
} from '../../components/ui/LoadingSkeletons';
import {
  displayValue,
  formatCurrency,
  formatDateDDMMYYYY,
  formatTime,
  getValidityToneClass,
} from '../../utils/formatters';
import {
  buildMemberAvgHoursMap,
  formatAvgHoursPerDay,
} from '../../utils/analytics';

function daysUntilBirthday(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return Math.round((next - today) / (1000 * 60 * 60 * 24));
}

/**
 * Reusable scrollable alert list card for renewal, expired, and birthday widgets.
 */
function MemberAlertListCard({
  title,
  icon: Icon,
  iconClass,
  items,
  loading = false,
  emptyText,
  showPin = true,
}) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>

      {loading ? (
        <CardListSkeleton rows={4} />
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 px-5">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{emptyText}</p>
          ) : (
            items.map((item) => (
              <div
                key={`${item.id}-${item.date}`}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <MemberLink memberId={item.id} name={item.name} />
                    {showPin && item.pin !== null && item.pin !== undefined && (
                      <span className="ml-1.5 font-mono text-xs font-medium text-slate-400">
                        | PIN {item.pin}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.date}</p>
                </div>
                <StatusBadge variant={item.variant} className="shrink-0">
                  {item.badge}
                </StatusBadge>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Live Admin Dashboard backed by `member_overview`, `attendance_logs`, `payments`,
 * and Supabase Realtime (`postgres_changes` on `attendance_logs` & `members`).
 */
export default function Dashboard() {
  const outletContext = useOutletContext() || {};
  const globalSearch = (outletContext.globalSearch || '').trim().toLowerCase();

  const [members, setMembers] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [completedLogs, setCompletedLogs] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationState, setNotificationState] = useState('idle');

  const todayISO = getTodayISO();
  const monthStartISO = `${todayISO.slice(0, 7)}-01`;
  const todayFormatted = formatDateDDMMYYYY(todayISO);

  const realtimeTimerRef = useRef(null);

  const fetchDashboardData = useCallback(async () => {
    const [membersRes, attendanceRes, paymentsRes] = await Promise.all([
      supabase.from('member_overview').select('*').order('full_name', { ascending: true }),
      supabase
        .from('attendance_logs')
        .select('*')
        .eq('attendance_date', todayISO)
        .order('check_in_at', { ascending: false }),
      supabase
        .from('payments')
        .select('amount, payment_date')
        .gte('payment_date', monthStartISO)
        .lte('payment_date', todayISO),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const todayRows = attendanceRes.data || [];
    const todayMemberIds = Array.from(
      new Set(todayRows.map((l) => l.member_id).filter(Boolean))
    );

    let completedRows = [];
    if (todayMemberIds.length > 0) {
      const completedRes = await supabase
        .from('attendance_logs')
        .select('member_id, attendance_date, check_in_at, duration_minutes, status')
        .in('member_id', todayMemberIds)
        .eq('status', 'completed')
        .not('duration_minutes', 'is', null)
        .limit(5000);

      if (!completedRes.error && completedRes.data) {
        completedRows = completedRes.data;
      }
    }

    const monthTotal = (paymentsRes.data || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return {
      members: membersRes.data || [],
      todayLogs: todayRows,
      completedLogs: completedRows,
      monthlyRevenue: monthTotal,
    };
  }, [monthStartISO, todayISO]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchDashboardData();
      setMembers(result.members);
      setTodayLogs(result.todayLogs);
      setCompletedLogs(result.completedLogs);
      setMonthlyRevenue(result.monthlyRevenue);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((result) => {
        if (cancelled) return;
        setMembers(result.members);
        setTodayLogs(result.todayLogs);
        setCompletedLogs(result.completedLogs);
        setMonthlyRevenue(result.monthlyRevenue);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Realtime subscription on attendance_logs & members for instant biometric updates
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchDashboardData()
              .then((res) => {
                if (cancelled) return;
                setMembers(res.members);
                setTodayLogs(res.todayLogs);
                setCompletedLogs(res.completedLogs);
                setMonthlyRevenue(res.monthlyRevenue);
              })
              .catch(() => {});
          }, 250);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => {
          clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => {
            fetchDashboardData()
              .then((res) => {
                if (cancelled) return;
                setMembers(res.members);
                setTodayLogs(res.todayLogs);
                setCompletedLogs(res.completedLogs);
                setMonthlyRevenue(res.monthlyRevenue);
              })
              .catch(() => {});
          }, 250);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const memberById = new Map(members.map((m) => [String(m.id), m]));
  const avgHoursByMember = buildMemberAvgHoursMap(completedLogs);

  // KPI calculations from live member_overview + attendance_logs + payments
  const totalMembers = members.length;
  const activeMembers = members.filter(
    (m) =>
      String(m.status || '').toLowerCase() === 'active' ||
      (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) >= 0)
  ).length;
  const maleCount = members.filter(
    (m) => String(m.gender || '').toLowerCase() === 'male'
  ).length;
  const femaleCount = members.filter(
    (m) => String(m.gender || '').toLowerCase() === 'female'
  ).length;

  const presentMemberIds = new Set(todayLogs.map((l) => String(l.member_id)));
  const todayPresent = presentMemberIds.size;
  const todayAbsent = Math.max(0, totalMembers - todayPresent);

  const expiringSoonCount = members.filter(
    (m) =>
      m.validity_days !== null &&
      m.validity_days !== undefined &&
      Number(m.validity_days) >= 0 &&
      Number(m.validity_days) <= 5
  ).length;

  const expiredMembers = members.filter(
    (m) =>
      String(m.status || '').toLowerCase() === 'expired' ||
      (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) < 0)
  ).length;

  const kpiCards = [
    {
      label: 'Active Members',
      value: activeMembers,
      subtext: `${totalMembers} total (${maleCount}M / ${femaleCount}F)`,
      icon: Users,
      accentClass: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Today Present',
      value: todayPresent,
      subtext: 'Synced via ZKFace V4.0',
      icon: UserCheck,
      accentClass: 'bg-emerald-50 text-emerald-600',
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Today Absent',
      value: todayAbsent,
      subtext: 'Not punched in yet',
      icon: UserMinus,
      accentClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Expiring (≤ 5 Days)',
      value: expiringSoonCount,
      subtext: 'Upcoming renewals',
      icon: CalendarClock,
      accentClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Expired Members',
      value: expiredMembers,
      subtext: 'Needs renewal follow-up',
      icon: UserX,
      accentClass: 'bg-rose-50 text-rose-600',
      valueClass: 'text-rose-600',
    },
    {
      label: 'Monthly Revenue',
      value: formatCurrency(monthlyRevenue),
      subtext: 'Collected this month',
      icon: IndianRupee,
      accentClass: 'bg-emerald-50 text-emerald-600',
      valueClass: 'text-emerald-700',
    },
  ];

  // Today Attendance Table rows joined with member_overview
  const attendanceRows = todayLogs
    .map((log) => {
      const m = memberById.get(String(log.member_id));
      return {
        id: log.id,
        memberId: log.member_id,
        name: m?.full_name || `Member #${log.member_id}`,
        pin: m?.device_pin,
        currentStreak: Number(m?.current_streak || 0),
        checkIn: formatTime(log.check_in_at),
        checkOut: formatTime(log.check_out_at),
        validityDays: m?.validity_days ?? null,
        avgHoursLabel: formatAvgHoursPerDay(avgHoursByMember.get(String(log.member_id))),
      };
    })
    .filter((row) => {
      if (!globalSearch) return true;
      return (
        row.name.toLowerCase().includes(globalSearch) ||
        String(row.pin ?? '').toLowerCase().includes(globalSearch)
      );
    });

  // Expiring Soon (0..5 days remaining)
  const expireRenewalList = members
    .filter(
      (m) =>
        m.validity_days !== null &&
        m.validity_days !== undefined &&
        Number(m.validity_days) >= 0 &&
        Number(m.validity_days) <= 5
    )
    .sort((a, b) => Number(a.validity_days) - Number(b.validity_days))
    .map((m) => ({
      id: m.id,
      name: m.full_name,
      pin: m.device_pin,
      date: formatDateDDMMYYYY(m.next_renewal),
      badge:
        Number(m.validity_days) === 0
          ? 'Expires today'
          : `In ${m.validity_days} ${Number(m.validity_days) === 1 ? 'day' : 'days'}`,
      variant: 'warning',
    }));

  // Expired Memberships
  const expiredMembershipList = members
    .filter(
      (m) =>
        String(m.status || '').toLowerCase() === 'expired' ||
        (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) < 0)
    )
    .sort((a, b) => Number(b.validity_days ?? -999) - Number(a.validity_days ?? -999))
    .map((m) => {
      const daysAgo =
        m.validity_days !== null && m.validity_days !== undefined
          ? Math.abs(Number(m.validity_days))
          : null;
      return {
        id: m.id,
        name: m.full_name,
        pin: m.device_pin,
        date: formatDateDDMMYYYY(m.next_renewal),
        badge: daysAgo === null ? 'Expired' : daysAgo === 0 ? 'Today' : `${daysAgo} days ago`,
        variant: 'danger',
      };
    });

  // Upcoming Birthdays (within next 14 days)
  const upcomingBirthdays = members
    .map((m) => ({ m, daysLeft: daysUntilBirthday(m.date_of_birth) }))
    .filter(({ daysLeft }) => daysLeft !== null && daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map(({ m, daysLeft }) => ({
      id: m.id,
      name: m.full_name,
      date: formatDateDDMMYYYY(m.date_of_birth),
      badge: daysLeft === 0 ? 'Today' : `In ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
      variant: daysLeft <= 3 ? 'info' : 'neutral',
    }));

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Live gym occupancy, biometric attendance punches, and subscription health.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Realtime Live
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Row */}
      {loading && members.length === 0 ? (
        <KpiGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Middle Section (2-Column Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Card — Today Attendance (DD-MM-YYYY) */}
        <section className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Today Attendance ({todayFormatted})
              </h2>
              <p className="text-xs text-slate-500">
                Real-time check-ins with subscription validity &amp; daily avg hours
              </p>
            </div>
            <StatusBadge variant="info">{attendanceRows.length} logs</StatusBadge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Validity Days</th>
                  <th className="px-5 py-3 text-right">AVG HRS / DAY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && todayLogs.length === 0 ? (
                  <TableRowsSkeleton rows={5} cols={5} />
                ) : attendanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                      {globalSearch
                        ? `No attendance records match "${outletContext.globalSearch}".`
                        : 'No check-ins recorded today'}
                    </td>
                  </tr>
                ) : (
                  attendanceRows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MemberLink memberId={row.memberId} name={row.name} />
                          <StreakBadge count={row.currentStreak} />
                        </div>
                        <div className="font-mono text-xs text-slate-400">
                          PIN {displayValue(row.pin)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {row.checkIn}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                        {row.checkOut}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${getValidityToneClass(
                            row.validityDays
                          )}`}
                        >
                          {row.validityDays === null || row.validityDays === undefined
                            ? '—'
                            : `${row.validityDays} days`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right font-semibold text-slate-700">
                        {row.avgHoursLabel === '—' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span>{row.avgHoursLabel}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Card — Expire Renewal */}
        <div className="lg:col-span-5">
          <MemberAlertListCard
            title="Expire Renewal (≤ 5 Days)"
            icon={CalendarClock}
            iconClass="bg-amber-50 text-amber-600"
            items={expireRenewalList}
            loading={loading && members.length === 0}
            emptyText="No upcoming renewals in the next 5 days."
          />
        </div>
      </div>

      {/* Bottom Section (2-Column Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MemberAlertListCard
          title="Expired Membership"
          icon={AlertTriangle}
          iconClass="bg-rose-50 text-rose-600"
          items={expiredMembershipList}
          loading={loading && members.length === 0}
          emptyText="No expired memberships."
        />

        <MemberAlertListCard
          title="Upcoming Birthday"
          icon={Cake}
          iconClass="bg-indigo-50 text-indigo-600"
          items={upcomingBirthdays}
          loading={loading && members.length === 0}
          emptyText="No upcoming birthdays in the next 14 days."
          showPin={false}
        />
      </div>

      {/* Notification Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Notification</h2>
                <StatusBadge variant={notificationState === 'sent' ? 'success' : 'neutral'}>
                  {notificationState === 'sent' ? 'Batch Queued' : 'WhatsApp Reminders Ready'}
                </StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {notificationState === 'sent'
                  ? `WhatsApp expiry & renewal reminders queued for ${expireRenewalList.length} expiring and ${expiredMembershipList.length} expired members.`
                  : 'Send automated WhatsApp membership renewal reminders to members expiring within 5 days or recently expired.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setNotificationState((prev) => (prev === 'sent' ? 'idle' : 'sent'))
            }
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-2xs transition ${
              notificationState === 'sent'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {notificationState === 'sent' ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Sent (Reset)</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Start</span>
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
