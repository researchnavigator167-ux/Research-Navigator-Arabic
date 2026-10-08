import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getUserRoleInfo, setUserRole } from './classroom';
import type { UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  displayName: string | null;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshRole: () => Promise<void>;
  setRole: (role: UserRole, displayName?: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        loadRole(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        loadRole(session.user.id);
      } else {
        setRoleState(null);
        setDisplayName(null);
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadRole = async (userId: string) => {
    setRoleLoading(true);
    const info = await getUserRoleInfo(userId);
    setRoleState(info?.role ?? null);
    setDisplayName(info?.display_name ?? null);
    setRoleLoading(false);
  };

  const refreshRole = async () => {
    if (user) await loadRole(user.id);
  };

  const setRole = async (newRole: UserRole, name?: string) => {
    if (!user) return { error: 'No user' };
    const { error } = await setUserRole(user.id, newRole, name);
    if (!error) {
      setRoleState(newRole);
      setDisplayName(name || null);
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: mapAuthError(error.message) };
    }
    if (data.user && !data.session) {
      return { error: 'EMAIL_CONFIRMATION_REQUIRED' };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoleState(null);
    setDisplayName(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  };

  const deleteAccount = async () => {
    if (!user) return { error: 'No user' };
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{
      user, loading, role, displayName, roleLoading,
      signIn, signUp, signOut, resetPassword, deleteAccount, refreshRole, setRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists'))
    return 'EMAIL_ALREADY_REGISTERED';
  if (m.includes('password') && (m.includes('weak') || m.includes('short') || m.includes('at least') || m.includes('length')))
    return 'WEAK_PASSWORD';
  if (m.includes('invalid email') || m.includes('email_address_invalid') || m.includes('not a valid email'))
    return 'INVALID_EMAIL';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'RATE_LIMITED';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch') || m.includes('connection'))
    return 'NETWORK_ERROR';
  return 'AUTH_ERROR';
}
