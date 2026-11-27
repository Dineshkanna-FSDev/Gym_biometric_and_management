import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../../components/ui/StatusBadge';
import MemberLink from '../../components/ui/MemberLink';
import { TableRowsSkeleton } from '../../components/ui/LoadingSkeletons';
import {
  displayValue,
  formatDate,
  formatDurationMinutes,
  formatTime,
  getMemberStatusVariant,
  getValidityToneClass,
} from '../../utils/formatters';

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'completed', label: 'Completed' },
  { key: 'active', label: 'Checked In' },
  { key: 'auto_closed', label: 'Auto Closed' },
];

/**
 * Biometric Attendance Logs view (/admin/attendance) backed strictly by
 * `public.attendance_logs` joined with `public.members` (`full_name`, `device_pin`).
 */
export default function Attendance() {
  const outletContext = useOutletContext() || {};
  const globalSearch = (outletContext.globalSearch || '').trim();

  const [logs, setLogs] = useState([]);
  const [validityByMemberId, setValidityByMemberId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localSearch, setLocalSearch] = useState('');

  const fetchAttendanceData = useCallback(async () => {
    let attQuery = supabase
      .from('attendance_logs')
      .select(
        `
        id,
        member_id,
        attendance_date,
        check_in_at,
        check_out_at,
        duration_minutes,
        status,
        members ( id, full_name, device_pin )
      `
      )
      .order('check_in_at', { ascending: false })
      .limit(200);

    if (dateFilter) {
      attQuery = attQuery.eq('attendance_date', dateFilter);
    }

    if (statusFilter !== 'all') {
      attQuery = attQuery.eq('status', statusFilter);
    }

    const [attRes, overviewRes] = await Promise.all([
      attQuery,
      supabase.from('member_overview').select('id, validity_days'),
    ]);

    if (attRes.error) throw attRes.error;

    const validityLookup = overviewRes.error
      ? {}
      : Object.fromEntries(
          (overviewRes.data || []).map((m) => [String(m.id), m.validity_days])
        );

    return {
      logs: attRes.data || [],
      validityLookup,
    };
  }, [dateFilter, statusFilter]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchAttendanceData();
      setLogs(result.logs);
      setValidityByMemberId(result.validityLookup);
    } catch (err) {
      setError(err.message || 'Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  }, [fetchAttendanceData]);

  useEffect(() => {
    let cancelled = false;
    fetchAttendanceData()
      .then((result) => {
        if (cancelled) return;
        setLogs(result.logs);
        setValidityByMemberId(result.validityLookup);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load attendance logs.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAttendanceData]);

  const query = (localSearch || globalSearch).trim().toLowerCase();

  const filteredLogs = logs.filter((log) => {
    if (!query) return true;
    const member = log.members;
    const name = member?.full_name || '';
    const pin = String(member?.device_pin ?? '');
    return name.toLowerCase().includes(query) || pin.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Biometric Attendance
            </h1>
            <StatusBadge variant="success">ZKFace ADMS Sync</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time check-in/check-out records synced from the facial recognition terminal.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAttendance}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by attendance date"
              className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by attendance status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {(dateFilter || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter by member name or PIN..."
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

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && logs.length === 0 ? (
                <TableRowsSkeleton rows={6} cols={7} />
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                    No attendance logs recorded for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const member = log.members;
                  const validityDays = validityByMemberId[String(log.member_id)] ?? null;
                  return (
                    <tr key={log.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div>
                          <MemberLink
                            memberId={log.member_id}
                            name={member?.full_name || `Member #${log.member_id}`}
                          />
                        </div>
                        <div className="font-mono text-xs text-slate-400">
                          PIN {displayValue(member?.device_pin)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {formatDate(log.attendance_date || log.check_in_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {formatTime(log.check_in_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                        {formatTime(log.check_out_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                        {formatDurationMinutes(log.duration_minutes)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${getValidityToneClass(
                            validityDays
                          )}`}
                        >
                          {validityDays === null || validityDays === undefined
                            ? '—'
                            : `${validityDays} days`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <StatusBadge
                          variant={getMemberStatusVariant(log.status)}
                          className="capitalize"
                        >
                          {displayValue(log.status, 'logged')}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
