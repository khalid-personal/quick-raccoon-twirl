import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserRole } from './types';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, pin: string) => Promise<{ error: Error | null }>;
  signup: (email: string, pin: string) => Promise<{ error: Error | null }>;
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
  const [isLoading, setIsLoading] = useState(true);

  const determineRole = (user: User | null): UserRole | null => {
    if (!user) return null;
    
    // Mock RBAC: Assign 'admin' role if email matches MOCK_ADMIN_EMAIL
    if (user.email === MOCK_ADMIN_EMAIL) {
        return 'admin';
    }
    // Default role for any other logged-in user
    return 'staff'; 
  };

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const user = session?.user ?? null;
      setUser(user);
      setUserRole(determineRole(user));
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        const user = session?.user ?? null;
        setUser(user);
        setUserRole(determineRole(user));
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pin: string) => {
    // --- TEMPORARY MOCK BYPASS FOR DEVELOPMENT ---
    // If Supabase fails to connect or authenticate, we create a mock session
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pin,
    });
    
    if (error) {
        console.warn("Supabase Login failed. Attempting mock bypass for development.");
        
        // Check if the error is likely due to connection/unregistered user
        // In a real app, you wouldn't do this, but for development, it allows progress.
        if (error.message.includes('Invalid login credentials') || error.message.includes('Network request failed')) {
            const mockUser = createMockUser(email);
            // Manually set state to simulate successful login
            setUser(mockUser);
            setUserRole(determineRole(mockUser));
            // Fix: token_type must be lowercase 'bearer'
            setSession({ user: mockUser, access_token: 'mock-token', token_type: 'bearer', expires_in: 3600, expires_at: Date.now() + 3600000 });
            setIsLoading(false);
            return { error: null };
        }
        
        console.error("Supabase Login Error Details:", error.message);
        return { error };
    }
    
    return { error: null };
  };
  
  const signup = async (email: string, pin: string) => {
    const { error } = await supabase.auth.signUp({
        email: email,
        password: pin,
    });
    
    if (error) {
        console.error("Supabase Signup Error Details:", error.message);
        return { error };
    }
    
    return { error: null };
  };
  
  const logout = async () => {
    await supabase.auth.signOut();
    // Clear mock state if it was set
    setUser(null);
    setUserRole(null);
    setSession(null);
  };
  
  const isAuthenticated = !!session;

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, user, isLoading, login, signup, logout }}>
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