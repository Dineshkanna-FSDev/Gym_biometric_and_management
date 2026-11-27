import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  Dumbbell,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanFace,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import GlobalMemberSearch from './GlobalMemberSearch';

const AUTO_REDIRECT_STORAGE_KEY = 'fitandimpact_auto_redirect';
const PUNCH_DEDUP_MS = 5000;

const ADMIN_NAV_ITEMS = [
  { label: 'DASHBOARD', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'MEMBERS', to: '/admin/members', icon: Users },
  { label: 'ATTENDANCE', to: '/admin/attendance', icon: Fingerprint },
  { label: 'PAYMENTS', to: '/admin/payments', icon: CreditCard },
  { label: 'ANALYTICS', to: '/admin/analytics', icon: BarChart3 },
];

/**
 * Light-themed SaaS Admin Shell with live global member search,
 * Realtime biometric punch auto-redirect + toast, Auto-Open toggle, and sidebar.
 */
export default function AdminLayout() {
  const { user, adminProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const [autoRedirect, setAutoRedirect] = useState(() => {
    const saved = localStorage.getItem(AUTO_REDIRECT_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  });
  const [punchToast, setPunchToast] = useState(null);
  const [punchRefreshSignal, setPunchRefreshSignal] = useState(0);

  // Refs prevent tearing down the Realtime channel on route or toggle changes
  const autoRedirectRef = useRef(autoRedirect);
  const pathnameRef = useRef(location.pathname);
  const lastPunchByMemberRef = useRef(new Map());
  const memberCacheRef = useRef(new Map());
  const toastTimerRef = useRef(null);

  useEffect(() => {
    autoRedirectRef.current = autoRedirect;
  }, [autoRedirect]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    async function resolveMemberSummary(memberId) {
      const key = String(memberId);
      const cached = memberCacheRef.current.get(key);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('members')
        .select('full_name, device_pin')
        .eq('id', memberId)
        .maybeSingle();

      if (!error && data) {
        const info = {
          fullName: data.full_name || `Member #${key}`,
          devicePin: data.device_pin ?? null,
        };
        memberCacheRef.current.set(key, info);
        return info;
      }

      return { fullName: `Member #${key}`, devicePin: null };
    }

    async function handlePunchPayload(payload) {
      if (!active) return;
      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;

      const row = payload.new;
      if (!row?.member_id) return;

      // Ignore nightly auto_closed cleanup updates
      if (String(row.status || '').toLowerCase() === 'auto_closed') return;

      const memberIdKey = String(row.member_id);
      const now = Date.now();
      const lastSeen = lastPunchByMemberRef.current.get(memberIdKey) || 0;
      if (now - lastSeen < PUNCH_DEDUP_MS) return;
      lastPunchByMemberRef.current.set(memberIdKey, now);

      const isCheckOut = payload.eventType === 'UPDATE' && Boolean(row.check_out_at);
      const memberInfo = await resolveMemberSummary(row.member_id);
      if (!active) return;

      const pinSuffix =
        memberInfo.devicePin !== null && memberInfo.devicePin !== undefined
          ? ` (PIN #${memberInfo.devicePin})`
          : '';
      const message = isCheckOut
        ? `Check-Out: ${memberInfo.fullName}${pinSuffix}`
        : `Check-In: ${memberInfo.fullName}${pinSuffix}`;

      clearTimeout(toastTimerRef.current);
      setPunchToast({
        id: `${memberIdKey}-${now}`,
        memberId: row.member_id,
        isCheckOut,
        message,
      });
      toastTimerRef.current = setTimeout(() => {
        if (active) setPunchToast(null);
      }, 5000);

      if (autoRedirectRef.current) {
        const targetPath = `/admin/members/${memberIdKey}`;
        if (pathnameRef.current === targetPath) {
          setPunchRefreshSignal((n) => n + 1);
        } else {
          navigate(targetPath);
        }
      }
    }

    const channel = supabase
      .channel('admin-punch-listener')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        (payload) => {
          handlePunchPayload(payload).catch((err) => {
            console.error('Realtime punch handler error:', err);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearTimeout(toastTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const displayName =
    adminProfile?.full_name || user?.user_metadata?.full_name || user?.email || 'Admin';

  function handleToggleAutoRedirect() {
    setAutoRedirect((prev) => {
      const next = !prev;
      localStorage.setItem(AUTO_REDIRECT_STORAGE_KEY, String(next));
      return next;
    });
  }

  async function handleLogout() {
    await signOut();
    navigate('/', { replace: true });
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
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-2xs sm:px-6">
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

        {/* Right: Auto-Open Scan Toggle + Authenticated Admin Profile Pill */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleAutoRedirect}
            aria-pressed={autoRedirect}
            title={
              autoRedirect
                ? 'Auto-Open Scan is ON: automatically opens member profile on biometric punch'
                : 'Auto-Open Scan is OFF: shows punch toast without interrupting current page'
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
              autoRedirect
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ScanFace className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline">Auto-Open Scan</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                autoRedirect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              {autoRedirect ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate text-sm font-semibold text-slate-700 sm:inline">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      {/* Non-blocking Live Biometric Punch Toast */}
      {punchToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl ring-1 ring-slate-900/5"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              punchToast.isCheckOut
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <ScanFace className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {punchToast.message}
            </p>
            <Link
              to={`/admin/members/${punchToast.memberId}`}
              onClick={() => setPunchToast(null)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Open Member Profile →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setPunchToast(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            <Outlet context={{ globalSearch, setGlobalSearch, punchRefreshSignal }} />
          </div>
        </main>
      </div>
    </div>
  );
}
