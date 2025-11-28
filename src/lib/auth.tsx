import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserRole, StaffUser } from './types';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { api } from './api'; // Import API to check candidate emails
import { getStaffUsers, saveStaffUsers } from './data-store'; // Added saveStaffUsers
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  user: User | null;
  isLoading: boolean;
  candidateTrackingCode: string | null; // NEW: Store tracking code for candidate users
  login: (identifier: string, pin: string) => Promise<{ error: Error | null }>; // Changed email to identifier
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
  const [candidateTrackingCode, setCandidateTrackingCode] = useState<string | null>(null); // NEW state
  const [isLoading, setIsLoading] = useState(true);

  const determineRole = async (user: User | null): Promise<{ role: UserRole | null, trackingCode: string | null }> => {
    if (!user || !user.email) return { role: null, trackingCode: null };
    
    const email = user.email.toLowerCase();
    console.log(`[AUTH] Determining role for email: ${email}`);
    
    // 1. Check for Candidate role
    const candidate = await api.getCandidateByEmail(email);
    if (candidate) {
        console.log(`[AUTH] Role determined: candidate (${candidate.tracking_code})`);
        return { role: 'candidate', trackingCode: candidate.tracking_code };
    }
    
    // 2. Check for Staff/Admin/Agency role using mock store
    const staffUser = getStaffUsers().find(u => u.email.toLowerCase() === email);
    
    if (staffUser) {
        if (!staffUser.is_approved) {
            console.log(`[AUTH] Staff user ${email} is registered but not approved.`);
            // Treat unapproved staff as unauthenticated for access purposes
            return { role: null, trackingCode: null }; 
        }
        // Check if the user is a Foreign Agency (mocked by checking if their email matches a foreign agency name)
        const foreignAgencies = await api.getForeignAgencies();
        const isAgency = foreignAgencies.some(agency => email.includes(agency.toLowerCase().split(' ')[0]));
        
        if (isAgency) {
            console.log(`[AUTH] Role determined: agency`);
            return { role: 'agency', trackingCode: null };
        }
        
        console.log(`[AUTH] Role determined: ${staffUser.role}`);
        return { role: staffUser.role, trackingCode: null };
    }
    
    // 3. If user exists in Supabase but not in our mock store (e.g., new signup not yet seeded)
    console.log(`[AUTH] User ${email} found in Supabase but not in mock staff store. Defaulting to unauthenticated.`);
    return { role: null, trackingCode: null }; 
  };
  
  const updateAuthStatus = async (newSession: Session | null) => {
    setSession(newSession);
    const user = newSession?.user ?? null;
    setUser(user);
    
    if (user) {
        const { role, trackingCode } = await determineRole(user);
        console.log(`[AUTH] Setting state: Role=${role}, TrackingCode=${trackingCode}`);
        setUserRole(role);
        setCandidateTrackingCode(trackingCode);
    } else {
        console.log(`[AUTH] Setting state: Logged out`);
        setUserRole(null);
        setCandidateTrackingCode(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthStatus(session);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateAuthStatus(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (identifier: string, pin: string) => {
    setIsLoading(true);
    
    let loginEmail = identifier.trim();
    
    // If identifier does not look like an email, treat it as a tracking code
    if (!loginEmail.includes('@')) {
        const candidate = await api.getCandidateByTrackingCode(loginEmail);
        if (candidate) {
            loginEmail = candidate.email;
        } else {
            setIsLoading(false);
            return { error: new Error("Invalid tracking code or email.") };
        }
    }
    
    // --- SUPABASE LOGIN ATTEMPT ---
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: pin,
    });
    
    if (error) {
        console.warn("Supabase Login failed. Attempting mock bypass for development.");
        
        if (error.message.includes('Invalid login credentials') || error.message.includes('Network request failed')) {
            const mockUser = createMockUser(loginEmail);
            
            // Check if this mock user is a known candidate or staff/admin/agency
            const staffUser = getStaffUsers().find(u => u.email.toLowerCase() === loginEmail.toLowerCase());
            const candidate = await api.getCandidateByEmail(loginEmail);
            
            if (candidate || staffUser) {
                // Manually set state to simulate successful login
                const mockSession: Session = { 
                    user: mockUser, 
                    access_token: 'mock-token', 
                    token_type: 'bearer', 
                    expires_in: 3600, 
                    expires_at: Date.now() + 3600000,
                    refresh_token: 'mock-refresh-token'
                };
                
                await updateAuthStatus(mockSession);
                return { error: null };
            }
        }
        
        console.error("Supabase Login Error Details:", error.message);
        setIsLoading(false);
        return { error };
    }
    
    // If Supabase login succeeded, updateAuthStatus was called by the listener
    return { error: null };
  };
  
  const signup = async (email: string, pin: string, authCode: string) => {
    // 1. Attempt Supabase signup (for real auth flow)
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
        console.error("Supabase Signup Error Details:", error.message);
        return { error };
    }
    
    // 2. Mock: Add user to local staff store as unapproved 'staff'
    const users = getStaffUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!existingUser) {
        const newUser: StaffUser = {
            id: data.user?.id || uuidv4(), // Use Supabase ID if available, otherwise mock
            email: email,
            role: 'staff', // Default role for new signups
            is_approved: false, // Requires admin approval
            created_at: new Date().toISOString(),
        };
        saveStaffUsers([...users, newUser]);
    }
    
    return { error: null };
  };
  
  const logout = async () => {
    await supabase.auth.signOut();
    // Clear state
    setUser(null);
    setUserRole(null);
    setSession(null);
    setCandidateTrackingCode(null);
    setIsLoading(false);
  };
  
  const isAuthenticated = !!session;

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, user, isLoading, candidateTrackingCode, login, signup, logout }}>
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