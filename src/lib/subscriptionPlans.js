import { supabase } from './supabase';

export const REQUIRED_SUBSCRIPTION_PLANS = [
  { name: '1 Month GYM', price: 1000, duration_days: 30 },
  { name: '3 Months GYM', price: 2500, duration_days: 90 },
  { name: 'Cardio', price: 1500, duration_days: 30 },
  { name: 'Personal Training', price: 4500, duration_days: 30 },
  { name: '3 Month Cardio', price: 4000, duration_days: 90 },
  { name: '4 Month Cardio', price: 5000, duration_days: 120 },
  { name: 'Annual Package', price: 10000, duration_days: 365 },
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns today's calendar date (YYYY-MM-DD) in Asia/Kolkata (IST).
 */
export function getTodayISO() {
  return IST_DATE_FORMATTER.format(new Date());
}

/**
 * Adds a whole number of days to a YYYY-MM-DD date string using UTC arithmetic.
 */
export function addDaysToISO(dateStr, days) {
  if (!dateStr) return '';
  const match = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

/**
 * Formats package dropdown options as "<Plan Name> [ Rs. <Price> ]".
 */
export function formatPlanOptionLabel(plan) {
  if (!plan) return '';
  const priceFormatted = Number(plan.price || 0).toLocaleString('en-IN');
  return `${plan.name} [ Rs. ${priceFormatted} ]`;
}

/**
 * Ensures the 7 required subscription packages exist in `public.subscription_plans`
 * (inserting any missing ones) and returns active plans sorted by price ascending.
 */
export async function ensureAndFetchSubscriptionPlans() {
  const initialRes = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true });

  if (initialRes.error) {
    throw initialRes.error;
  }

  const existing = initialRes.data || [];
  const existingByName = new Map(
    existing.map((p) => [String(p.name || '').trim().toLowerCase(), p])
  );

  const missingPlans = REQUIRED_SUBSCRIPTION_PLANS.filter(
    (req) => !existingByName.has(req.name.toLowerCase())
  );

  if (missingPlans.length > 0) {
    const withActive = missingPlans.map((p) => ({ ...p, is_active: true }));
    const { error: insertErr } = await supabase.from('subscription_plans').insert(withActive);

    if (insertErr && /is_active/i.test(insertErr.message || '')) {
      const { error: fallbackErr } = await supabase
        .from('subscription_plans')
        .insert(missingPlans);
      if (fallbackErr) {
        console.warn('Unable to auto-seed subscription_plans:', fallbackErr.message);
      }
    } else if (insertErr) {
      console.warn('Unable to auto-seed subscription_plans:', insertErr.message);
    }

    const refreshed = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (!refreshed.error && refreshed.data) {
      return refreshed.data.filter((p) => p.is_active !== false);
    }
  }

  return existing.filter((p) => p.is_active !== false);
}
