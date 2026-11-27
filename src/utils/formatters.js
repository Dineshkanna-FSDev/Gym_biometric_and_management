/**
 * Shared formatting and status-mapping helpers for admin views.
 */

export function displayValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateDDMMYYYY(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatCurrency(value) {
  const num = Number(value);
  if (value === null || value === undefined || Number.isNaN(num)) return '—';
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatDurationMinutes(minutes) {
  const num = Number(minutes);
  if (minutes === null || minutes === undefined || Number.isNaN(num)) return '—';
  if (num < 60) return `${num}m`;
  const hrs = Math.floor(num / 60);
  const mins = num % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function getMemberStatusVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'present' || normalized === 'completed') {
    return 'success';
  }
  if (
    normalized === 'expiring' ||
    normalized === 'expiring_soon' ||
    normalized === 'pending' ||
    normalized === 'auto_closed'
  ) {
    return 'warning';
  }
  if (normalized === 'expired' || normalized === 'overdue' || normalized === 'failed') {
    return 'danger';
  }
  return 'neutral';
}

export function getValidityToneClass(validityDays) {
  if (validityDays === null || validityDays === undefined) {
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
  const days = Number(validityDays);
  if (days <= 0) return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  if (days <= 7) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
}
