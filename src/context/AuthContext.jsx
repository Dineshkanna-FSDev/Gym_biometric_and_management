import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../hooks/useAuth';

/**
 * Verifies that the authenticated Supabase user exists in `public.admin_users`.
 */
async function fetchAdminRecord(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Provides live Supabase Authentication state, enforces `public.admin_users`
 * authorization on every session, and handles signIn / signOut.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function validateSession(nextSession) {
      if (!nextSession?.user?.id) {
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setAdminProfile(null);
        setLoading(false);
        return;
      }

      try {
        const adminRow = await fetchAdminRecord(nextSession.user.id);
        if (!isMounted) return;

        if (!adminRow) {
          await supabase.auth.signOut();
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          setAdminProfile(null);
          setAuthError('Access denied. Your account is not authorized as an admin.');
          return;
        }

        setAuthError('');
        setSession(nextSession);
        setUser(nextSession.user);
        setAdminProfile(adminRow);
      } catch (err) {
        if (!isMounted) return;
        console.error('Admin verification failed:', err);
        await supabase.auth.signOut();
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setAdminProfile(null);
        setAuthError(err.message || 'Unable to verify administrator permissions.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to restore Supabase auth session:', error);
          if (isMounted) setLoading(false);
          return;
        }
        validateSession(data?.session ?? null);
      })
      .catch((err) => {
        console.error('Auth initialization error:', err);
        if (isMounted) setLoading(false);
      });

    const { data: listenerData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer DB verification outside the GoTrue auth lock callback
      setTimeout(() => {
        if (isMounted) {
          validateSession(nextSession ?? null);
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      listenerData?.subscription?.unsubscribe();
    };
  }, []);

  /**
   * Signs in with Supabase email/password and verifies `public.admin_users` membership.
   */
  async function signIn(email, password) {
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { data: null, error };
    }

    const authUser = data?.session?.user;
    if (!authUser?.id) {
      return {
        data: null,
        error: new Error('Authentication succeeded without a valid user session.'),
      };
    }

    try {
      const adminRow = await fetchAdminRecord(authUser.id);
      if (!adminRow) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setAdminProfile(null);
        const unauthorizedError = new Error(
          'Access denied. This account is not listed in admin_users.'
        );
        setAuthError(unauthorizedError.message);
        return { data: null, error: unauthorizedError };
      }

      setSession(data.session);
      setUser(authUser);
      setAdminProfile(adminRow);
      return { data, error: null };
    } catch (verifyErr) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setAdminProfile(null);
      const errObj =
        verifyErr instanceof Error
          ? verifyErr
          : new Error('Unable to verify administrator access.');
      setAuthError(errObj.message);
      return { data: null, error: errObj };
    }
  }

  /**
   * Signs out from Supabase Auth and clears local auth/admin profile state.
   */
  async function signOut() {
    setAuthError('');
    setSession(null);
    setUser(null);
    setAdminProfile(null);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Supabase signOut failed:', err);
    }
  }

  const value = {
    session,
    user,
    adminProfile,
    authError,
    isAuthenticated: Boolean(user && adminProfile),
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
