import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/ui/StatCard';
import MemberLink from '../../components/ui/MemberLink';
import RenewBillingModal from '../../components/billing/RenewBillingModal';
import { KpiGridSkeleton, TableRowsSkeleton } from '../../components/ui/LoadingSkeletons';
import { displayValue, formatCurrency, formatDate } from '../../utils/formatters';

/**
 * Payments & Billing page (/admin/payments) backed strictly by live Supabase
 * `public.payments` joined with `members`, `member_subscriptions`, and `subscription_plans`.
 */
export default function Payments() {
  const outletContext = useOutletContext() || {};
  const globalSearch = (outletContext.globalSearch || '').trim();

  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingTargetMember, setBillingTargetMember] = useState(null);
  const [bannerText, setBannerText] = useState('');

  const fetchPaymentsData = useCallback(async () => {
    const [payRes, memRes] = await Promise.all([
      supabase
        .from('payments')
        .select(
          `
          id,
          member_id,
          subscription_id,
          amount,
          payment_mode,
          payment_date,
          paid_at,
          notes,
          members ( id, full_name, device_pin ),
          member_subscriptions (
            id,
            plan_id,
            subscription_plans ( id, name )
          )
        `
        )
        .order('payment_date', { ascending: false })
        .order('paid_at', { ascending: false })
        .limit(200),
      supabase
        .from('member_overview')
        .select(
          'id, full_name, device_pin, status, active_package, subscription_id, next_renewal, validity_days, amount, paid_amount, pending_amount'
        )
        .order('full_name', { ascending: true }),
    ]);

    if (payRes.error) throw payRes.error;
    if (memRes.error) throw memRes.error;

    return {
      payments: payRes.data || [],
      members: memRes.data || [],
    };
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchPaymentsData();
      setPayments(result.payments);
      setMembers(result.members);
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [fetchPaymentsData]);

  useEffect(() => {
    let cancelled = false;
    fetchPaymentsData()
      .then((result) => {
        if (cancelled) return;
        setPayments(result.payments);
        setMembers(result.members);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load payments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPaymentsData]);

  const memberById = new Map(members.map((m) => [String(m.id), m]));

  async function handleBillingSuccess(result) {
    await loadPayments();
    setBannerText(
      result.type === 'clear_balance'
        ? `Balance payment of ${formatCurrency(result.amountPaid)} recorded.`
        : `Subscription renewed (${result.plan?.name}) successfully.`
    );
  }

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPending = members.reduce((sum, m) => sum + Math.max(0, Number(m.pending_amount || 0)), 0);

  const query = (localSearch || globalSearch).trim().toLowerCase();
  const filteredPayments = payments.filter((p) => {
    if (!query) return true;
    const overviewMember = memberById.get(String(p.member_id));
    const joinedMember = p.members;
    const name = joinedMember?.full_name || overviewMember?.full_name || '';
    const pin = String(joinedMember?.device_pin ?? overviewMember?.device_pin ?? '');
    const mode = p.payment_mode || '';
    const planName = p.member_subscriptions?.subscription_plans?.name || '';
    return (
      name.toLowerCase().includes(query) ||
      pin.toLowerCase().includes(query) ||
      mode.toLowerCase().includes(query) ||
      planName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Payments &amp; Billing
          </h1>
          <p className="text-sm text-slate-500">
            Track collected membership fees, clear pending balances, and process renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBillingTargetMember(null);
              setBillingOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500"
          >
            <CreditCard className="h-4 w-4" />
            <span>Renew / Billing</span>
          </button>
        </div>
      </div>

      {bannerText && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {bannerText}
          </span>
          <button
            type="button"
            onClick={() => setBannerText('')}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Row */}
      {loading && payments.length === 0 ? (
        <KpiGridSkeleton count={3} colsClass="grid-cols-1 gap-4 sm:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Collected"
            value={formatCurrency(totalCollected)}
            subtext={`${payments.length} recorded transactions`}
            icon={IndianRupee}
            accentClass="bg-emerald-50 text-emerald-600"
            valueClass="text-emerald-700"
          />
          <StatCard
            label="Pending Dues"
            value={formatCurrency(totalPending)}
            subtext="Across active & expired plans"
            icon={Wallet}
            accentClass="bg-rose-50 text-rose-600"
            valueClass={totalPending > 0 ? 'text-rose-600' : 'text-slate-900'}
          />
          <StatCard
            label="Filtered Receipts"
            value={filteredPayments.length}
            subtext="Matching current search"
            icon={CreditCard}
            accentClass="bg-indigo-50 text-indigo-600"
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by member name, PIN, plan, or mode..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Payments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && payments.length === 0 ? (
                <TableRowsSkeleton rows={6} cols={7} />
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                    {payments.length === 0
                      ? 'No payments recorded yet.'
                      : 'No payment records match your search.'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const overviewMember = memberById.get(String(pay.member_id));
                  const joinedMember = pay.members;
                  const memberName =
                    joinedMember?.full_name ||
                    overviewMember?.full_name ||
                    `Member #${pay.member_id}`;
                  const devicePin = joinedMember?.device_pin ?? overviewMember?.device_pin;
                  const planName = pay.member_subscriptions?.subscription_plans?.name;

                  return (
                    <tr key={pay.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div>
                          <MemberLink memberId={pay.member_id} name={memberName} />
                        </div>
                        <div className="font-mono text-xs text-slate-400">
                          PIN {displayValue(devicePin)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {displayValue(planName, '—')}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {formatDate(pay.payment_date || pay.paid_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {displayValue(pay.payment_mode, 'Payment')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-500">
                        {displayValue(pay.notes)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-slate-900">
                        {formatCurrency(pay.amount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          disabled={!overviewMember}
                          onClick={() => {
                            setBillingTargetMember(overviewMember || null);
                            setBillingOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40"
                        >
                          <span>Renew / Billing</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Renew / Billing Modal */}
      <RenewBillingModal
        isOpen={billingOpen}
        onClose={() => {
          setBillingOpen(false);
          setBillingTargetMember(null);
        }}
        member={billingTargetMember}
        membersList={members}
        onSuccess={handleBillingSuccess}
      />
    </div>
  );
}
