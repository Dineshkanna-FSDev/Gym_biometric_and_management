const VARIANT_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

/**
 * Compact pill badge for status labels, expiry countdowns, and alerts.
 */
export default function StatusBadge({ children, variant = 'neutral', className = '' }) {
  const tone = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone} ${className}`}
    >
      {children}
    </span>
  );
}
