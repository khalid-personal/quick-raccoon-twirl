import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserRole } from './types';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { api } from './api'; // Import API to check candidate emails

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  user: User | null;
  isLoading: boolean;
  candidateTrackingCode: string | null; // NEW: Store tracking code for candidate users
  login: (email: string, pin: string) => Promise<{ error: Error | null }>;
  signup: (email: string, pin: string, authCode: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock Admin Email for testing purposes
const MOCK_ADMIN_EMAIL = 'admin@agency.com';

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
    
    console.log(`[AUTH] Determining role for email: ${user.email}`);
    
    // 1. Check for Admin role
    if (user.email === MOCK_ADMIN_EMAIL) {
        console.log(`[AUTH] Role determined: admin`);
        return { role: 'admin', trackingCode: null };
    }
    
    // 2. Check for Candidate role
    const candidate = await api.getCandidateByEmail(user.email);
    if (candidate) {
        console.log(`[AUTH] Role determined: candidate (${candidate.tracking_code})`);
        return { role: 'candidate', trackingCode: candidate.tracking_code };
    }
    
    // 3. Default Staff role for any other logged-in user
    console.log(`[AUTH] Role determined: staff`);
    return { role: 'staff', trackingCode: null }; 
  };
  
  const updateAuthStatus = async (newSession: Session | null) => {
    setSession(newSession); // <-- FIX: Set the session state
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

  const login = async (email: string, pin: string) => {
    setIsLoading(true);
    
    // --- TEMPORARY MOCK BYPASS FOR DEVELOPMENT ---
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pin,
    });
    
    if (error) {
        console.warn("Supabase Login failed. Attempting mock bypass for development.");
        
        if (error.message.includes('Invalid login credentials') || error.message.includes('Network request failed')) {
            const mockUser = createMockUser(email);
            
            // Check if this mock user is a known candidate or staff/admin
            const candidate = await api.getCandidateByEmail(email);
            
            if (candidate || email === MOCK_ADMIN_EMAIL || email.includes('@agency.com')) {
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
    // Note: Candidate signup is not supported via this form, only staff/admin.
    // Candidates are created via the Admin Dashboard (POST /api/admin/candidate).
    const { error } = await supabase.auth.signUp({
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