import { useEffect, useState } from 'react';
import { CreditCard, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  PAYMENT_METHODS,
  addDaysToISO,
  ensureAndFetchSubscriptionPlans,
  formatPlanOptionLabel,
  getTodayISO,
} from '../../lib/subscriptionPlans';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import {
  displayValue,
  formatCurrency,
  formatDate,
  getMemberStatusVariant,
} from '../../utils/formatters';

function resolveDefaultMode(targetMember) {
  if (!targetMember) return 'renew';
  const pending = Number(targetMember.pending_amount || 0);
  const statusNorm = String(targetMember.status || '').toLowerCase();
  const isExpired =
    statusNorm === 'expired' ||
    (targetMember.validity_days !== null &&
      targetMember.validity_days !== undefined &&
      Number(targetMember.validity_days) <= 0);

  if (pending > 0 && targetMember.subscription_id && !isExpired) {
    return 'clear_balance';
  }
  return 'renew';
}

function resolveRenewStartDate(targetMember, today) {
  if (!targetMember?.next_renewal) return today;
  const statusNorm = String(targetMember.status || '').toLowerCase();
  const nextRenewalISO = String(targetMember.next_renewal).slice(0, 10);
  if (statusNorm !== 'expired' && nextRenewalISO >= today) {
    return addDaysToISO(nextRenewalISO, 1);
  }
  return today;
}

/**
 * Unified "Renew / Billing" modal handling both:
 * 1. "Clear Pending Balance" (collects due on active subscription + updates member_subscriptions.paid_amount)
 * 2. "Renew / Change Package" (creates new member_subscriptions row + logs payment)
 */
export default function RenewBillingModal({
  isOpen,
  onClose,
  member = null,
  membersList = [],
  onSuccess,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Renew / Billing"
      subtitle="Clear pending subscription balance or assign a new package in one workflow"
      maxWidthClass="max-w-xl"
    >
      {isOpen && (
        <RenewBillingForm
          onClose={onClose}
          member={member}
          membersList={membersList}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}

function RenewBillingForm({ onClose, member, membersList, onSuccess }) {
  const { isDemoMode } = useAuth();

  const [initialMember] = useState(
    () =>
      member ||
      membersList.find((m) => Number(m.pending_amount || 0) > 0) ||
      membersList[0] ||
      null
  );

  const [selectedMemberId, setSelectedMemberId] = useState(
    initialMember ? String(initialMember.id) : ''
  );
  const [mode, setMode] = useState(() => resolveDefaultMode(initialMember));

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Clear Balance fields
  const [balancePayAmount, setBalancePayAmount] = useState('');
  const [balanceMethod, setBalanceMethod] = useState('UPI');
  const [balanceDate, setBalanceDate] = useState(() => getTodayISO());
  const [balanceNotes, setBalanceNotes] = useState('');

  // Renew / Change Package fields
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [renewStartDate, setRenewStartDate] = useState(() =>
    resolveRenewStartDate(initialMember, getTodayISO())
  );
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewPayable, setRenewPayable] = useState('');
  const [renewPaid, setRenewPaid] = useState('');
  const [renewMethod, setRenewMethod] = useState('UPI');
  const [renewNotes, setRenewNotes] = useState('');
  const [renewPaidManuallyEdited, setRenewPaidManuallyEdited] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeMember =
    member ||
    membersList.find((m) => String(m.id) === String(selectedMemberId)) ||
    null;

  function syncFormsForMember(targetMember, loadedPlans) {
    const today = getTodayISO();
    const nextMode = resolveDefaultMode(targetMember);
    setMode(nextMode);

    // Clear balance defaults
    const pending = Math.max(0, Number(targetMember?.pending_amount || 0));
    setBalancePayAmount(pending > 0 ? String(pending) : '');
    setBalanceMethod('UPI');
    setBalanceDate(today);
    setBalanceNotes('');

    // Renew defaults
    const start = resolveRenewStartDate(targetMember, today);
    setRenewStartDate(start);
    setRenewMethod('UPI');
    setRenewNotes('');
    setRenewPaidManuallyEdited(false);

    const matchedPlan =
      loadedPlans.find(
        (p) =>
          String(p.name || '').toLowerCase() ===
          String(targetMember?.active_package || '').toLowerCase()
      ) || loadedPlans[0];

    if (matchedPlan) {
      setSelectedPlanId(String(matchedPlan.id));
      setRenewEndDate(addDaysToISO(start, matchedPlan.duration_days));
      setRenewPayable(String(matchedPlan.price));
      setRenewPaid(String(matchedPlan.price));
    } else {
      setSelectedPlanId('');
      setRenewEndDate(addDaysToISO(start, 30));
      setRenewPayable('');
      setRenewPaid('');
    }
  }

  useEffect(() => {
    let cancelled = false;

    ensureAndFetchSubscriptionPlans(isDemoMode)
      .then((loadedPlans) => {
        if (cancelled) return;
        setPlans(loadedPlans);
        syncFormsForMember(initialMember, loadedPlans);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load subscription packages.');
        }
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, initialMember]);

  function handleMemberDropdownChange(nextId) {
    setSelectedMemberId(nextId);
    setError('');
    const nextMember = membersList.find((m) => String(m.id) === String(nextId)) || null;
    syncFormsForMember(nextMember, plans);
  }

  function handleRenewPlanChange(nextPlanId) {
    setSelectedPlanId(nextPlanId);
    const plan = plans.find((p) => String(p.id) === String(nextPlanId));
    if (!plan) return;
    const effectiveStart = renewStartDate || getTodayISO();
    setRenewEndDate(addDaysToISO(effectiveStart, plan.duration_days));
    const nextPrice = String(plan.price ?? 0);
    setRenewPayable(nextPrice);
    if (!renewPaidManuallyEdited) {
      setRenewPaid(nextPrice);
    }
  }

  function handleRenewStartChange(nextStart) {
    setRenewStartDate(nextStart);
    const plan = plans.find((p) => String(p.id) === String(selectedPlanId));
    if (plan) {
      setRenewEndDate(addDaysToISO(nextStart, plan.duration_days));
    }
  }

  const currentPending = Math.max(0, Number(activeMember?.pending_amount || 0));
  const canClearBalance = Boolean(activeMember?.subscription_id) && currentPending > 0;

  const renewPayableNum = Math.max(0, Number(renewPayable || 0));
  const renewPaidNum = Math.max(0, Number(renewPaid || 0));
  const renewPendingBalance = Math.max(0, renewPayableNum - renewPaidNum);
  const selectedPlan = plans.find((p) => String(p.id) === String(selectedPlanId)) || null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!activeMember?.id) {
      setError('Please select a member.');
      return;
    }

    setSubmitting(true);

    try {
      const today = getTodayISO();

      if (mode === 'clear_balance') {
        const payAmt = Number(balancePayAmount);
        if (!activeMember.subscription_id) {
          throw new Error('No active subscription found to apply balance payment.');
        }
        if (!payAmt || payAmt <= 0) {
          throw new Error('Please enter a payment amount greater than zero.');
        }

        const nextPaidTotal = Number(activeMember.paid_amount || 0) + payAmt;

        if (isDemoMode || !isSupabaseConfigured || !supabase) {
          onSuccess?.({
            type: 'clear_balance',
            memberId: activeMember.id,
            subscriptionId: activeMember.subscription_id,
            amountPaid: payAmt,
            paymentMethod: balanceMethod,
            paymentDate: balanceDate || today,
            notes: balanceNotes.trim() || null,
            nextPaidTotal,
          });
          onClose();
          return;
        }

        const { error: payErr } = await supabase.from('payments').insert({
          member_id: activeMember.id,
          subscription_id: activeMember.subscription_id,
          amount: payAmt,
          payment_method: balanceMethod,
          payment_date: balanceDate || today,
          notes: balanceNotes.trim() || null,
        });
        if (payErr) throw payErr;

        const { error: subErr } = await supabase
          .from('member_subscriptions')
          .update({ paid_amount: nextPaidTotal })
          .eq('id', activeMember.subscription_id);
        if (subErr) throw subErr;

        onSuccess?.({
          type: 'clear_balance',
          memberId: activeMember.id,
          amountPaid: payAmt,
        });
        onClose();
        return;
      }

      // Mode: Renew / Change Package
      if (!selectedPlan || !renewStartDate || !renewEndDate) {
        throw new Error('Please select a package and valid start/end dates.');
      }

      if (isDemoMode || !isSupabaseConfigured || !supabase) {
        onSuccess?.({
          type: 'renew',
          memberId: activeMember.id,
          plan: selectedPlan,
          startDate: renewStartDate,
          endDate: renewEndDate,
          payableAmount: renewPayableNum,
          paidAmount: renewPaidNum,
          pendingAmount: renewPendingBalance,
          paymentMethod: renewMethod,
          paymentDate: today,
          notes: renewNotes.trim() || null,
        });
        onClose();
        return;
      }

      const { data: createdSub, error: subErr } = await supabase
        .from('member_subscriptions')
        .insert({
          member_id: activeMember.id,
          plan_id: selectedPlan.id,
          start_date: renewStartDate,
          end_date: renewEndDate,
          payable_amount: renewPayableNum,
          paid_amount: renewPaidNum,
        })
        .select('id')
        .single();

      if (subErr) throw subErr;

      if (renewPaidNum > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          member_id: activeMember.id,
          subscription_id: createdSub.id,
          amount: renewPaidNum,
          payment_method: renewMethod,
          payment_date: today,
          notes: renewNotes.trim() || null,
        });
        if (payErr) throw payErr;
      }

      onSuccess?.({
        type: 'renew',
        memberId: activeMember.id,
        plan: selectedPlan,
        amountPaid: renewPaidNum,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to process billing update.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Member Selector (if opened without a pre-selected member) */}
        {!member ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700">Select Member</label>
            <select
              required
              value={selectedMemberId}
              onChange={(e) => handleMemberDropdownChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Choose a member...</option>
              {membersList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} (PIN {displayValue(m.device_pin)})
                  {Number(m.pending_amount || 0) > 0
                    ? ` — Due ${formatCurrency(m.pending_amount)}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {displayValue(activeMember?.full_name)}
              </p>
              <p className="text-xs text-slate-500">
                PIN {displayValue(activeMember?.device_pin)} •{' '}
                {displayValue(activeMember?.active_package, 'No active plan')}
              </p>
            </div>
            <StatusBadge
              variant={getMemberStatusVariant(activeMember?.status)}
              className="shrink-0 capitalize"
            >
              {displayValue(activeMember?.status, 'unknown')}
            </StatusBadge>
          </div>
        )}

        {/* Mode Switch */}
        <div
          className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="Billing mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'clear_balance'}
            disabled={!canClearBalance}
            onClick={() => {
              setError('');
              setMode('clear_balance');
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              mode === 'clear_balance'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Clear Pending Balance</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'renew'}
            onClick={() => {
              setError('');
              setMode('renew');
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              mode === 'renew'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Renew / Change Package</span>
          </button>
        </div>

        {mode === 'clear_balance' ? (
          <div className="space-y-4">
            {/* Active Subscription Financial Summary */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Current Plan
                </p>
                <p className="mt-1 text-xs font-bold text-slate-900">
                  {displayValue(activeMember?.active_package, '—')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Payable
                </p>
                <p className="mt-1 text-xs font-bold text-slate-900">
                  {formatCurrency(activeMember?.amount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Already Paid
                </p>
                <p className="mt-1 text-xs font-bold text-emerald-700">
                  {formatCurrency(activeMember?.paid_amount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">
                  Remaining Due
                </p>
                <p className="mt-1 text-sm font-extrabold text-rose-700">
                  {formatCurrency(currentPending)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentPending > 0 ? currentPending : undefined}
                  required
                  value={balancePayAmount}
                  onChange={(e) => setBalancePayAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Method
                </label>
                <select
                  value={balanceMethod}
                  onChange={(e) => setBalanceMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={balanceDate}
                  onChange={(e) => setBalanceDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={balanceNotes}
                  onChange={(e) => setBalanceNotes(e.target.value)}
                  placeholder="Optional receipt reference"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMember?.next_renewal && (
              <p className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800">
                Current renewal date:{' '}
                <span className="font-bold">{formatDate(activeMember.next_renewal)}</span>. Start
                date is auto-set to{' '}
                <span className="font-bold">{formatDate(renewStartDate)}</span>.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Package
                </label>
                <select
                  required
                  disabled={plansLoading}
                  value={selectedPlanId}
                  onChange={(e) => handleRenewPlanChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                >
                  {plansLoading ? (
                    <option value="">Loading packages...</option>
                  ) : (
                    plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {formatPlanOptionLabel(plan)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Start Date</label>
                <input
                  type="date"
                  required
                  value={renewStartDate}
                  onChange={(e) => handleRenewStartChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  End Date {selectedPlan ? `(${selectedPlan.duration_days} days)` : ''}
                </label>
                <input
                  type="date"
                  required
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payable Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={renewPayable}
                  onChange={(e) => {
                    setRenewPayable(e.target.value);
                    if (!renewPaidManuallyEdited) setRenewPaid(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Paid Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={renewPaid}
                  onChange={(e) => {
                    setRenewPaidManuallyEdited(true);
                    setRenewPaid(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Pending Balance
                </label>
                <div
                  className={`mt-1 flex h-[38px] items-center rounded-xl border px-3 text-sm font-bold ${
                    renewPendingBalance > 0
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {formatCurrency(renewPendingBalance)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Method
                </label>
                <select
                  value={renewMethod}
                  onChange={(e) => setRenewMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  placeholder="Optional renewal or payment note"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || plansLoading || !activeMember}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            <span>
              {mode === 'clear_balance' ? 'Record Balance Payment' : 'Confirm Renewal & Payment'}
            </span>
          </button>
        </div>
      </form>
  );
}
