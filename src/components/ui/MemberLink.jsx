import { Link } from 'react-router-dom';

/**
 * Clickable member name link routing to /admin/members/:id.
 * Falls back to plain text when no valid memberId is available.
 */
export default function MemberLink({ memberId, name, className = '' }) {
  const label = name || 'Unnamed Member';

  if (!memberId) {
    return <span className={`font-semibold text-slate-900 ${className}`}>{label}</span>;
  }

  return (
    <Link
      to={`/admin/members/${memberId}`}
      className={`font-semibold text-slate-900 transition hover:text-indigo-600 hover:underline underline-offset-2 ${className}`}
    >
      {label}
    </Link>
  );
}
