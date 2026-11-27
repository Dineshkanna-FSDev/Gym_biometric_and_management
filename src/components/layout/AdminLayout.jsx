import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  Dumbbell,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import GlobalMemberSearch from './GlobalMemberSearch';

const ADMIN_NAV_ITEMS = [
  { label: 'DASHBOARD', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'MEMBERS', to: '/admin/members', icon: Users },
  { label: 'ATTENDANCE', to: '/admin/attendance', icon: Fingerprint },
  { label: 'PAYMENTS', to: '/admin/payments', icon: CreditCard },
  { label: 'ANALYTICS', to: '/admin/analytics', icon: BarChart3 },
];

/**
 * Light-themed SaaS Admin Shell with top global search header,
 * icon-above-label vertical sidebar, mobile drawer, and logout action.
 */
export default function AdminLayout() {
  const { user, isDemoMode, signOut } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const displayName = user?.user_metadata?.full_name || 'Admin';

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  function handleToggleSidebar() {
    if (window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setSidebarHidden((prev) => !prev);
    }
  }

  function renderNavItems(onItemClick) {
    return ADMIN_NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onItemClick}
          className={({ isActive }) =>
            `group flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center transition ${
              isActive
                ? 'bg-indigo-50 text-indigo-600 shadow-2xs ring-1 ring-indigo-100'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="text-[10px] font-bold tracking-wider">{item.label}</span>
        </NavLink>
      );
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-2xs sm:px-6">
        {/* Left: Sidebar Toggle + Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Dumbbell className="h-5 w-5" />
            </span>
            <div className="hidden sm:block">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Fit &amp; Impact
              </span>
              <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Admin
              </span>
            </div>
          </div>
        </div>

        {/* Center: Global Member Search & Quick Jump */}
        <GlobalMemberSearch value={globalSearch} onChange={setGlobalSearch} />

        {/* Right: Admin Greeting */}
        <div className="flex items-center gap-2.5">
          {isDemoMode && (
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 lg:inline-flex">
              Demo Bypass
            </span>
          )}
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
              Hi, {displayName}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Vertical Sidebar (Icon-above-label) */}
        <aside
          className={`hidden md:flex flex-col justify-between border-r border-slate-200 bg-white transition-all duration-200 shrink-0 ${
            sidebarHidden ? 'w-0 overflow-hidden border-r-0 p-0' : 'w-26 p-2.5'
          }`}
        >
          <nav className="flex flex-col gap-1.5" aria-label="Admin sidebar navigation">
            {renderNavItems()}
          </nav>

          <div className="border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative z-50 flex w-28 flex-col justify-between border-r border-slate-200 bg-white p-2.5 shadow-xl">
              <div>
                <div className="mb-3 flex items-center justify-center border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Close navigation sidebar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex flex-col gap-1.5" aria-label="Mobile admin navigation">
                  {renderNavItems(() => setMobileOpen(false))}
                </nav>
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-[10px] font-bold tracking-wider uppercase">Logout</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet context={{ globalSearch, setGlobalSearch }} />
          </div>
        </main>
      </div>
    </div>
  );
}
