import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from './types';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { clearSupabaseCache, hydrateFromSupabase, isSupabaseDataMode } from './supabase-sync';
import { AuthContext } from './auth-context';
import type { ViewAsTarget } from './auth-context';
import { VIEW_AS_KEY, exitDemo, isDemoMode } from './demo-mode';
import { toLoginEmail } from './identifier';
import { endAttendanceSession, startPresence } from './presence';
import { demoSessionUser, effectiveAuthUser } from './auth-identities';
import { getCandidates, getStaffUsers } from './data-store';

// Auth context and hook live in `src/lib/auth-context.ts`

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [candidateTrackingCode, setCandidateTrackingCode] = useState<string | null>(null);
  const [userForeignAgencyName, setUserForeignAgencyName] = useState<string | null>(null); // Renamed
  const [userLocalAgencyName, setUserLocalAgencyName] = useState<string | null>(null); // Renamed
  const [userForeignAgencyId, setUserForeignAgencyId] = useState<string | null>(null);
  const [userLocalAgencyId, setUserLocalAgencyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewAs, setViewAs] = useState<ViewAsTarget | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) ?? 'null') as ViewAsTarget | null; } catch { return null; }
  });
  const isDemo = isDemoMode();

  const startViewAs = useCallback((target: ViewAsTarget) => {
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
    setViewAs(target);
  }, []);
  const stopViewAs = useCallback(() => {
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAs(null);
  }, []);

  const determineRole = useCallback(async (user: User | null): Promise<{ role: UserRole | null, trackingCode: string | null, foreignAgencyName: string | null, localAgencyName: string | null, foreignAgencyId: string | null, localAgencyId: string | null }> => {
    const empty = { role: null, trackingCode: null, foreignAgencyName: null, localAgencyName: null, foreignAgencyId: null, localAgencyId: null };
    if (!user) return empty;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, is_approved, local_agency_id, foreign_agency_id, candidate_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[AUTH] determineRole: could not load profile', error.message);
      const message = /schema cache|does not exist/i.test(error.message)
        ? 'The database is not set up yet. Apply supabase/migrations to your Supabase project (see README).'
        : `Could not load your profile: ${error.message}`;
      window.dispatchEvent(new CustomEvent('supabase-sync-error', { detail: { message } }));
      return empty;
    }
    if (!profile || !profile.is_approved) {
      console.log('[AUTH] determineRole: no approved profile for this user.');
      return empty;
    }

    const trackingCodeLookup = async (): Promise<string | null> => {
      if (profile.role !== 'candidate' || !profile.candidate_id) return null;
      const { data: candidate } = await supabase.from('candidates').select('tracking_code').eq('id', profile.candidate_id).maybeSingle();
      return candidate?.tracking_code ?? null;
    };

    const agencyName = async (table: 'local_agencies' | 'foreign_agencies', id: string | null): Promise<string | null> => {
      if (!id) return null;
      const { data } = await supabase.from(table).select('data').eq('id', id).maybeSingle();
      return (data?.data as { name?: string } | undefined)?.name ?? null;
    };

    const [trackingCode, foreignAgencyName, localAgencyName] = await Promise.all([
      trackingCodeLookup(),
      agencyName('foreign_agencies', profile.foreign_agency_id),
      agencyName('local_agencies', profile.local_agency_id),
    ]);

    return {
      role: profile.role as UserRole,
      trackingCode,
      foreignAgencyName,
      localAgencyName,
      foreignAgencyId: profile.foreign_agency_id ?? null,
      localAgencyId: profile.local_agency_id ?? null,
    };
  }, []);
  
  const updateAuthStatus = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    const user = newSession?.user ?? null;
    setUser(user);
    
    if (user) {
      const { role, trackingCode, foreignAgencyName, localAgencyName, foreignAgencyId, localAgencyId } = await determineRole(user); // Updated destructuring
      if (role && isSupabaseDataMode()) {
        try {
          await hydrateFromSupabase();
        } catch (e) {
          console.error('[AUTH] updateAuthStatus: could not load data from Supabase. Has the migration been applied?', e);
        }
      } else if (!role) {
        clearSupabaseCache();
      }
      console.log(`[AUTH] updateAuthStatus: Setting state: Role=${role}, TrackingCode=${trackingCode}, ForeignAgencyName=${foreignAgencyName}, LocalAgencyName=${localAgencyName}, ForeignAgencyId=${foreignAgencyId}, LocalAgencyId=${localAgencyId}`); // Updated log
      setUserRole(role);
      setCandidateTrackingCode(trackingCode);
      setUserForeignAgencyName(foreignAgencyName); // Updated state setter
      setUserLocalAgencyName(localAgencyName); // Updated state setter
      setUserForeignAgencyId(foreignAgencyId);
      setUserLocalAgencyId(localAgencyId);
    } else {
        console.log(`[AUTH] updateAuthStatus: No user in session. Setting state: Logged out`);
        clearSupabaseCache();
        setUserRole(null);
        setCandidateTrackingCode(null);
        setUserForeignAgencyName(null); // Updated state setter
        setUserLocalAgencyName(null); // Updated state setter
      setUserForeignAgencyId(null);
      setUserLocalAgencyId(null);
    }
    setIsLoading(false); // Only set isLoading to false here
  }, [determineRole]);

  useEffect(() => {
    if (isDemoMode()) {
      // The demo is an offline sandbox: a built-in superadmin, with "view as" used to switch perspective.
      const demoUser = demoSessionUser();
      setSession({ user: demoUser, access_token: 'demo', refresh_token: 'demo', expires_in: 0, token_type: 'bearer' } as Session);
      setUser(demoUser);
      setUserRole('superadmin');
      setIsLoading(false);
      return;
    }
    console.log("[AUTH] AuthProvider: Initializing auth listener.");
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthStatus(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateAuthStatus(session);
      }
    );

    return () => {
        console.log("[AUTH] AuthProvider: Cleaning up auth listener.");
        subscription.unsubscribe();
    };
  }, [updateAuthStatus]);

  useEffect(() => {
    const perspective = userRole === 'superadmin' ? viewAs : null;
    const identity = effectiveAuthUser(user, perspective, isDemoMode(), isDemoMode() ? getCandidates() : [], isDemoMode() ? getStaffUsers() : []);
    const presenceUserId = isDemoMode() ? identity?.id : perspective?.userId ?? user?.id;
    const presenceRole = perspective?.role ?? userRole;
    const presenceEmail = isDemoMode() ? identity?.email ?? '' : perspective?.label ?? user?.email ?? '';
    const trackingCode = perspective?.trackingCode ?? candidateTrackingCode;
    if (!presenceUserId || !presenceRole) return;
    return startPresence(presenceUserId, presenceEmail, presenceRole, trackingCode);
  }, [user, userRole, candidateTrackingCode, viewAs]);

  // Development shortcut: signs in the seeded account (see scripts/seed-supabase.ts) with the seed password.
  const loginAsDevelopmentUser = async (email: string) => {
    if (!import.meta.env.DEV) {
      return { error: new Error('Development quick login is only available in development.') };
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: import.meta.env.VITE_SEED_PASSWORD || '123456',
    });
    if (error) setIsLoading(false);
    return { error };
  };

  const login = async (identifier: string, pin: string) => {
    setIsLoading(true); // Set loading true at the start
    console.log('[AUTH] login: Attempting authentication.');
    
    let loginEmail = identifier.trim();
    
    if (!loginEmail.includes('@')) {
        console.log(`[AUTH] login: Identifier '${identifier}' is not an email. Looking up candidate by tracking code.`);
        const { data: candidateEmail } = await supabase.rpc('candidate_login_email', { p_code: loginEmail });
        // A tracking code resolves to the candidate's login; anything else is a username.
        loginEmail = candidateEmail ? (candidateEmail as string) : toLoginEmail(loginEmail);
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: pin,
    });

    if (error) {
      setIsLoading(false);
      return { error };
    }
    
    console.log('[AUTH] Supabase login successful.');
    // updateAuthStatus will be called by onAuthStateChange, which will set isLoading to false
    return { error: null };
  };
  
  const signup = async (email: string, pin: string, authCode: string) => {
    // The database validates the authorization code and creates the pending staff profile.
    const { data: codeIsValid } = await supabase.rpc('check_authorization_code', { p_code: authCode });
    if (!codeIsValid) {
      return { error: new Error('Invalid or expired authorization code.') };
    }

    const { error } = await supabase.auth.signUp({
      email: toLoginEmail(email),
      password: pin,
      options: { data: { authorization_code: authCode } },
    });
    if (error) {
      console.error('[AUTH] signup: Supabase signup error:', error.message);
      return { error };
    }
    return { error: null };
  };
  
  const logout = async () => {
    console.log("[AUTH] logout: Attempting to sign out.");
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAs(null);
    if (isDemoMode()) { exitDemo(); return; }
    if (user?.id && user.email) {
      try {
        await endAttendanceSession(user.id, user.email, userRole);
      } catch (error) {
        console.warn('[attendance] Could not close session record during logout.', error);
      }
    }
    await supabase.auth.signOut();
    clearSupabaseCache();
    setUser(null);
    setUserRole(null);
    setSession(null);
    setCandidateTrackingCode(null);
    setUserForeignAgencyName(null); // Updated state setter
    setUserLocalAgencyName(null); // Updated state setter
    setUserForeignAgencyId(null);
    setUserLocalAgencyId(null);
    setIsLoading(false);
    console.log("[AUTH] logout: State cleared.");
  };
  
  const isAuthenticated = !!session;
  console.log(`[AUTH] AuthProvider render: isAuthenticated=${isAuthenticated}, userRole=${userRole}, isLoading=${isLoading}`);

  // Only a superadmin can view the portal as someone else.
  const active = userRole === 'superadmin' ? viewAs : null;
  const effectiveUser = effectiveAuthUser(user, active, isDemo, isDemo ? getCandidates() : [], isDemo ? getStaffUsers() : []);

  return (
    <AuthContext.Provider value={{
      actualRole: userRole,
      isDemo,
      viewAs: active,
      startViewAs,
      stopViewAs,
      isAuthenticated,
      userRole: active ? active.role : userRole,
      user: effectiveUser,
      isLoading,
      candidateTrackingCode: active ? active.trackingCode ?? null : candidateTrackingCode,
      userForeignAgencyName: active ? active.foreignAgencyName ?? null : userForeignAgencyName,
      userLocalAgencyName: active ? active.localAgencyName ?? null : userLocalAgencyName,
      userForeignAgencyId: active ? active.foreignAgencyId ?? null : userForeignAgencyId,
      userLocalAgencyId: active ? active.localAgencyId ?? null : userLocalAgencyId,
      login, loginAsDevelopmentUser, signup, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './auth-context';
