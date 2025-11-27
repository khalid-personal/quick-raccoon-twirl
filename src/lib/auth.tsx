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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      // In a real app, we would fetch the user's role from the database here.
      // For now, we mock a default role based on authentication presence.
      if (session) {
        // Mock role assignment for initial setup:
        // We will assume all logged-in users are 'staff' until we implement proper role fetching.
        setUserRole('staff'); 
      }
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
            // Re-evaluate role on auth change
            setUserRole('staff'); 
        } else {
            setUserRole(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pin: string) => {
    console.log(`Attempting login for: ${email}`);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pin, // Using PIN as password for mock purposes
    });
    
    if (error) {
        console.error("Supabase Login Error Details:", error.message);
        return { error };
    }
    
    // If successful, the onAuthStateChange listener handles setting the session/user/role.
    return { error: null };
  };
  
  const logout = async () => {
    await supabase.auth.signOut();
  };
  
  const isAuthenticated = !!session;

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, user, isLoading, login, logout }}>
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