import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ScanFace,
  Search,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../../components/ui/StatusBadge';
import MemberLink from '../../components/ui/MemberLink';
import AddMemberModal from '../../components/members/AddMemberModal';
import RenewBillingModal from '../../components/billing/RenewBillingModal';
import { TableRowsSkeleton } from '../../components/ui/LoadingSkeletons';
import {
  displayValue,
  formatCurrency,
  formatDate,
  getMemberStatusVariant,
  getValidityToneClass,
} from '../../utils/formatters';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring Soon' },
  { key: 'expired', label: 'Expired' },
];

/**
 * Members Directory page (/admin/members) backed strictly by `public.member_overview`.
 */
export default function Members() {
  const outletContext = useOutletContext() || {};
  const globalSearch = (outletContext.globalSearch || '').trim();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localSearch, setLocalSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [billingMember, setBillingMember] = useState(null);
  const [banner, setBanner] = useState(null);

  const fetchMembersData = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('member_overview')
      .select('*')
      .order('full_name', { ascending: true });

    if (fetchError) throw fetchError;
    return data || [];
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchMembersData();
      setMembers(rows);
    } catch (err) {
      setError(err.message || 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [fetchMembersData]);

  useEffect(() => {
    let cancelled = false;
    fetchMembersData()
      .then((rows) => {
        if (cancelled) return;
        setMembers(rows);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load members.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMembersData]);

  async function handleOnboardingSuccess(result) {
    await loadMembers();
    setBanner({
      memberId: result.memberId,
      memberName: result.fullName,
      text: `Member onboarded (Assigned PIN #${result.devicePin ?? '—'}) and pushed for biometric sync.`,
    });
  }

  async function handleBillingSuccess(result) {
    await loadMembers();
    setBanner({
      memberId: result.memberId,
      text:
        result.type === 'clear_balance'
          ? `Recorded balance payment of ${formatCurrency(result.amountPaid)}.`
          : `Renewed package (${result.plan?.name}) successfully.`,
    });
  }

  const query = (localSearch || globalSearch).trim().toLowerCase();

  const filteredMembers = members.filter((m) => {
    if (statusFilter === 'active') {
      if (String(m.status || '').toLowerCase() !== 'active') return false;
    } else if (statusFilter === 'expiring') {
      const days = Number(m.validity_days);
      if (m.validity_days === null || m.validity_days === undefined || days < 0 || days > 5) {
        return false;
      }
    } else if (statusFilter === 'expired') {
      const isExpired =
        String(m.status || '').toLowerCase() === 'expired' ||
        (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) < 0);
      if (!isExpired) return false;
    }

    if (!query) return true;
    return (
      (m.full_name || '').toLowerCase().includes(query) ||
      (m.phone || '').toLowerCase().includes(query) ||
      String(m.device_pin ?? '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Members Directory
          </h1>
          <p className="text-sm text-slate-500">
            Onboard members, manage biometric PINs, and handle renewals or pending balances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadMembers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {banner.memberName && (
              <MemberLink
                memberId={banner.memberId}
                name={banner.memberName}
                className="text-emerald-900"
              />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-bold text-emerald-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by name, phone, or PIN..."
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Face Sync</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && members.length === 0 ? (
                <TableRowsSkeleton rows={6} cols={8} />
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                    {members.length === 0
                      ? 'No members registered yet.'
                      : 'No members match the selected filter.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div>
                        <MemberLink memberId={m.id} name={m.full_name} />
                      </div>
                      <div className="font-mono text-xs text-slate-400">
                        PIN {displayValue(m.device_pin)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                      {displayValue(m.phone)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {displayValue(m.active_package, 'No Plan')}
                      </div>
                      <div className="text-xs text-slate-400">
                        Renewal: {formatDate(m.next_renewal)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${getValidityToneClass(
                          m.validity_days
                        )}`}
                      >
                        {m.validity_days === null || m.validity_days === undefined
                          ? '—'
                          : `${m.validity_days} days`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {m.face_enrolled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <ScanFace className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge
                        variant={getMemberStatusVariant(m.status)}
                        className="capitalize"
                      >
                        {displayValue(m.status, 'unknown')}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold">
                      {Number(m.pending_amount || 0) > 0 ? (
                        <span className="text-rose-600">{formatCurrency(m.pending_amount)}</span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setBillingMember(m)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Renew / Billing</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Add Member + Subscription + Payment Modal */}
      <AddMemberModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />

      {/* Unified Renew / Billing Modal */}
      <RenewBillingModal
        isOpen={Boolean(billingMember)}
        onClose={() => setBillingMember(null)}
        member={billingMember}
        onSuccess={handleBillingSuccess}
      />
    </div>
  );
}
