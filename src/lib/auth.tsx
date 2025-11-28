import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserRole, StaffUser, LocalAgency, ForeignAgency, CocFacility } from './types';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { api } from './api';
import { getStaffUsers, saveStaffUsers, getLocalAgencies, getForeignAgencies, getCocFacilities } from './data-store'; // Import new getters
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  user: User | null;
  isLoading: boolean;
  candidateTrackingCode: string | null;
  userForeignAgencyName: string | null; // Renamed from userForeignAgency
  userLocalAgencyName: string | null; // Renamed from userCocAgency
  login: (identifier: string, pin: string) => Promise<{ error: Error | null }>;
  signup: (email: string, pin: string, authCode: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Temporary Mock User for development when Supabase is not configured/reachable
const createMockUser = (email: string): User => ({
    id: 'mock-user-id-' + email,
    email: email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [candidateTrackingCode, setCandidateTrackingCode] = useState<string | null>(null);
  const [userForeignAgencyName, setUserForeignAgencyName] = useState<string | null>(null); // Renamed
  const [userLocalAgencyName, setUserLocalAgencyName] = useState<string | null>(null); // Renamed
  const [isLoading, setIsLoading] = useState(true);

  const determineRole = async (user: User | null): Promise<{ role: UserRole | null, trackingCode: string | null, foreignAgencyName: string | null, localAgencyName: string | null }> => { // Updated return type
    if (!user || !user.email) {
        console.log("[AUTH] determineRole: No user or email, returning null role.");
        return { role: null, trackingCode: null, foreignAgencyName: null, localAgencyName: null };
    }
    
    const email = user.email.toLowerCase();
    console.log(`[AUTH] determineRole: Attempting to determine role for email: ${email}`);
    
    // 1. Check for Candidate role
    const candidate = await api.getCandidateByEmail(email);
    if (candidate) {
        console.log(`[AUTH] determineRole: Role determined: candidate (${candidate.tracking_code})`);
        return { role: 'candidate', trackingCode: candidate.tracking_code, foreignAgencyName: null, localAgencyName: null };
    }
    
    // 2. Check for Staff/Admin/Viewer role using mock store
    const staffUser = getStaffUsers().find(u => u.email.toLowerCase() === email);
    
    if (staffUser) {
        console.log(`[AUTH] determineRole: Found staff user:`, staffUser); 
        if (!staffUser.is_approved) {
            console.log(`[AUTH] determineRole: Staff user ${email} is registered but not approved. Treating as unauthenticated.`);
            return { role: null, trackingCode: null, foreignAgencyName: null, localAgencyName: null }; 
        }

        let foreignAgencyName: string | null = null;
        if (staffUser.foreign_agency_id) {
            const foreignAgency = getForeignAgencies().find(fa => fa.id === staffUser.foreign_agency_id);
            foreignAgencyName = foreignAgency?.name || null;
        }

        let localAgencyName: string | null = null;
        if (staffUser.local_agency_id) {
            const localAgency = getLocalAgencies().find(la => la.id === staffUser.local_agency_id);
            localAgencyName = localAgency?.name || null;
        }
        
        console.log(`[AUTH] determineRole: Role determined: ${staffUser.role}, Foreign Agency: ${foreignAgencyName || 'N/A'}, Local Agency: ${localAgencyName || 'N/A'}`);
        return { 
            role: staffUser.role, 
            trackingCode: null, 
            foreignAgencyName: foreignAgencyName,
            localAgencyName: localAgencyName,
        };
    }
    
    console.log(`[AUTH] determineRole: User ${email} found in Supabase but not in mock staff store. Defaulting to unauthenticated.`);
    return { role: null, trackingCode: null, foreignAgencyName: null, localAgencyName: null }; 
  };
  
  const updateAuthStatus = async (newSession: Session | null) => {
    console.log("[AUTH] updateAuthStatus: Session changed. New session:", newSession);
    setSession(newSession);
    const user = newSession?.user ?? null;
    setUser(user);
    
    if (user) {
        const { role, trackingCode, foreignAgencyName, localAgencyName } = await determineRole(user); // Updated destructuring
        console.log(`[AUTH] updateAuthStatus: Setting state: Role=${role}, TrackingCode=${trackingCode}, ForeignAgencyName=${foreignAgencyName}, LocalAgencyName=${localAgencyName}`); // Updated log
        setUserRole(role);
        setCandidateTrackingCode(trackingCode);
        setUserForeignAgencyName(foreignAgencyName); // Updated state setter
        setUserLocalAgencyName(localAgencyName); // Updated state setter
    } else {
        console.log(`[AUTH] updateAuthStatus: No user in session. Setting state: Logged out`);
        setUserRole(null);
        setCandidateTrackingCode(null);
        setUserForeignAgencyName(null); // Updated state setter
        setUserLocalAgencyName(null); // Updated state setter
    }
    setIsLoading(false); // Only set isLoading to false here
  };

  useEffect(() => {
    console.log("[AUTH] AuthProvider: Initializing auth listener.");
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthStatus(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log(`[AUTH] onAuthStateChange: Event received. Session:`, session);
        updateAuthStatus(session);
      }
    );

    return () => {
        console.log("[AUTH] AuthProvider: Cleaning up auth listener.");
        subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, pin: string) => {
    setIsLoading(true); // Set loading true at the start
    console.log(`[AUTH] login: Attempting login for identifier: ${identifier}, PIN: ${pin}`);
    
    let loginEmail = identifier.trim();
    
    if (!loginEmail.includes('@')) {
        console.log(`[AUTH] login: Identifier '${identifier}' is not an email. Looking up candidate by tracking code.`);
        const candidate = await api.getCandidateByTrackingCode(loginEmail);
        if (candidate) {
            loginEmail = candidate.email;
            console.log(`[AUTH] login: Found candidate. Using email: ${loginEmail}`);
        } else {
            console.log(`[AUTH] login: Candidate not found for tracking code '${identifier}'.`);
            // Do NOT set isLoading here, let onAuthStateChange handle it if no session is established
            return { error: new Error("Invalid tracking code or email.") };
        }
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: pin,
    });
    
    if (error) {
        console.warn(`[AUTH] login: Supabase Login failed for ${loginEmail}. Error: ${error.message}. Attempting mock bypass for development.`);
        
        if (error.message.includes('Invalid login credentials') || error.message.includes('Network request failed')) {
            const mockUser = createMockUser(loginEmail);
            console.log(`[AUTH] login: Created mock user for ${loginEmail}.`);
            
            const staffUser = getStaffUsers().find(u => u.email.toLowerCase() === loginEmail.toLowerCase());
            const candidate = await api.getCandidateByEmail(loginEmail);
            
            if (candidate || staffUser) {
                console.log(`[AUTH] login: Mock user ${loginEmail} found in local data store (candidate or staff). Simulating successful login.`);
                const mockSession: Session = { 
                    user: mockUser, 
                    access_token: 'mock-token', 
                    token_type: 'bearer', 
                    expires_in: 3600, 
                    expires_at: Date.now() + 3600000,
                    refresh_token: 'mock-refresh-token'
                };
                
                await updateAuthStatus(mockSession); // This will set isLoading to false
                return { error: null };
            } else {
                console.log(`[AUTH] login: Mock user ${loginEmail} NOT found in local data store. Mock bypass failed.`);
            }
        }
        
        console.error("[AUTH] login: Supabase Login Error Details:", error.message);
        // Do NOT set isLoading here, let onAuthStateChange handle it (which will eventually set session to null and isLoading to false)
        return { error };
    }
    
    console.log(`[AUTH] login: Supabase login successful for ${loginEmail}. Data:`, data);
    // updateAuthStatus will be called by onAuthStateChange, which will set isLoading to false
    return { error: null };
  };
  
  const signup = async (email: string, pin: string, authCode: string) => {
    console.log(`[AUTH] signup: Attempting signup for email: ${email}`);
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: pin,
        options: {
            data: {
                authorization_code: authCode,
            }
        }
    });
    
    if (error) {
        console.error("[AUTH] signup: Supabase Signup Error Details:", error.message);
        return { error };
    }
    
    const users = getStaffUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!existingUser) {
        const newUser: StaffUser = {
            id: data.user?.id || uuidv4(),
            email: email,
            role: 'staff',
            is_approved: false,
            created_at: new Date().toISOString(),
        };
        saveStaffUsers([...users, newUser]);
        console.log(`[AUTH] signup: Mock staff user ${email} added to local store as unapproved.`);
    } else {
        console.log(`[AUTH] signup: User ${email} already exists in local staff store.`);
    }
    
    return { error: null };
  };
  
  const logout = async () => {
    console.log("[AUTH] logout: Attempting to sign out.");
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setSession(null);
    setCandidateTrackingCode(null);
    setUserForeignAgencyName(null); // Updated state setter
    setUserLocalAgencyName(null); // Updated state setter
    setIsLoading(false);
    console.log("[AUTH] logout: State cleared.");
  };
  
  const isAuthenticated = !!session;
  console.log(`[AUTH] AuthProvider render: isAuthenticated=${isAuthenticated}, userRole=${userRole}, isLoading=${isLoading}`);

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, user, isLoading, candidateTrackingCode, userForeignAgencyName, userLocalAgencyName, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};