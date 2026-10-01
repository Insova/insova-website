import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

  "NOT LINKED TO A PHARMACY" ON SIGN-IN
  -------------------------------------
  Signing in often showed "your account is not linked to a pharmacy",
  which a browser refresh cleared and the installed app could not.

  Two causes, both fixed here:

    1. A race. On sign-in the session was set at once and the profile
       loaded afterwards. In between, the app saw a signed-in person with
       no profile and concluded they had no pharmacy. It now tracks
       profileStatus, and nothing decides "no pharmacy" until the profile
       has actually loaded ('ready').

    2. A lock. The profile was loaded from INSIDE onAuthStateChange.
       supabase-js holds its auth lock while that callback runs, and a
       database query made from inside it can wait on that same lock
       indefinitely. Supabase's own documentation warns against it. The
       load is now deferred to the next tick, outside the callback.

  A profile load that fails or hangs now ends in profileStatus 'error',
  which the app shows as "could not load your account", with a way to
  try again. It is never again reported as "no pharmacy".
*/

// If auth has not resolved by now, stop waiting and show the app. Being
// wrong about the session is recoverable; a permanent spinner is not.
const AUTH_TIMEOUT_MS = 8000;

// A profile query that has not answered by now is treated as failed,
// so the person sees "try again" rather than an endless wait.
const PROFILE_TIMEOUT_MS = 10000;

/*
  Where every email link sends people: confirmation, and password reset.

  Left unset, Supabase falls back to the project's Site URL, which is
  how new pharmacists ended up on a page that did not exist. Sending
  them to the origin is the one target guaranteed to be served, because
  it is index.html. App.js recognises the auth payload Supabase appends
  and shows the right screen.

  Built from window.location.origin rather than hardcoded so that a
  local build works locally and production works on production. Every
  origin used has to be listed in Supabase under Authentication, URL
  Configuration, Redirect URLs, or Supabase ignores it and falls back to
  Site URL again.
*/
const emailRedirectTo = typeof window !== 'undefined'
  ? window.location.origin + '/'
  : undefined;

/*
  PASSWORD RESET LINKS

  A reset link comes back through exactly the same door as a
  confirmation link. Without telling them apart, someone resetting their
  password would be greeted with "Your email is confirmed", which is
  wrong and confusing.

  Two signals, because either alone can miss:

    * Supabase fires a PASSWORD_RECOVERY event once it has processed the
      link. This is the documented signal and it covers both link styles.
    * The implicit link style also carries type=recovery in the address.
      That is read here, at module load, before supabase-js clears the
      address bar, so the very first render already knows. Without it
      there is a moment where the confirmation screen flashes up first.
*/
const arrivedForRecovery = typeof window !== 'undefined'
  && /type=recovery/.test((window.location.hash || '') + (window.location.search || ''));

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Loading your account timed out')), ms)),
  ]);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [recovering, setRecovering] = useState(arrivedForRecovery);
  // idle     no one signed in, or about to start loading
  // loading  fetching the profile and pharmacy
  // ready    loaded; profile and pharmacy reflect the database
  // error    could not load; NOT the same as having no pharmacy
  const [profileStatus, setProfileStatus] = useState('idle');

  // Which user the profile currently on screen belongs to, and a
  // counter so that if two loads overlap only the newest one lands.
  const currentUser = useRef(null);
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (userId) => {
    const seq = ++loadSeq.current;
    const stale = () => seq !== loadSeq.current;

    if (!userId) {
      setProfile(null);
      setPharmacy(null);
      setProfileStatus('idle');
      return;
    }

    setProfileStatus('loading');
    try {
      const { data: prof, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, email, full_name, role, pharmacy_id')
          .eq('id', userId)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS
      );
      if (stale()) return;
      if (error) {
        setAuthError(error.message);
        setProfileStatus('error');
        return;
      }
      setProfile(prof || null);

      if (prof?.pharmacy_id) {
        const { data: ph, error: phErr } = await withTimeout(
          supabase
            .from('pharmacies')
            .select('id, name, town, county, wholesalers')
            .eq('id', prof.pharmacy_id)
            .maybeSingle(),
          PROFILE_TIMEOUT_MS
        );
        if (stale()) return;
        if (phErr) {
          setAuthError(phErr.message);
          setProfileStatus('error');
          return;
        }
        setPharmacy(ph || null);
      } else {
        setPharmacy(null);
      }
      setAuthError(null);
      setProfileStatus('ready');
    } catch (e) {
      if (stale()) return;
      setAuthError(e?.message || 'Could not load your profile');
      setProfileStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return undefined;
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
        currentUser.current = s?.user?.id || null;
        await loadProfile(currentUser.current);
      } catch (e) {
        if (!cancelled) setAuthError(e?.message || 'Could not check your session');
      } finally {
        clearTimeout(timer);
        finish();
      }
    })();

    // Deliberately NOT async, and makes no Supabase call itself. See the
    // note at the top: anything that queries the database is deferred to
    // the next tick, outside the auth lock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);

      const uid = s?.user?.id || null;
      // Only reload when the person changes, or their account was
      // edited. A routine token refresh is the same person and needs
      // nothing new from the database.
      if (uid !== currentUser.current || event === 'USER_UPDATED') {
        currentUser.current = uid;
        if (uid) setProfileStatus('loading');
        setTimeout(() => { if (!cancelled) loadProfile(uid); }, 0);
      }

      clearTimeout(timer);
      finish();
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
        options: { data: { full_name: fullName }, emailRedirectTo },
      });
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-up service' };
    }
  };

  // For the person who says the link expired. Sends a fresh confirmation
  // to the same address, pointed at the same place.
  const resendConfirmation = async (email) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-up service' };
    }
  };

  // "Forgot your password?" Supabase emails a link back to this site,
  // which lands on the set-new-password screen.
  const requestPasswordReset = async (email) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: emailRedirectTo,
      });
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-in service' };
    }
  };

  // Used both by someone arriving from a reset link and by someone
  // already signed in who wants to change theirs. Either way they hold
  // a valid session, which is what Supabase requires.
  const updatePassword = async (password) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) setRecovering(false);
      return error;
    } catch (e) {
      return { message: e?.message || 'Could not reach the sign-in service' };
    }
  };

  const endRecovery = () => setRecovering(false);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      currentUser.current = null;
      loadSeq.current += 1; // drop any load still in flight
      setProfile(null);
      setPharmacy(null);
      setSession(null);
      setRecovering(false);
      setProfileStatus('idle');
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
    profileStatus,
    loading,
    authError,
    recovering,
    signIn,
    signUp,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    endRecovery,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id || currentUser.current),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}