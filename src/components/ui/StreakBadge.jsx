import { Flame } from 'lucide-react';

const STREAK_TOOLTIP = 'Consecutive gym days (auto-skips gym holidays)';

/**
 * Snapchat-style workout streak pill backed by `member_overview.current_streak`.
 */
export default function StreakBadge({ count = 0, showZero = false, size = 'sm', className = '' }) {
  const streak = Math.max(0, Number(count || 0));

  if (streak === 0 && !showZero) {
    return null;
  }

  const sizeClasses =
    size === 'md'
      ? 'gap-1.5 px-2.5 py-0.5 text-xs'
      : 'gap-1 px-2 py-0.5 text-[11px]';
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  let containerTone = 'border border-slate-200 bg-slate-50 text-slate-500';
  let flameClass = 'text-slate-400';

  if (streak >= 7) {
    containerTone =
      'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-2xs';
    flameClass = 'fill-amber-200 text-white';
  } else if (streak >= 1) {
    containerTone = 'border border-amber-200 bg-amber-50 text-amber-700';
    flameClass = 'fill-orange-500 text-orange-500';
  }

  return (
    <span
      title={STREAK_TOOLTIP}
      aria-label={`${streak} day workout streak — ${STREAK_TOOLTIP}`}
      className={`inline-flex shrink-0 items-center rounded-full font-bold leading-none ${sizeClasses} ${containerTone} ${className}`}
    >
      <Flame className={`${iconSize} shrink-0 ${flameClass}`} />
      <span>{streak === 0 ? '0' : `${streak}d`}</span>
    </span>
  );
}
