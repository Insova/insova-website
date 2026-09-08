import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, configured } from '../supabaseClient';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/*
  Why this file is defensive about loading.

  The previous version did:

      supabase.auth.getSession().then(async ({ data }) => {
        setSession(data.session);
        await loadProfile(data.session?.user?.id);
        if (!cancelled) setLoading(false);
      });

  with no catch. If either query inside loadProfile rejected, for any
  reason at all, setLoading(false) was never reached and the app sat on
  its loading screen until the person refreshed. That is exactly what
  was happening.

  Three changes:

    * every path that starts loading ends it, in a finally block, so no
      failure can leave someone stuck;
    * a hard timeout, because a request that never resolves is not a
      rejection and a finally will not save you from it;
    * failures are recorded rather than swallowed, so the app can say
      something went wrong instead of pretending to be signed out.
*/

// If auth has not resolved by now, stop waiting and show the app. Being
// wrong about the session is recoverable; a permanent spinner is not.
const AUTH_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setPharmacy(null);
      return;
    }
    // Handles its own failures. A profile we could not read is a
    // degraded session, not a reason to hang.
    try {
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, pharmacy_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setAuthError(error.message);
        return;
      }
      setProfile(prof || null);

      if (prof?.pharmacy_id) {
        const { data: ph, error: phErr } = await supabase
          .from('pharmacies')
          .select('id, name, town, county, wholesalers')
          .eq('id', prof.pharmacy_id)
          .maybeSingle();
        if (phErr) setAuthError(phErr.message);
        else setPharmacy(ph || null);
      } else {
        setPharmacy(null);
      }
    } catch (e) {
      setAuthError(e?.message || 'Could not load your profile');
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let settled = false;

    const finish = () => {
      if (cancelled || settled) return;
      settled = true;
      setLoading(false);
    };

    // A rejected promise is caught below. A promise that simply never
    // resolves is not, so this is the only thing standing between a
    // slow network and a permanent loading screen.
    const timer = setTimeout(() => {
      if (!cancelled && !settled) {
        setAuthError('Sign-in check timed out');
        finish();
      }
    }, AUTH_TIMEOUT_MS);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) setAuthError(error.message);
        const s = data?.session ?? null;
        setSession(s);
        await loadProfile(s?.user?.id);
      } catch (e) {
        if (!cancelled) setAuthError(e?.message || 'Could not check your session');
      } finally {
        clearTimeout(timer);
        finish();
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s);
      try {
        await loadProfile(s?.user?.id);
      } catch (e) {
        setAuthError(e?.message || 'Could not load your profile');
      } finally {
        clearTimeout(timer);
        finish();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-in service' };
    }
  };

  const signUp = async (email, password, fullName) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-up service' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfile(null);
      setPharmacy(null);
      setSession(null);
    }
  };

  const value = {
    configured,
    session,
    user: session?.user || null,
    profile,
    pharmacy,
    role: profile?.role || null,
    isAdmin: profile?.role === 'admin',
    hasPharmacy: Boolean(profile?.pharmacy_id),
    loading,
    authError,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}