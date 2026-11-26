import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Cake,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Play,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';

function formatTodayDDMMYYYY() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const KPI_CARDS = [
  {
    label: 'Total Members',
    value: 248,
    subtext: '+14 this month',
    icon: Users,
    accentClass: 'bg-indigo-50 text-indigo-600',
  },
  {
    label: 'Male',
    value: 164,
    subtext: '66% of active base',
    icon: Users,
    accentClass: 'bg-sky-50 text-sky-600',
  },
  {
    label: 'Female',
    value: 84,
    subtext: '34% of active base',
    icon: Users,
    accentClass: 'bg-pink-50 text-pink-600',
  },
  {
    label: 'Today Present',
    value: 112,
    subtext: 'Synced via ZKFace V4.0',
    icon: UserCheck,
    accentClass: 'bg-emerald-50 text-emerald-600',
    valueClass: 'text-emerald-700',
  },
  {
    label: 'Today Absent',
    value: 136,
    subtext: 'Not punched in yet',
    icon: UserMinus,
    accentClass: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'Expired Members',
    value: 19,
    subtext: 'Needs renewal follow-up',
    icon: UserX,
    accentClass: 'bg-rose-50 text-rose-600',
    valueClass: 'text-rose-600',
  },
];

const TODAY_ATTENDANCE = [
  {
    code: 'SN342',
    name: 'Karthik Rajan',
    checkIn: '06:14 AM',
    checkOut: '07:32 AM',
    validityDays: 42,
    pendingAmount: 0,
  },
  {
    code: 'SN289',
    name: 'Priya Nair',
    checkIn: '06:45 AM',
    checkOut: '08:05 AM',
    validityDays: 4,
    pendingAmount: 500,
  },
  {
    code: 'SN194',
    name: 'Vikram Deshmukh',
    checkIn: '07:10 AM',
    checkOut: '—',
    validityDays: -3,
    pendingAmount: 2499,
  },
  {
    code: 'SN415',
    name: 'Sneha Kulkarni',
    checkIn: '07:28 AM',
    checkOut: '08:40 AM',
    validityDays: 88,
    pendingAmount: 0,
  },
  {
    code: 'SN118',
    name: 'Arjun Sharma',
    checkIn: '08:02 AM',
    checkOut: '—',
    validityDays: -7,
    pendingAmount: 1500,
  },
  {
    code: 'SN367',
    name: 'Divya Menon',
    checkIn: '08:19 AM',
    checkOut: '09:15 AM',
    validityDays: 19,
    pendingAmount: 0,
  },
];

const EXPIRE_RENEWAL_LIST = [
  { name: 'Rohan Verma', code: 'SN210', date: '27-11-2026', badge: 'In 2 days', variant: 'warning' },
  { name: 'Priya Nair', code: 'SN289', date: '29-11-2026', badge: 'In 4 days', variant: 'warning' },
  { name: 'Siddharth Rao', code: 'SN304', date: '01-12-2026', badge: 'In 6 days', variant: 'info' },
  { name: 'Meera Krishnan', code: 'SN331', date: '03-12-2026', badge: 'In 8 days', variant: 'info' },
  { name: 'Nikhil Bansal', code: 'SN275', date: '05-12-2026', badge: 'In 10 days', variant: 'neutral' },
];

const EXPIRED_MEMBERSHIP_LIST = [
  { name: 'Vikram Deshmukh', code: 'SN194', date: '22-11-2026', badge: '3 days ago', variant: 'danger' },
  { name: 'Ananya Gupta', code: 'SN162', date: '20-11-2026', badge: '5 days ago', variant: 'danger' },
  { name: 'Arjun Sharma', code: 'SN118', date: '18-11-2026', badge: '7 days ago', variant: 'danger' },
  { name: 'Farhan Ali', code: 'SN144', date: '14-11-2026', badge: '11 days ago', variant: 'danger' },
  { name: 'Kaveri Iyer', code: 'SN098', date: '09-11-2026', badge: '16 days ago', variant: 'danger' },
];

const UPCOMING_BIRTHDAYS = [
  { name: 'Sneha Kulkarni', date: '26-11-1997', badge: 'In 1 day', variant: 'info' },
  { name: 'Karthik Rajan', date: '28-11-1995', badge: 'In 3 days', variant: 'info' },
  { name: 'Divya Menon', date: '30-11-1999', badge: 'In 5 days', variant: 'neutral' },
  { name: 'Rahul Subramanian', date: '02-12-1993', badge: 'In 7 days', variant: 'neutral' },
];

/**
 * Reusable scrollable alert list card for renewal, expired, and birthday widgets.
 */
function MemberAlertListCard({ title, icon: Icon, iconClass, items, emptyText, showCode = true }) {
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

      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 px-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div
              key={`${item.name}-${item.code ?? item.date}`}
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {item.name}
                  {showCode && item.code && (
                    <span className="ml-1.5 font-mono text-xs font-medium text-slate-400">
                      | {item.code}
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
    </section>
  );
}

/**
 * Admin Dashboard overview with 6 KPI cards, live attendance preview table,
 * renewal/expiry/birthday panels, and WhatsApp notification trigger.
 */
export default function Dashboard() {
  const outletContext = useOutletContext() || {};
  const globalSearch = (outletContext.globalSearch || '').trim().toLowerCase();

  const [notificationState, setNotificationState] = useState('idle'); // 'idle' | 'sent'

  const todayFormatted = formatTodayDDMMYYYY();

  const filteredAttendance = TODAY_ATTENDANCE.filter((row) => {
    if (!globalSearch) return true;
    return (
      row.name.toLowerCase().includes(globalSearch) ||
      row.code.toLowerCase().includes(globalSearch)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Daily gym occupancy, biometric attendance punches, and subscription health.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          ZKFace V4.0 Online
        </span>
      </div>

      {/* Top KPI Row (6 Stat Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPI_CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

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
                Real-time check-ins with subscription validity &amp; dues
              </p>
            </div>
            <StatusBadge variant="info">{filteredAttendance.length} logs</StatusBadge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Check In</th>
                  <th className="px-4 py-3">Check Out</th>
                  <th className="px-4 py-3">Validity Days</th>
                  <th className="px-5 py-3 text-right">Pending Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                      No attendance records match &ldquo;{outletContext.globalSearch}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((row) => {
                    const isExpired = row.validityDays < 0;
                    const isLow = row.validityDays >= 0 && row.validityDays <= 7;

                    return (
                      <tr key={row.code} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="font-mono text-xs text-slate-400">{row.code}</div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                          {row.checkIn}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                          {row.checkOut}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                : isLow
                                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            }`}
                          >
                            {row.validityDays} days
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right font-semibold">
                          {row.pendingAmount > 0 ? (
                            <span className="text-rose-600">
                              ₹{row.pendingAmount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Card — Expire Renewal */}
        <div className="lg:col-span-5">
          <MemberAlertListCard
            title="Expire Renewal"
            icon={CalendarClock}
            iconClass="bg-amber-50 text-amber-600"
            items={EXPIRE_RENEWAL_LIST}
            emptyText="No upcoming renewals in the next 10 days."
          />
        </div>
      </div>

      {/* Bottom Section (2-Column Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MemberAlertListCard
          title="Expired Membership"
          icon={AlertTriangle}
          iconClass="bg-rose-50 text-rose-600"
          items={EXPIRED_MEMBERSHIP_LIST}
          emptyText="No expired memberships."
        />

        <MemberAlertListCard
          title="Upcoming Birthday"
          icon={Cake}
          iconClass="bg-indigo-50 text-indigo-600"
          items={UPCOMING_BIRTHDAYS}
          emptyText="No upcoming birthdays this week."
          showCode={false}
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
                  {notificationState === 'sent' ? 'Batch Queued (10)' : 'WhatsApp Reminders Ready'}
                </StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {notificationState === 'sent'
                  ? 'WhatsApp expiry & renewal reminders have been queued for 5 expiring and 5 expired members.'
                  : 'Send automated WhatsApp membership renewal reminders to members expiring within 7 days or recently expired.'}
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
