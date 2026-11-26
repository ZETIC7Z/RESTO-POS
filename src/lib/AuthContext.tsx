import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AttendanceLog,
  dayKey,
  FALLBACK_STORE_SETTINGS,
  Profile,
  Role,
  StoreSettings,
} from '../data/posData';
import { supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  storeSettings: StoreSettings;
  activeShift: AttendanceLog | null;
  loading: boolean;
  signIn: (identifier: string, password: string, expectedRole: Role) => Promise<Profile>;
  signOutAndEndShift: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(FALLBACK_STORE_SETTINGS);
  const [activeShift, setActiveShift] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setStoreSettings({
        id: data.id,
        store_name: data.store_name || FALLBACK_STORE_SETTINGS.store_name,
        address: data.address || FALLBACK_STORE_SETTINGS.address,
        tin: data.tin || FALLBACK_STORE_SETTINGS.tin,
        default_hourly_rate: Number(data.default_hourly_rate) || 54.5,
        ot_multiplier: Number(data.ot_multiplier) || 1.25,
      });
    }
  }, []);

  const loadUserContext = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setProfile(null);
      setActiveShift(null);
      return null;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!prof || !prof.is_active) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setActiveShift(null);
      return null;
    }

    const typedProfile: Profile = {
      ...prof,
      hourly_rate: Number(prof.hourly_rate) || 54.5,
    };
    setProfile(typedProfile);

    if (typedProfile.role === 'cashier') {
      const today = dayKey(Date.now());
      const { data: openLog } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('cashier_id', typedProfile.id)
        .eq('shift_date', today)
        .is('logout_time', null)
        .order('login_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveShift(
        openLog
          ? { ...openLog, overtime_hours: Number(openLog.overtime_hours) || 0 }
          : null
      );
    } else {
      setActiveShift(null);
    }

    return typedProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserContext(user);
    }
  }, [user, loadUserContext]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await refreshSettings();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await loadUserContext(authUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setActiveShift(null);
        setLoading(false);
        return;
      }
      // Avoid duplicate concurrent fetch only if called smoothly
      void loadUserContext(nextUser).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserContext, refreshSettings]);

  const signIn = useCallback(
    async (identifier: string, password: string, expectedRole: Role): Promise<Profile> => {
      const cleaned = identifier.trim();
      if (!cleaned || !password) {
        throw new Error('Please enter both username/email and password.');
      }

      // 1. Resolve username or email via SECURITY DEFINER RPC
      let emailToSignIn = cleaned.includes('@') ? cleaned.toLowerCase() : '';
      const { data: resolved } = await supabase.rpc('resolve_login_profile', {
        p_identifier: cleaned,
      });

      if (resolved) {
        if (!resolved.is_active) {
          throw new Error('This staff account is deactivated. Please contact your Administrator.');
        }
        if (resolved.role !== expectedRole) {
          const correctLabel = resolved.role === 'admin' ? 'Admin' : 'Cashier';
          throw new Error(
            `Account "${resolved.username}" is registered as ${correctLabel}. Please select the ${correctLabel} role card below.`
          );
        }
        emailToSignIn = resolved.email;
      } else if (!cleaned.includes('@')) {
        throw new Error('Account not found. Check your username or enter your registered email.');
      }

      // 2. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToSignIn,
        password,
      });

      if (error || !data.user) {
        throw new Error(error?.message || 'Invalid credentials.');
      }

      // 3. Verify authenticated profile under RLS
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profError || !prof) {
        await supabase.auth.signOut();
        throw new Error('Staff profile record not found in Supabase.');
      }

      if (!prof.is_active) {
        await supabase.auth.signOut();
        throw new Error('This staff account has been deactivated.');
      }

      if (prof.role !== expectedRole) {
        await supabase.auth.signOut();
        const correctLabel = prof.role === 'admin' ? 'Admin' : 'Cashier';
        throw new Error(`Please sign in under the ${correctLabel} role tab.`);
      }

      const typedProfile: Profile = {
        ...prof,
        hourly_rate: Number(prof.hourly_rate) || 54.5,
      };
      setUser(data.user);
      setProfile(typedProfile);

      // 4. Automatic Cashier Time-In (attendance_logs)
      if (typedProfile.role === 'cashier') {
        const today = dayKey(Date.now());
        const { data: existingOpen } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('cashier_id', typedProfile.id)
          .eq('shift_date', today)
          .is('logout_time', null)
          .order('login_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingOpen) {
          setActiveShift({
            ...existingOpen,
            overtime_hours: Number(existingOpen.overtime_hours) || 0,
          });
        } else {
          const { data: insertedShift, error: shiftErr } = await supabase
            .from('attendance_logs')
            .insert({
              cashier_id: typedProfile.id,
              shift_date: today,
              login_time: new Date().toISOString(),
            })
            .select('*')
            .single();

          if (!shiftErr && insertedShift) {
            setActiveShift({
              ...insertedShift,
              overtime_hours: Number(insertedShift.overtime_hours) || 0,
            });
          }
        }
      } else {
        setActiveShift(null);
      }

      await refreshSettings();
      return typedProfile;
    },
    [refreshSettings]
  );

  const signOutAndEndShift = useCallback(async () => {
    if (profile?.role === 'cashier') {
      const nowIso = new Date().toISOString();
      await supabase
        .from('attendance_logs')
        .update({ logout_time: nowIso })
        .eq('cashier_id', profile.id)
        .is('logout_time', null);
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network abort on signout
    }
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k);
        }
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          sessionStorage.removeItem(k);
        }
      });
    } catch {
      // ignore storage access issues
    }
    setActiveShift(null);
    setProfile(null);
    setUser(null);
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        storeSettings,
        activeShift,
        loading,
        signIn,
        signOutAndEndShift,
        refreshSettings,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
