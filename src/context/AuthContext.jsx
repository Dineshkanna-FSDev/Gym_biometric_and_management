import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AuthContext } from '../hooks/useAuth';

const DEMO_STORAGE_KEY = 'fitimpact_demo_auth';

const DEMO_USER = {
  id: 'demo-admin-001',
  email: 'admin@fitandimpact.com',
  user_metadata: {
    full_name: 'Admin',
    role: 'admin',
  },
};

/**
 * Provides Supabase session state, auth listeners, and a temporary dev-bypass
 * demo login toggle so protected routes can be tested prior to DB setup.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    async function initAuth() {
      // Allow immediate route testing when dev-bypass demo mode was activated
      const savedDemo = localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
      if (savedDemo) {
        if (isMounted) {
          setUser(DEMO_USER);
          setSession({ user: DEMO_USER, access_token: 'demo-token' });
          setIsDemoMode(true);
          setLoading(false);
        }
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && isMounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.error('Failed to restore Supabase auth session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      const { data: listenerData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!isMounted) return;
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        setIsDemoMode(false);
        setLoading(false);
      });

      subscription = listenerData?.subscription ?? null;
    }

    initAuth();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  /**
   * Signs in an administrator using Supabase email & password auth.
   */
  async function signIn(email, password) {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: null,
        error: new Error(
          'Supabase credentials are not configured. Use Dev Demo Login below or update your .env file.'
        ),
      };
    }

    localStorage.removeItem(DEMO_STORAGE_KEY);
    setIsDemoMode(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!error && data?.session) {
      setSession(data.session);
      setUser(data.session.user);
    }

    return { data, error };
  }

  /**
   * Activates a temporary dev-bypass session for UI and routing verification.
   */
  function signInDemo() {
    localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    setIsDemoMode(true);
    setUser(DEMO_USER);
    setSession({ user: DEMO_USER, access_token: 'demo-token' });
    setLoading(false);
  }

  /**
   * Clears both demo session state and any active Supabase session.
   */
  async function signOut() {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setIsDemoMode(false);
    setSession(null);
    setUser(null);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase signOut failed:', err);
      }
    }
  }

  const value = {
    session,
    user,
    isAuthenticated: Boolean(user),
    isDemoMode,
    isSupabaseConfigured,
    loading,
    signIn,
    signInDemo,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
