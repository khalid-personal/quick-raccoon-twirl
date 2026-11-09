import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from './types';

export interface ViewAsTarget {
  role: UserRole;
  label: string;
  userId?: string;
  trackingCode?: string;
  foreignAgencyId?: string;
  foreignAgencyName?: string;
  localAgencyId?: string;
  localAgencyName?: string;
}

export interface AuthContextValue {
  actualRole: UserRole | null;
  isDemo: boolean;
  viewAs: ViewAsTarget | null;
  startViewAs: (target: ViewAsTarget) => void;
  stopViewAs: () => void;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  user: User | null;
  isLoading: boolean;
  candidateTrackingCode: string | null;
  userForeignAgencyName: string | null;
  userLocalAgencyName: string | null;
  userForeignAgencyId: string | null;
  userLocalAgencyId: string | null;
  login: (identifier: string, pin: string) => Promise<{ error: Error | null }>;
  loginAsDevelopmentUser: (email: string) => Promise<{ error: Error | null }>;
  signup: (email: string, pin: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
};
