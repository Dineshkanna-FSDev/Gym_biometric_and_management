import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { DEMO_MEMBERS_OVERVIEW, DEMO_PAYMENTS } from '../../data/demoData';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import MemberLink from '../../components/ui/MemberLink';
import RenewBillingModal from '../../components/billing/RenewBillingModal';
import {
  displayValue,
  formatCurrency,
  formatDate,
  getMemberStatusVariant,
} from '../../utils/formatters';

/**
 * Payments & Billing page (/admin/payments) backed by `payments` and `member_overview`.
 * Uses the unified Renew / Billing modal for both pending balance settlement and renewals.
 */
export default function Payments() {
  const { isDemoMode } = useAuth();
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
    if (isDemoMode || !isSupabaseConfigured || !supabase) {
      return {
        members: DEMO_MEMBERS_OVERVIEW,
        payments: DEMO_PAYMENTS,
      };
    }

    const [payRes, memRes] = await Promise.all([
      supabase.from('payments').select('*').limit(150),
      supabase
        .from('member_overview')
        .select(
          'id, full_name, device_pin, status, active_package, subscription_id, next_renewal, validity_days, amount, paid_amount, pending_amount'
        )
        .order('full_name', { ascending: true }),
    ]);

    if (payRes.error) throw payRes.error;
    if (memRes.error) throw memRes.error;

    const sortedPayments = [...(payRes.data || [])].sort((a, b) => {
      const aTime = Date.parse(a.payment_date || a.paid_at || a.created_at || 0) || 0;
      const bTime = Date.parse(b.payment_date || b.paid_at || b.created_at || 0) || 0;
      return bTime - aTime;
    });

    return {
      payments: sortedPayments,
      members: memRes.data || [],
    };
  }, [isDemoMode]);

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
    if (isDemoMode || !isSupabaseConfigured || !supabase) {
      if (result.type === 'clear_balance') {
        const newPayment = {
          id: `pay-${crypto.randomUUID().slice(0, 6)}`,
          member_id: result.memberId,
          subscription_id: result.subscriptionId,
          amount: result.amountPaid,
          payment_method: result.paymentMethod,
          payment_date: result.paymentDate,
          status: 'paid',
          notes: result.notes || 'Pending balance cleared',
        };
        setPayments((prev) => [newPayment, ...prev]);
        setMembers((prev) =>
          prev.map((m) => {
            if (String(m.id) !== String(result.memberId)) return m;
            const nextPaid = Number(result.nextPaidTotal ?? m.paid_amount ?? 0);
            return {
              ...m,
              paid_amount: nextPaid,
              pending_amount: Math.max(0, Number(m.amount || 0) - nextPaid),
            };
          })
        );
        setBannerText(`Balance payment of ${formatCurrency(result.amountPaid)} recorded.`);
        return;
      }

      if (result.paidAmount > 0) {
        const newPayment = {
          id: `pay-${crypto.randomUUID().slice(0, 6)}`,
          member_id: result.memberId,
          subscription_id: `sub-${crypto.randomUUID().slice(0, 6)}`,
          amount: result.paidAmount,
          payment_method: result.paymentMethod,
          payment_date: result.paymentDate,
          status: result.pendingAmount > 0 ? 'partial' : 'paid',
          notes: result.notes || `${result.plan?.name} renewal`,
        };
        setPayments((prev) => [newPayment, ...prev]);
      }

      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(result.memberId)
            ? {
                ...m,
                status: 'active',
                active_package: result.plan?.name || m.active_package,
                start_date: result.startDate,
                next_renewal: result.endDate,
                validity_days: Number(result.plan?.duration_days || 30),
                amount: result.payableAmount,
                paid_amount: result.paidAmount,
                pending_amount: result.pendingAmount,
              }
            : m
        )
      );
      setBannerText(`Subscription renewed (${result.plan?.name}) successfully.`);
      return;
    }

    await loadPayments();
    setBannerText(
      result.type === 'clear_balance'
        ? `Balance payment of ${formatCurrency(result.amountPaid)} recorded.`
        : `Subscription renewed (${result.plan?.name}) successfully.`
    );
  }

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPending = members.reduce((sum, m) => sum + Number(m.pending_amount || 0), 0);

  const query = (localSearch || globalSearch).trim().toLowerCase();
  const filteredPayments = payments.filter((p) => {
    if (!query) return true;
    const member = memberById.get(String(p.member_id));
    const name = member?.full_name || '';
    const pin = String(member?.device_pin ?? '');
    const method = p.payment_method || p.method || '';
    return (
      name.toLowerCase().includes(query) ||
      pin.toLowerCase().includes(query) ||
      method.toLowerCase().includes(query)
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

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by member name, PIN, or method..."
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
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const member = memberById.get(String(pay.member_id));
                  return (
                    <tr key={pay.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div>
                          <MemberLink
                            memberId={pay.member_id}
                            name={member?.full_name || `Member #${pay.member_id}`}
                          />
                        </div>
                        <div className="font-mono text-xs text-slate-400">
                          PIN {displayValue(member?.device_pin)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {formatDate(pay.payment_date || pay.paid_at || pay.created_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {displayValue(pay.payment_method || pay.method, 'Payment')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-500">
                        {displayValue(pay.notes)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge
                          variant={getMemberStatusVariant(pay.status || 'paid')}
                          className="capitalize"
                        >
                          {displayValue(pay.status, 'paid')}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-slate-900">
                        {formatCurrency(pay.amount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          disabled={!member}
                          onClick={() => {
                            setBillingTargetMember(member || null);
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
