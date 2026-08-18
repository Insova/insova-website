import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, configured } from '../supabaseClient';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setPharmacy(null);
      return;
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, pharmacy_id')
      .eq('id', userId)
      .maybeSingle();

    setProfile(prof || null);

    if (prof?.pharmacy_id) {
      const { data: ph } = await supabase
        .from('pharmacies')
        .select('id, name, town, county, wholesalers')
        .eq('id', prof.pharmacy_id)
        .maybeSingle();
      setPharmacy(ph || null);
    } else {
      setPharmacy(null);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s);
      await loadProfile(s?.user?.id);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPharmacy(null);
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
    signIn,
    signUp,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}