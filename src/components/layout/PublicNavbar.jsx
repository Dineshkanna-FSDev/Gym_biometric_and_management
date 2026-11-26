import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Lock, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Programs', href: '#programs' },
  { label: 'Membership Plans', href: '#plans' },
  { label: 'Facilities', href: '#facilities' },
  { label: 'Contact', href: '#contact' },
];

/**
 * Sticky public marketing header with brand mark, anchor links, and Admin Login CTA.
 */
export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950 shadow-sm">
            <Dumbbell className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Fit <span className="text-amber-400">&amp;</span> Impact
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-300 transition hover:text-amber-400"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
          >
            <Lock className="h-4 w-4" />
            <span>Admin Login</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile navigation">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 hover:text-amber-400"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
