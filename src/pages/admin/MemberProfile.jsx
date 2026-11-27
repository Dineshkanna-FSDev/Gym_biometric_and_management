import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureAndFetchSubscriptionPlans } from '../../lib/subscriptionPlans';
import StatusBadge from '../../components/ui/StatusBadge';
import StreakBadge from '../../components/ui/StreakBadge';
import Modal from '../../components/ui/Modal';
import RenewBillingModal from '../../components/billing/RenewBillingModal';
import MemberWorkoutAnalytics from '../../components/analytics/MemberWorkoutAnalytics';
import { KpiGridSkeleton } from '../../components/ui/LoadingSkeletons';
import {
  displayValue,
  emptyToNull,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDurationMinutes,
  formatTime,
  getMemberStatusVariant,
  getValidityToneClass,
} from '../../utils/formatters';

function DetailField({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 break-words">
        {displayValue(value)}
      </p>
    </div>
  );
}

function sortByNewest(rows, keys) {
  return [...rows].sort((a, b) => {
    const aVal = keys.map((k) => a[k]).find(Boolean);
    const bVal = keys.map((k) => b[k]).find(Boolean);
    const aTime = aVal ? Date.parse(aVal) : 0;
    const bTime = bVal ? Date.parse(bVal) : 0;
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

/**
 * Full member profile view (/admin/members/:id) backed strictly by Supabase
 * (`member_overview`, `attendance_logs`, `member_subscriptions`, `payments`).
 */
export default function MemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const punchRefreshSignal = outletContext.punchRefreshSignal || 0;

  const [member, setMember] = useState(null);
  const [plansById, setPlansById] = useState({});
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('attendance');

  const [editOpen, setEditOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    date_of_birth: '',
    district: '',
    emergency_contact: '',
    status: 'active',
  });

  const fetchProfileData = useCallback(async () => {
    const [overviewRes, attRes, subRes, payRes, plansList] = await Promise.all([
      supabase.from('member_overview').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('attendance_logs')
        .select('*')
        .eq('member_id', id)
        .order('check_in_at', { ascending: false })
        .limit(500),
      supabase.from('member_subscriptions').select('*').eq('member_id', id).limit(50),
      supabase.from('payments').select('*').eq('member_id', id).limit(100),
      ensureAndFetchSubscriptionPlans().catch(() => []),
    ]);

    if (overviewRes.error) {
      throw overviewRes.error;
    }

    return {
      member: overviewRes.data ?? null,
      plansById: Object.fromEntries((plansList || []).map((p) => [String(p.id), p])),
      attendanceLogs: attRes.error ? [] : attRes.data || [],
      subscriptions: subRes.error
        ? []
        : sortByNewest(subRes.data || [], ['start_date', 'created_at']),
      payments: payRes.error
        ? []
        : sortByNewest(payRes.data || [], ['paid_at', 'payment_date', 'created_at']),
    };
  }, [id]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchProfileData();
      setMember(result.member);
      setPlansById(result.plansById);
      setAttendanceLogs(result.attendanceLogs);
      setSubscriptions(result.subscriptions);
      setPayments(result.payments);
    } catch (err) {
      setError(err.message || 'Failed to load member profile.');
    } finally {
      setLoading(false);
    }
  }, [fetchProfileData]);

  useEffect(() => {
    let cancelled = false;
    fetchProfileData()
      .then((result) => {
        if (cancelled) return;
        setMember(result.member);
        setPlansById(result.plansById);
        setAttendanceLogs(result.attendanceLogs);
        setSubscriptions(result.subscriptions);
        setPayments(result.payments);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load member profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProfileData]);

  // Soft-refresh attendance & streak data when a live punch hits for this already-open profile
  useEffect(() => {
    if (!punchRefreshSignal) return undefined;
    let cancelled = false;
    fetchProfileData()
      .then((result) => {
        if (cancelled) return;
        setMember(result.member);
        setPlansById(result.plansById);
        setAttendanceLogs(result.attendanceLogs);
        setSubscriptions(result.subscriptions);
        setPayments(result.payments);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [punchRefreshSignal, fetchProfileData]);

  function openEditModal() {
    if (!member) return;
    setActionMessage({ type: '', text: '' });
    setEditForm({
      full_name: member.full_name || '',
      phone: member.phone || '',
      email: member.email || '',
      gender: member.gender ? String(member.gender).toLowerCase() : '',
      date_of_birth: member.date_of_birth ? String(member.date_of_birth).slice(0, 10) : '',
      district: member.district || '',
      emergency_contact: member.emergency_contact || '',
      status: member.status ? String(member.status).toLowerCase() : 'active',
    });
    setEditOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setActionBusy(true);
    setActionMessage({ type: '', text: '' });

    try {
      const genderVal = emptyToNull(editForm.gender);
      const statusVal = emptyToNull(editForm.status);
      const payload = {
        full_name: editForm.full_name.trim(),
        phone: emptyToNull(editForm.phone),
        email: emptyToNull(editForm.email),
        gender: genderVal ? genderVal.toLowerCase() : null,
        date_of_birth: emptyToNull(editForm.date_of_birth),
        district: emptyToNull(editForm.district),
        emergency_contact: emptyToNull(editForm.emergency_contact),
        status: statusVal ? statusVal.toLowerCase() : 'active',
      };

      const { error: updateError } = await supabase.from('members').update(payload).eq('id', id);
      if (updateError) throw updateError;

      await loadProfile();
      setEditOpen(false);
      setActionMessage({ type: 'success', text: 'Member details updated successfully.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to update member.' });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleBillingSuccess(result) {
    await loadProfile();
    setActionMessage({
      type: 'success',
      text:
        result.type === 'clear_balance'
          ? `Balance payment of ${formatCurrency(result.amountPaid)} recorded.`
          : `Subscription renewed (${result.plan?.name}) successfully.`,
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
        <KpiGridSkeleton count={4} colsClass="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-base font-bold">Unable to load member profile</h2>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={loadProfile}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/admin/members')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Members</span>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <User className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-900">Member Not Found</h2>
          <p className="mt-1 text-sm text-slate-500">
            No record matched member ID <span className="font-mono">{id}</span> in{' '}
            <code>member_overview</code>.
          </p>
        </div>
      </div>
    );
  }

  const pendingAmountNum = Number(member.pending_amount || 0);
  const hasPending = pendingAmountNum > 0;
  const validityDays = member.validity_days;

  return (
    <div className="space-y-6">
      {/* Feedback Toast Banner */}
      {actionMessage.text && !editOpen && !billingOpen && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage({ type: '', text: '' })}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
                {(member.full_name || 'M').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {displayValue(member.full_name)}
                  </h1>
                  <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                    PIN #{displayValue(member.device_pin)}
                  </span>
                  <StatusBadge
                    variant={getMemberStatusVariant(member.status)}
                    className="capitalize"
                  >
                    {displayValue(member.status, 'unknown')}
                  </StatusBadge>
                  <StreakBadge count={member.current_streak} showZero size="md" />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ring-1 ring-inset ${
                      member.face_enrolled
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}
                  >
                    {member.face_enrolled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Face Enrolled</span>
                      </>
                    ) : (
                      <>
                        <ScanFace className="h-3.5 w-3.5" />
                        <span>Pending Scan</span>
                      </>
                    )}
                  </span>

                  <span className="text-slate-400">
                    Member ID: <span className="font-mono text-slate-600">{member.id}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              <Edit3 className="h-4 w-4 text-slate-500" />
              <span>Edit Member</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActionMessage({ type: '', text: '' });
                setBillingOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500"
            >
              <CreditCard className="h-4 w-4" />
              <span>Renew / Billing</span>
            </button>
          </div>
        </div>
      </section>

      {/* Subscription & Financials Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Subscription &amp; Financials Summary
            </h2>
          </div>
          {member.subscription_id && (
            <span className="font-mono text-xs text-slate-400">
              Sub ID: {member.subscription_id}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 xl:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Package
            </p>
            <p className="mt-1.5 text-base font-bold text-slate-900">
              {displayValue(member.active_package, 'No Active Package')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Start: {formatDate(member.start_date)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Next Renewal
            </p>
            <p className="mt-1.5 text-base font-bold text-slate-900">
              {formatDate(member.next_renewal)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Validity Remaining
            </p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${getValidityToneClass(
                  validityDays
                )}`}
              >
                {validityDays === null || validityDays === undefined
                  ? '—'
                  : `${validityDays} days`}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Amount
            </p>
            <p className="mt-1.5 text-base font-bold text-slate-900">
              {formatCurrency(member.amount)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Paid Amount
            </p>
            <p className="mt-1.5 text-base font-bold text-emerald-700">
              {formatCurrency(member.paid_amount)}
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              hasPending
                ? 'border-rose-200 bg-rose-50/80'
                : 'border-emerald-200 bg-emerald-50/60'
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                hasPending ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              Pending Balance
            </p>
            <p
              className={`mt-1.5 text-lg font-extrabold ${
                hasPending ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(member.pending_amount ?? 0)}
            </p>
          </div>
        </div>
      </section>

      {/* Personal Details Grid */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <User className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Personal &amp; Contact Details</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField icon={Phone} label="Phone" value={member.phone} />
          <DetailField icon={Mail} label="Email" value={member.email} />
          <DetailField icon={User} label="Gender" value={member.gender} />
          <DetailField
            icon={Calendar}
            label="Date of Birth"
            value={member.date_of_birth ? formatDate(member.date_of_birth) : null}
          />
          <DetailField icon={MapPin} label="District" value={member.district} />
          <DetailField
            icon={ShieldAlert}
            label="Emergency Contact"
            value={member.emergency_contact}
          />
          <DetailField
            icon={Calendar}
            label="Joining Date"
            value={member.joining_date ? formatDate(member.joining_date) : null}
          />
          <DetailField
            icon={Clock}
            label="Last Updated"
            value={member.updated_at ? formatDateTime(member.updated_at) : null}
          />
        </div>
      </section>

      {/* Member Workout Analytics */}
      <MemberWorkoutAnalytics
        logs={attendanceLogs}
        joiningDate={member.joining_date}
        currentStreak={member.current_streak}
      />

      {/* History Tabs */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 pt-4">
          <div className="flex items-center gap-6" role="tablist" aria-label="Member history tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attendance'}
              onClick={() => setActiveTab('attendance')}
              className={`border-b-2 pb-3 text-sm font-bold transition ${
                activeTab === 'attendance'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Attendance History ({attendanceLogs.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'billing'}
              onClick={() => setActiveTab('billing')}
              className={`border-b-2 pb-3 text-sm font-bold transition ${
                activeTab === 'billing'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Subscription &amp; Payment History ({subscriptions.length + payments.length})
            </button>
          </div>
        </div>

        {activeTab === 'attendance' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                      No biometric attendance logs recorded for this member yet.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                        {formatDate(log.attendance_date || log.check_in_at)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                        {formatTime(log.check_in_at)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatTime(log.check_out_at)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                        {formatDurationMinutes(log.duration_minutes)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <StatusBadge
                          variant={getMemberStatusVariant(log.status)}
                          className="capitalize"
                        >
                          {displayValue(log.status, 'logged')}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            {/* Subscriptions List */}
            <div className="p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Subscription Plans ({subscriptions.length})
              </h3>
              {subscriptions.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No subscription records found.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {subscriptions.map((sub) => {
                    const planName =
                      sub.package_name ||
                      sub.plan_name ||
                      plansById[String(sub.plan_id)]?.name ||
                      'Membership Plan';
                    const payable = sub.payable_amount ?? sub.amount;
                    const paid = sub.paid_amount;

                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{planName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDate(sub.start_date)} → {formatDate(sub.end_date || sub.next_renewal)}
                          </p>
                          {paid !== null && paid !== undefined && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Paid: {formatCurrency(paid)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {formatCurrency(payable)}
                          </p>
                          <StatusBadge
                            variant={getMemberStatusVariant(sub.status || 'active')}
                            className="mt-1 capitalize"
                          >
                            {displayValue(sub.status, 'active')}
                          </StatusBadge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payments List */}
            <div className="p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recorded Payments ({payments.length})
              </h3>
              {payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {formatCurrency(pay.amount)}
                          <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                            {displayValue(pay.payment_mode || pay.payment_method || pay.method, 'Payment')}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {formatDate(pay.paid_at || pay.payment_date || pay.created_at)}
                          {pay.notes ? ` • ${pay.notes}` : ''}
                        </p>
                      </div>
                      <StatusBadge
                        variant={getMemberStatusVariant(pay.status || 'paid')}
                        className="shrink-0 capitalize"
                      >
                        {displayValue(pay.status, 'paid')}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Edit Member Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Member Profile"
        subtitle={`PIN #${displayValue(member.device_pin)}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {actionMessage.type === 'error' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {actionMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                value={editForm.full_name}
                onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Gender</label>
              <select
                value={editForm.gender}
                onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Date of Birth</label>
              <input
                type="date"
                value={editForm.date_of_birth}
                onChange={(e) => setEditForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">District</label>
              <input
                type="text"
                value={editForm.district}
                onChange={(e) => setEditForm((p) => ({ ...p, district: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                <option value="pending_biometric">Pending Biometric</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Emergency Contact
              </label>
              <input
                type="text"
                value={editForm.emergency_contact}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, emergency_contact: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Unified Renew / Billing Modal */}
      <RenewBillingModal
        isOpen={billingOpen}
        onClose={() => setBillingOpen(false)}
        member={member}
        onSuccess={handleBillingSuccess}
      />
    </div>
  );
}
