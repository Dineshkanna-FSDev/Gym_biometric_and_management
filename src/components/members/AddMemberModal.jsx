import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Package, User } from 'lucide-react';
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
import { formatCurrency } from '../../utils/formatters';

function buildInitialMemberState(today) {
  return {
    full_name: '',
    phone: '',
    email: '',
    gender: 'Male',
    date_of_birth: '',
    district: '',
    emergency_contact: '',
    joining_date: today,
  };
}

/**
 * Unified "Add Member + Subscription + Payment" onboarding modal.
 * Performs atomic 3-step creation across members -> member_subscriptions -> payments.
 */
export default function AddMemberModal({ isOpen, onClose, onSuccess }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Member"
      subtitle="Onboard member, assign package, and record initial payment in one step"
      maxWidthClass="max-w-2xl"
    >
      {isOpen && <AddMemberForm onClose={onClose} onSuccess={onSuccess} />}
    </Modal>
  );
}

function AddMemberForm({ onClose, onSuccess }) {
  const { isDemoMode } = useAuth();

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [memberForm, setMemberForm] = useState(() => buildInitialMemberState(getTodayISO()));
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [startDate, setStartDate] = useState(() => getTodayISO());
  const [endDate, setEndDate] = useState('');
  const [payableAmount, setPayableAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const [startManuallyEdited, setStartManuallyEdited] = useState(false);
  const [paidManuallyEdited, setPaidManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const today = getTodayISO();

    ensureAndFetchSubscriptionPlans(isDemoMode)
      .then((loadedPlans) => {
        if (cancelled) return;
        setPlans(loadedPlans);
        if (loadedPlans.length > 0) {
          const first = loadedPlans[0];
          setSelectedPlanId(String(first.id));
          setEndDate(addDaysToISO(today, first.duration_days));
          setPayableAmount(String(first.price));
          setPaidAmount(String(first.price));
        }
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
  }, [isDemoMode]);

  const selectedPlan = plans.find((p) => String(p.id) === String(selectedPlanId)) || null;
  const payableNum = Math.max(0, Number(payableAmount || 0));
  const paidNum = Math.max(0, Number(paidAmount || 0));
  const pendingBalance = Math.max(0, payableNum - paidNum);

  function handleJoiningDateChange(nextJoiningDate) {
    setMemberForm((prev) => ({ ...prev, joining_date: nextJoiningDate }));
    if (!startManuallyEdited) {
      setStartDate(nextJoiningDate);
      if (selectedPlan) {
        setEndDate(addDaysToISO(nextJoiningDate, selectedPlan.duration_days));
      }
    }
  }

  function handlePlanChange(nextPlanId) {
    setSelectedPlanId(nextPlanId);
    const plan = plans.find((p) => String(p.id) === String(nextPlanId));
    if (!plan) return;

    const effectiveStart = startDate || memberForm.joining_date || getTodayISO();
    setEndDate(addDaysToISO(effectiveStart, plan.duration_days));
    const nextPrice = String(plan.price ?? 0);
    setPayableAmount(nextPrice);
    if (!paidManuallyEdited) {
      setPaidAmount(nextPrice);
    }
  }

  function handleStartDateChange(nextStart) {
    setStartManuallyEdited(true);
    setStartDate(nextStart);
    if (selectedPlan) {
      setEndDate(addDaysToISO(nextStart, selectedPlan.duration_days));
    }
  }

  function handlePayableChange(nextPayable) {
    setPayableAmount(nextPayable);
    if (!paidManuallyEdited) {
      setPaidAmount(nextPayable);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!memberForm.full_name.trim() || !memberForm.phone.trim()) {
      setError('Full name and phone number are required.');
      return;
    }
    if (!selectedPlanId || !startDate || !endDate) {
      setError('Please select a subscription package and valid dates.');
      return;
    }

    setSubmitting(true);

    try {
      const today = getTodayISO();
      const memberPayload = {
        full_name: memberForm.full_name.trim(),
        phone: memberForm.phone.trim(),
        email: memberForm.email.trim() || null,
        gender: memberForm.gender || null,
        date_of_birth: memberForm.date_of_birth || null,
        district: memberForm.district.trim() || null,
        emergency_contact: memberForm.emergency_contact.trim() || null,
        joining_date: memberForm.joining_date || today,
        status: 'active',
        face_enrolled: false,
      };

      if (isDemoMode || !isSupabaseConfigured || !supabase) {
        const newId = `mem-${crypto.randomUUID().slice(0, 6)}`;
        const generatedPin = Math.floor(500 + Math.random() * 499);
        const subId = `sub-${crypto.randomUUID().slice(0, 6)}`;

        const demoOverviewRecord = {
          ...memberPayload,
          id: newId,
          device_pin: generatedPin,
          updated_at: new Date().toISOString(),
          subscription_id: subId,
          active_package: selectedPlan?.name || 'Membership',
          start_date: startDate,
          next_renewal: endDate,
          validity_days: Number(selectedPlan?.duration_days || 30),
          amount: payableNum,
          paid_amount: paidNum,
          pending_amount: pendingBalance,
        };

        onSuccess?.({
          memberId: newId,
          devicePin: generatedPin,
          fullName: memberPayload.full_name,
          demoRecord: demoOverviewRecord,
        });
        onClose();
        return;
      }

      // Step 1: Insert into public.members and retrieve id + auto-generated device_pin
      const { data: createdMember, error: memberErr } = await supabase
        .from('members')
        .insert(memberPayload)
        .select('id, device_pin')
        .single();

      if (memberErr) throw memberErr;

      // Step 2: Insert into public.member_subscriptions
      const { data: createdSub, error: subErr } = await supabase
        .from('member_subscriptions')
        .insert({
          member_id: createdMember.id,
          plan_id: selectedPlan.id,
          start_date: startDate,
          end_date: endDate,
          payable_amount: payableNum,
          paid_amount: paidNum,
        })
        .select('id')
        .single();

      if (subErr) {
        // Roll back Step 1 member insert to prevent orphaned member records
        await supabase.from('members').delete().eq('id', createdMember.id);
        throw subErr;
      }

      // Step 3: Insert into public.payments if paid_amount > 0
      if (paidNum > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          member_id: createdMember.id,
          subscription_id: createdSub.id,
          amount: paidNum,
          payment_method: paymentMethod,
          payment_date: today,
          notes: notes.trim() || null,
        });

        if (payErr) throw payErr;
      }

      onSuccess?.({
        memberId: createdMember.id,
        devicePin: createdMember.device_pin,
        fullName: memberPayload.full_name,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to complete member onboarding.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Section 1: Member Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Member Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={memberForm.full_name}
                onChange={(e) => setMemberForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g., Arjun Mehta"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={memberForm.phone}
                onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={memberForm.email}
                onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="member@example.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Gender</label>
              <select
                value={memberForm.gender}
                onChange={(e) => setMemberForm((p) => ({ ...p, gender: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Date of Birth</label>
              <input
                type="date"
                value={memberForm.date_of_birth}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, date_of_birth: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">District</label>
              <input
                type="text"
                value={memberForm.district}
                onChange={(e) => setMemberForm((p) => ({ ...p, district: e.target.value }))}
                placeholder="e.g., Anna Nagar"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Emergency Contact
              </label>
              <input
                type="text"
                value={memberForm.emergency_contact}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, emergency_contact: e.target.value }))
                }
                placeholder="+91 98765 00000"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Joining Date</label>
              <input
                type="date"
                required
                value={memberForm.joining_date}
                onChange={(e) => handleJoiningDateChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Package Details */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
            <Package className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Package Details <span className="text-rose-500">*</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Subscription Package <span className="text-rose-500">*</span>
              </label>
              <select
                required
                disabled={plansLoading}
                value={selectedPlanId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
              >
                {plansLoading ? (
                  <option value="">Loading packages...</option>
                ) : plans.length === 0 ? (
                  <option value="">No active packages available</option>
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
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                End Date {selectedPlan ? `(${selectedPlan.duration_days} days)` : ''}
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Payable Amount (₹) — editable for discounts
              </label>
              <input
                type="number"
                min="0"
                required
                value={payableAmount}
                onChange={(e) => handlePayableChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Payment Details */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Payment Details <span className="text-rose-500">*</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Paid Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={paidAmount}
                onChange={(e) => {
                  setPaidManuallyEdited(true);
                  setPaidAmount(e.target.value);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Pending Balance
              </label>
              <div
                className={`mt-1 flex h-[38px] items-center rounded-xl border px-3 text-sm font-bold ${
                  pendingBalance > 0
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {formatCurrency(pendingBalance)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional receipt, discount, or balance follow-up note"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-400">
            Device PIN is auto-assigned and pushed to ZKFace upon subscription creation.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || plansLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Create Member &amp; Activate</span>
            </button>
          </div>
        </div>
      </form>
  );
}
