import { addDaysToISO, getTodayISO, REQUIRED_SUBSCRIPTION_PLANS } from '../lib/subscriptionPlans';

export const DATE_RANGE_OPTIONS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'year', label: 'This Year' },
];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const OPERATING_HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 05:00 to 22:00

const IST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/**
 * Resolves inclusive YYYY-MM-DD start/end bounds and day count for a range key.
 */
export function getAnalyticsDateWindow(rangeKey) {
  const endISO = getTodayISO();
  const option = DATE_RANGE_OPTIONS.find((o) => o.key === rangeKey) || DATE_RANGE_OPTIONS[1];

  if (rangeKey === '7d') {
    return { key: '7d', label: option.label, startISO: addDaysToISO(endISO, -6), endISO, daysCount: 7 };
  }
  if (rangeKey === '90d') {
    return { key: '90d', label: option.label, startISO: addDaysToISO(endISO, -89), endISO, daysCount: 90 };
  }
  if (rangeKey === 'year') {
    const yearStart = `${endISO.slice(0, 4)}-01-01`;
    const diffMs = Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${yearStart}T00:00:00Z`);
    const daysCount = Math.max(1, Math.floor(diffMs / 86400000) + 1);
    return { key: 'year', label: option.label, startISO: yearStart, endISO, daysCount };
  }

  return { key: '30d', label: 'Last 30 Days', startISO: addDaysToISO(endISO, -29), endISO, daysCount: 30 };
}

/**
 * Extracts IST date (YYYY-MM-DD), weekday ('Mon'..'Sun'), and hour (0..23) from an ISO timestamp.
 */
export function toISTParts(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const parts = IST_FORMATTER.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    dateISO: `${map.year}-${map.month}-${map.day}`,
    weekday: map.weekday,
    hour: Number(map.hour),
  };
}

export function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Sanitizes phone number and builds a https://wa.me/<phone> reminder URL.
 */
export function buildWhatsAppReminderUrl(phone, fullName) {
  if (!phone || /^PENDING/i.test(String(phone))) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  const text = encodeURIComponent(
    `Hi ${fullName || 'there'}, we missed seeing you at Fit & Impact! Drop in for a session soon—your active membership is ready.`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

/**
 * Builds the Day x Hour heatmap matrix (Mon-Sun x 05:00-22:00 IST).
 */
export function buildPeakHourHeatmap(logs) {
  const counts = {};
  for (const day of WEEKDAYS) {
    counts[day] = {};
    for (const hour of OPERATING_HOURS) {
      counts[day][hour] = 0;
    }
  }

  let maxCount = 0;
  for (const log of logs) {
    const parts = toISTParts(log.check_in_at);
    if (!parts) continue;
    if (counts[parts.weekday] && parts.hour >= 5 && parts.hour <= 22) {
      counts[parts.weekday][parts.hour] += 1;
      if (counts[parts.weekday][parts.hour] > maxCount) {
        maxCount = counts[parts.weekday][parts.hour];
      }
    }
  }

  return { counts, maxCount };
}

/**
 * Builds an array of daily check-in counts across the selected window.
 */
export function buildDailyFootfallSeries(logs, startISO, endISO) {
  const countsByDate = new Map();
  for (const log of logs) {
    const ist = toISTParts(log.check_in_at);
    const dateKey = ist?.dateISO || (log.attendance_date ? String(log.attendance_date).slice(0, 10) : null);
    if (!dateKey || dateKey < startISO || dateKey > endISO) continue;
    countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1);
  }

  const series = [];
  let cursor = startISO;
  let guard = 0;
  while (cursor <= endISO && guard < 400) {
    const dt = new Date(`${cursor}T12:00:00Z`);
    const weekday = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const shortLabel = dt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';

    series.push({
      dateISO: cursor,
      shortLabel,
      weekday,
      isWeekend,
      count: countsByDate.get(cursor) || 0,
    });
    cursor = addDaysToISO(cursor, 1);
    guard += 1;
  }

  return series;
}

/**
 * Computes package-level active member counts and period revenue, plus payment method totals.
 */
export function buildRevenueAnalytics({
  paymentsInRange,
  subscriptions,
  plans,
  memberOverview,
}) {
  const planById = new Map((plans || []).map((p) => [String(p.id), p]));
  const subById = new Map((subscriptions || []).map((s) => [String(s.id), s]));
  const memberById = new Map((memberOverview || []).map((m) => [String(m.id), m]));

  // Seed ordered package map with required packages first
  const packageStats = new Map();
  for (const req of REQUIRED_SUBSCRIPTION_PLANS) {
    packageStats.set(req.name, { name: req.name, activeMembers: 0, revenue: 0 });
  }
  for (const p of plans || []) {
    if (p.name && !packageStats.has(p.name)) {
      packageStats.set(p.name, { name: p.name, activeMembers: 0, revenue: 0 });
    }
  }

  const canonicalPlanName = (rawName) => {
    if (!rawName) return 'Other / Unassigned';
    const match = Array.from(packageStats.keys()).find(
      (k) => k.toLowerCase() === String(rawName).trim().toLowerCase()
    );
    return match || String(rawName).trim();
  };

  // Active member count from member_overview
  for (const m of memberOverview || []) {
    const isActive =
      String(m.status || '').toLowerCase() === 'active' ||
      (m.validity_days !== null && m.validity_days !== undefined && Number(m.validity_days) >= 0);
    if (!isActive || !m.active_package) continue;

    const name = canonicalPlanName(m.active_package);
    if (!packageStats.has(name)) {
      packageStats.set(name, { name, activeMembers: 0, revenue: 0 });
    }
    packageStats.get(name).activeMembers += 1;
  }

  // Revenue by package & payment method from payments in date range
  const methodTotals = new Map([
    ['Cash', { method: 'Cash', amount: 0, count: 0 }],
    ['UPI', { method: 'UPI', amount: 0, count: 0 }],
    ['Card', { method: 'Card', amount: 0, count: 0 }],
    ['Bank Transfer', { method: 'Bank Transfer', amount: 0, count: 0 }],
  ]);

  for (const pay of paymentsInRange) {
    const amt = Number(pay.amount || 0);
    const sub = pay.subscription_id ? subById.get(String(pay.subscription_id)) : null;
    const plan = sub?.plan_id ? planById.get(String(sub.plan_id)) : null;
    const member = pay.member_id ? memberById.get(String(pay.member_id)) : null;

    const rawPlanName = plan?.name || sub?.package_name || member?.active_package;
    const pkgName = canonicalPlanName(rawPlanName);
    if (!packageStats.has(pkgName)) {
      packageStats.set(pkgName, { name: pkgName, activeMembers: 0, revenue: 0 });
    }
    packageStats.get(pkgName).revenue += amt;

    const rawMethod = String(pay.payment_method || pay.method || 'Other').trim();
    const matchedMethod = Array.from(methodTotals.keys()).find(
      (k) => k.toLowerCase() === rawMethod.toLowerCase()
    );
    const methodKey = matchedMethod || rawMethod || 'Other';
    if (!methodTotals.has(methodKey)) {
      methodTotals.set(methodKey, { method: methodKey, amount: 0, count: 0 });
    }
    const entry = methodTotals.get(methodKey);
    entry.amount += amt;
    entry.count += 1;
  }

  return {
    packageRows: Array.from(packageStats.values()),
    methodRows: Array.from(methodTotals.values()),
  };
}

/**
 * Computes Gender counts and Age Bracket counts from `members`.
 */
export function buildDemographics(members) {
  const genderCounts = new Map([
    ['Male', 0],
    ['Female', 0],
    ['Other', 0],
    ['Not Specified', 0],
  ]);

  const ageBrackets = new Map([
    ['Under 20', 0],
    ['20–29', 0],
    ['30–39', 0],
    ['40–49', 0],
    ['50+', 0],
    ['Not Specified', 0],
  ]);

  const now = new Date();

  for (const m of members || []) {
    const g = String(m.gender || '').trim().toLowerCase();
    if (g === 'male') genderCounts.set('Male', genderCounts.get('Male') + 1);
    else if (g === 'female') genderCounts.set('Female', genderCounts.get('Female') + 1);
    else if (g) genderCounts.set('Other', genderCounts.get('Other') + 1);
    else genderCounts.set('Not Specified', genderCounts.get('Not Specified') + 1);

    if (!m.date_of_birth) {
      ageBrackets.set('Not Specified', ageBrackets.get('Not Specified') + 1);
      continue;
    }

    const dob = new Date(m.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      ageBrackets.set('Not Specified', ageBrackets.get('Not Specified') + 1);
      continue;
    }

    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }

    if (age < 20) ageBrackets.set('Under 20', ageBrackets.get('Under 20') + 1);
    else if (age <= 29) ageBrackets.set('20–29', ageBrackets.get('20–29') + 1);
    else if (age <= 39) ageBrackets.set('30–39', ageBrackets.get('30–39') + 1);
    else if (age <= 49) ageBrackets.set('40–49', ageBrackets.get('40–49') + 1);
    else ageBrackets.set('50+', ageBrackets.get('50+') + 1);
  }

  return {
    genders: Array.from(genderCounts.entries()).map(([label, count]) => ({ label, count })),
    ages: Array.from(ageBrackets.entries()).map(([label, count]) => ({ label, count })),
  };
}

function csvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds and triggers download of the Analytics CSV summary report.
 */
export function downloadAnalyticsCsv({
  windowInfo,
  kpis,
  health,
  packageRows,
  dailySeries,
}) {
  const lines = [
    ['Fit & Impact — Analytics Report'],
    ['Period', windowInfo.label],
    ['Start Date', windowInfo.startISO],
    ['End Date', windowInfo.endISO],
    [],
    ['KPI Summary', 'Value'],
    ['Collected Revenue (INR)', kpis.collectedRevenue],
    ['Pending Dues (INR)', kpis.pendingDues],
    ['Total Check-ins', kpis.totalCheckIns],
    ['Avg Daily Footfall', kpis.avgDailyFootfall],
    ['Avg Completed Session (Minutes)', kpis.avgSessionMinutes ?? 'N/A'],
    [],
    ['Membership Health', 'Count'],
    ['Active (> 5 days)', health.active],
    ['Expiring Soon (0-5 days)', health.expiringSoon],
    ['Expired (< 0 days)', health.expired],
    ['Renewed (> 1 subscription)', health.renewed],
    [],
    ['Package Performance', 'Active Members', 'Collected Revenue (INR)'],
    ...packageRows.map((p) => [p.name, p.activeMembers, p.revenue]),
    [],
    ['Daily Footfall Date', 'Day', 'Check-ins'],
    ...dailySeries.map((d) => [d.dateISO, d.weekday, d.count]),
  ];

  const csvContent = lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fit-and-impact-analytics-${windowInfo.key}-${windowInfo.endISO}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
