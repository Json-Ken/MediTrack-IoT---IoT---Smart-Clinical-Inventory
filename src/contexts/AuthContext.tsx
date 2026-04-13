import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserRole(userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return (data?.role as UserRole) || 'pharmacist';
}

async function buildUser(session: Session): Promise<User> {
  const role = await fetchUserRole(session.user.id);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', session.user.id)
    .single();

  return {
    id: session.user.id,
    name: profile?.display_name || session.user.email?.split('@')[0] || 'User',
    email: session.user.email || '',
    role,
    avatar: profile?.avatar_url || undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Use setTimeout to avoid potential deadlocks with Supabase client
        setTimeout(async () => {
          const u = await buildUser(session);
          setUser(u);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const u = await buildUser(session);
        setUser(u);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, _role: UserRole): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  };

  const signup = async (email: string, password: string, name: string, role: UserRole): Promise<boolean> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name },
      },
    });
    if (error || !data.user) return false;

    // Assign role
    await supabase.from('user_roles').insert({ user_id: data.user.id, role });
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
