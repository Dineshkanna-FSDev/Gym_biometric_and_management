import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  IndianRupee,
  Loader2,
  MessageCircle,
  RefreshCw,
  ScanFace,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { addDaysToISO, ensureAndFetchSubscriptionPlans, getTodayISO } from '../../lib/subscriptionPlans';
import { useAuth } from '../../hooks/useAuth';
import {
  DEMO_ATTENDANCE_LOGS,
  DEMO_MEMBERS_OVERVIEW,
  DEMO_PAYMENTS,
  DEMO_SUBSCRIPTIONS,
} from '../../data/demoData';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import MemberLink from '../../components/ui/MemberLink';
import PeakHourHeatmap from '../../components/analytics/PeakHourHeatmap';
import FootfallChart from '../../components/analytics/FootfallChart';
import {
  DATE_RANGE_OPTIONS,
  buildDailyFootfallSeries,
  buildDemographics,
  buildPeakHourHeatmap,
  buildRevenueAnalytics,
  buildWhatsAppReminderUrl,
  downloadAnalyticsCsv,
  getAnalyticsDateWindow,
  toISTParts,
} from '../../utils/analytics';
import {
  displayValue,
  formatCurrency,
  formatDate,
  formatDurationMinutes,
  getValidityToneClass,
} from '../../utils/formatters';

/**
 * Full Gym Analytics Workspace (/admin/analytics) backed by live Supabase
 * queries across attendance_logs, members, member_overview,
 * member_subscriptions, payments, and subscription_plans.
 */
export default function Analytics() {
  const { isDemoMode } = useAuth();

  const [rangeKey, setRangeKey] = useState('30d');
  const [faceFilter, setFaceFilter] = useState('pending'); // 'pending' | 'all'

  const [dataset, setDataset] = useState({
    attendanceLogs: [],
    members: [],
    memberOverview: [],
    subscriptions: [],
    payments: [],
    plans: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const windowInfo = getAnalyticsDateWindow(rangeKey);

  const fetchAnalyticsDataset = useCallback(
    async (selectedRange) => {
      const win = getAnalyticsDateWindow(selectedRange);
      const tenDaysAgo = addDaysToISO(win.endISO, -9);
      const attendanceFloor = win.startISO < tenDaysAgo ? win.startISO : tenDaysAgo;

      if (isDemoMode || !isSupabaseConfigured || !supabase) {
        const plans = await ensureAndFetchSubscriptionPlans(true);
        return {
          attendanceLogs: DEMO_ATTENDANCE_LOGS,
          members: DEMO_MEMBERS_OVERVIEW,
          memberOverview: DEMO_MEMBERS_OVERVIEW,
          subscriptions: DEMO_SUBSCRIPTIONS,
          payments: DEMO_PAYMENTS,
          plans,
        };
      }

      const [attRes, membersRes, overviewRes, subsRes, payRes, plans] = await Promise.all([
        supabase
          .from('attendance_logs')
          .select('id, member_id, attendance_date, check_in_at, check_out_at, duration_minutes, status')
          .gte('attendance_date', attendanceFloor)
          .order('check_in_at', { ascending: false })
          .limit(5000),
        supabase
          .from('members')
          .select('id, full_name, device_pin, phone, gender, date_of_birth, face_enrolled, status')
          .limit(2000),
        supabase.from('member_overview').select('*').limit(2000),
        supabase
          .from('member_subscriptions')
          .select('id, member_id, plan_id, start_date, end_date, payable_amount, paid_amount')
          .limit(3000),
        supabase
          .from('payments')
          .select('id, member_id, subscription_id, amount, payment_method, payment_date, created_at')
          .gte('payment_date', win.startISO)
          .lte('payment_date', win.endISO)
          .limit(3000),
        ensureAndFetchSubscriptionPlans(false).catch(() => []),
      ]);

      if (attRes.error) throw attRes.error;
      if (membersRes.error) throw membersRes.error;
      if (overviewRes.error) throw overviewRes.error;
      if (subsRes.error) throw subsRes.error;
      if (payRes.error) throw payRes.error;

      return {
        attendanceLogs: attRes.data || [],
        members: membersRes.data || [],
        memberOverview: overviewRes.data || [],
        subscriptions: subsRes.data || [],
        payments: payRes.data || [],
        plans: plans || [],
      };
    },
    [isDemoMode]
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await fetchAnalyticsDataset(rangeKey);
      setDataset(next);
    } catch (err) {
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsDataset, rangeKey]);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsDataset(rangeKey)
      .then((next) => {
        if (cancelled) return;
        setDataset(next);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load analytics data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAnalyticsDataset, rangeKey]);

  // Filter attendance logs and payments strictly within the selected window
  const logsInRange = dataset.attendanceLogs.filter((log) => {
    const istDate = toISTParts(log.check_in_at)?.dateISO;
    const dateVal = istDate || (log.attendance_date ? String(log.attendance_date).slice(0, 10) : '');
    return dateVal >= windowInfo.startISO && dateVal <= windowInfo.endISO;
  });

  const paymentsInRange = dataset.payments.filter((pay) => {
    const pDate = String(pay.payment_date || pay.created_at || '').slice(0, 10);
    if (!pDate) return false;
    return pDate >= windowInfo.startISO && pDate <= windowInfo.endISO;
  });

  // Section 2: Top KPI Calculations
  const collectedRevenue = paymentsInRange.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingDues = dataset.memberOverview.reduce(
    (sum, m) => sum + Math.max(0, Number(m.pending_amount || 0)),
    0
  );
  const totalCheckIns = logsInRange.length;
  const avgDailyFootfall = Number((totalCheckIns / windowInfo.daysCount).toFixed(1));

  const completedSessions = logsInRange.filter(
    (l) =>
      String(l.status || '').toLowerCase() === 'completed' &&
      l.duration_minutes !== null &&
      l.duration_minutes !== undefined
  );
  const avgSessionMinutes =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, l) => sum + Number(l.duration_minutes || 0), 0) /
            completedSessions.length
        )
      : null;

  // Section 3: Peak Hour Heatmap & Daily Footfall
  const heatmap = buildPeakHourHeatmap(logsInRange);
  const dailySeries = buildDailyFootfallSeries(
    logsInRange,
    windowInfo.startISO,
    windowInfo.endISO
  );

  // Section 4: Revenue & Package Performance
  const { packageRows, methodRows } = buildRevenueAnalytics({
    paymentsInRange,
    subscriptions: dataset.subscriptions,
    plans: dataset.plans,
    memberOverview: dataset.memberOverview,
  });
  const maxPackageRevenue = Math.max(1, ...packageRows.map((p) => p.revenue));
  const totalMethodRevenue = methodRows.reduce((sum, m) => sum + m.amount, 0);

  // Section 5: Membership Health & Early Churn Risk ("Paid but Absent")
  const subCountByMember = new Map();
  for (const sub of dataset.subscriptions) {
    const key = String(sub.member_id);
    subCountByMember.set(key, (subCountByMember.get(key) || 0) + 1);
  }

  const health = {
    active: dataset.memberOverview.filter(
      (m) => m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) > 5
    ).length,
    expiringSoon: dataset.memberOverview.filter(
      (m) =>
        m.validity_days !== null &&
        m.validity_days !== undefined &&
        Number(m.validity_days) >= 0 &&
        Number(m.validity_days) <= 5
    ).length,
    expired: dataset.memberOverview.filter(
      (m) =>
        (m.validity_days !== null &&
          m.validity_days !== undefined &&
          Number(m.validity_days) < 0) ||
        ((m.validity_days === null || m.validity_days === undefined) &&
          String(m.status || '').toLowerCase() === 'expired')
    ).length,
    renewed: Array.from(subCountByMember.values()).filter((count) => count > 1).length,
  };

  // Last check-in date per member and 10-day absence detection
  const todayISO = getTodayISO();
  const tenDaysAgoISO = addDaysToISO(todayISO, -9);
  const lastCheckInByMember = new Map();
  const checkedInLast10Days = new Set();

  for (const log of dataset.attendanceLogs) {
    const mKey = String(log.member_id);
    const dateStr =
      toISTParts(log.check_in_at)?.dateISO ||
      (log.attendance_date ? String(log.attendance_date).slice(0, 10) : null);
    if (!dateStr) continue;

    if (dateStr >= tenDaysAgoISO && dateStr <= todayISO) {
      checkedInLast10Days.add(mKey);
    }

    const existing = lastCheckInByMember.get(mKey);
    if (!existing || dateStr > existing) {
      lastCheckInByMember.set(mKey, dateStr);
    }
  }

  const churnRiskMembers = dataset.memberOverview
    .filter(
      (m) =>
        m.validity_days !== null &&
        m.validity_days !== undefined &&
        Number(m.validity_days) > 0 &&
        !checkedInLast10Days.has(String(m.id))
    )
    .map((m) => ({
      ...m,
      lastCheckInDate: lastCheckInByMember.get(String(m.id)) || null,
      whatsappUrl: buildWhatsAppReminderUrl(m.phone, m.full_name),
    }))
    .sort((a, b) => Number(a.validity_days) - Number(b.validity_days));

  // Section 6: Demographics & Biometric Face Enrollment Readiness
  const demographics = buildDemographics(dataset.members);
  const totalMembersCount = Math.max(1, dataset.members.length);

  const activeBiometricMembers = dataset.memberOverview.filter(
    (m) =>
      String(m.status || '').toLowerCase() === 'active' ||
      (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) > 0)
  );
  const enrolledActive = activeBiometricMembers.filter((m) => Boolean(m.face_enrolled));
  const pendingActive = activeBiometricMembers.filter((m) => !m.face_enrolled);
  const enrolledPct =
    activeBiometricMembers.length > 0
      ? Math.round((enrolledActive.length / activeBiometricMembers.length) * 100)
      : 0;
  const displayedFaceMembers =
    faceFilter === 'pending' ? pendingActive : activeBiometricMembers;

  function handleExportCsv() {
    downloadAnalyticsCsv({
      windowInfo,
      kpis: {
        collectedRevenue,
        pendingDues,
        totalCheckIns,
        avgDailyFootfall,
        avgSessionMinutes,
      },
      health,
      packageRows,
      dailySeries,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header + Date Filter + CSV Export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Gym Analytics &amp; Insights
          </h1>
          <p className="text-sm text-slate-500">
            Attendance trends, peak hours, revenue by package, retention health, and biometric readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Select analytics date range"
              value={rangeKey}
              onChange={(e) => setRangeKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm font-semibold text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading && dataset.memberOverview.length === 0 ? (
        <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Loading live gym analytics...</p>
        </div>
      ) : (
        <>
          {/* 2. Top KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Collected Revenue"
              value={formatCurrency(collectedRevenue)}
              subtext={`${paymentsInRange.length} payments (${windowInfo.label})`}
              icon={IndianRupee}
              accentClass="bg-emerald-50 text-emerald-600"
              valueClass="text-emerald-700"
            />
            <StatCard
              label="Pending Dues"
              value={formatCurrency(pendingDues)}
              subtext="Across active & overdue plans"
              icon={Wallet}
              accentClass="bg-rose-50 text-rose-600"
              valueClass={pendingDues > 0 ? 'text-rose-600' : 'text-slate-900'}
            />
            <StatCard
              label="Avg. Daily Footfall"
              value={avgDailyFootfall}
              subtext={`${totalCheckIns} check-ins over ${windowInfo.daysCount} days`}
              icon={Activity}
              accentClass="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              label="Avg. Session Duration"
              value={
                avgSessionMinutes !== null ? formatDurationMinutes(avgSessionMinutes) : '—'
              }
              subtext={`${completedSessions.length} completed sessions (excludes auto_closed)`}
              icon={Clock}
              accentClass="bg-amber-50 text-amber-600"
            />
          </div>

          {/* 3. Peak Hour Heatmap & Daily Footfall Chart */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <PeakHourHeatmap heatmap={heatmap} />
            </div>
            <div className="xl:col-span-5">
              <FootfallChart series={dailySeries} />
            </div>
          </div>

          {/* 4. Revenue & Package Performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Revenue &amp; Adoption by Package
                  </h2>
                </div>
                <span className="text-xs font-medium text-slate-400">{windowInfo.label}</span>
              </div>

              <div className="mt-4 space-y-3.5">
                {packageRows.map((pkg) => {
                  const barPct =
                    pkg.revenue > 0
                      ? Math.max(4, Math.round((pkg.revenue / maxPackageRevenue) * 100))
                      : 0;
                  return (
                    <div key={pkg.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate font-semibold text-slate-800">{pkg.name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {pkg.activeMembers} active
                          </span>
                        </div>
                        <span className="shrink-0 font-bold text-slate-900">
                          {formatCurrency(pkg.revenue)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          style={{ width: `${barPct}%` }}
                          className="h-full rounded-full bg-indigo-600 transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Payment Method Breakdown
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {formatCurrency(totalMethodRevenue)}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {methodRows.map((row) => {
                  const pct =
                    totalMethodRevenue > 0
                      ? Math.round((row.amount / totalMethodRevenue) * 100)
                      : 0;
                  return (
                    <div key={row.method} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-bold text-slate-900">{row.method}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            ({row.count} {row.count === 1 ? 'txn' : 'txns'})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">
                            {formatCurrency(row.amount)}
                          </span>
                          <span className="ml-2 text-xs font-semibold text-indigo-600">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full rounded-full bg-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* 5. Retention, Churn & "Slipping Away" Alerts */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
            <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Retention, Churn &amp; Early Churn Risk (&ldquo;Paid but Absent&rdquo;)
                </h2>
              </div>
              <StatusBadge variant={churnRiskMembers.length > 0 ? 'warning' : 'success'}>
                {churnRiskMembers.length} slipping away
              </StatusBadge>
            </div>

            {/* Membership Health Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Active (&gt; 5d)
                </p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-800">{health.active}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Expiring Soon (0–5d)
                </p>
                <p className="mt-1 text-2xl font-extrabold text-amber-800">
                  {health.expiringSoon}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Expired (&lt; 0d)
                </p>
                <p className="mt-1 text-2xl font-extrabold text-rose-800">{health.expired}</p>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Renewed (&gt; 1 Sub)
                </p>
                <p className="mt-1 text-2xl font-extrabold text-indigo-800">{health.renewed}</p>
              </div>
            </div>

            {/* Paid but Absent (0 check-ins in last 10 days) */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                Active Members with 0 Check-ins in Last 10 Days
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                  <thead className="bg-white text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Member</th>
                      <th className="px-4 py-2.5">Active Plan</th>
                      <th className="px-4 py-2.5">Validity Remaining</th>
                      <th className="px-4 py-2.5">Last Check-in</th>
                      <th className="px-4 py-2.5 text-right">WhatsApp Check-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {churnRiskMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                          All active members have checked in within the last 10 days.
                        </td>
                      </tr>
                    ) : (
                      churnRiskMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <MemberLink memberId={m.id} name={m.full_name} />
                            </div>
                            <div className="font-mono text-xs text-slate-400">
                              PIN {displayValue(m.device_pin)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {displayValue(m.active_package, '—')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${getValidityToneClass(
                                m.validity_days
                              )}`}
                            >
                              {m.validity_days} days
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {m.lastCheckInDate ? formatDate(m.lastCheckInDate) : 'Never'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {m.whatsappUrl ? (
                              <a
                                href={m.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Send Reminder</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">No phone</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 6. Demographic & Biometric Readiness Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Gender & Age Distribution */}
            <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <Users className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Gender &amp; Age Distribution
                </h2>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gender Breakdown ({dataset.members.length} members)
                </h3>
                <div className="mt-3 space-y-2.5">
                  {demographics.genders.map((g) => {
                    const pct = Math.round((g.count / totalMembersCount) * 100);
                    return (
                      <div key={g.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700">{g.label}</span>
                          <span className="text-slate-900">
                            {g.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-sky-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Age Brackets
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {demographics.ages.map((a) => (
                    <div
                      key={a.label}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <p className="text-[11px] font-semibold text-slate-500">{a.label}</p>
                      <p className="mt-1 text-lg font-extrabold text-slate-900">{a.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Biometric Face Enrollment Readiness */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ScanFace className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Biometric Face Enrollment Readiness
                    </h2>
                    <p className="text-xs text-slate-500">
                      Active members enrolled on ZKFace terminal vs. pending scan.
                    </p>
                  </div>
                </div>

                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFaceFilter('pending')}
                    className={`rounded-md px-2.5 py-1 transition ${
                      faceFilter === 'pending'
                        ? 'bg-white text-amber-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending ({pendingActive.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaceFilter('all')}
                    className={`rounded-md px-2.5 py-1 transition ${
                      faceFilter === 'all'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Active ({activeBiometricMembers.length})
                  </button>
                </div>
              </div>

              {/* Enrollment Ratio Progress Bar */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-700">
                    Enrolled: {enrolledActive.length} ({enrolledPct}%)
                  </span>
                  <span className="text-amber-700">
                    Pending Scan: {pendingActive.length} ({100 - enrolledPct}%)
                  </span>
                </div>
                <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    style={{ width: `${enrolledPct}%` }}
                    className="h-full bg-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
                {displayedFaceMembers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    {faceFilter === 'pending'
                      ? 'All active members have completed biometric face enrollment!'
                      : 'No active members found.'}
                  </p>
                ) : (
                  displayedFaceMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          <MemberLink memberId={m.id} name={m.full_name} />
                          <span className="ml-2 font-mono text-xs text-slate-400">
                            PIN {displayValue(m.device_pin)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{displayValue(m.phone)}</p>
                      </div>

                      {m.face_enrolled ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                          <ScanFace className="h-3.5 w-3.5" />
                          Pending Scan
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
