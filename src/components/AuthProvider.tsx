import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGithub: () => Promise<void>;
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signUpWithEmail: (email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // If we are in a popup window and sign in is successful or initialized
      if (event === 'SIGNED_IN' && window.opener && window.opener !== window) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
        window.close();
      }
    });

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        // Refresh session
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setTimeout(() => window.location.reload(), 200);
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const signInWithGithub = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        skipBrowserRedirect: true,
        redirectTo: window.location.origin,
      }
    });
    
    if (error) {
      console.error("Github login error:", error);
      throw error;
    }
    
    if (data?.url) {
      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    }
  };

  const signInWithEmail = async (email: string, password?: string) => {
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });
      if (error) throw error;
    }
  };

  const signUpWithEmail = async (email: string, password?: string) => {
    if (password) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTimeout(() => window.location.reload(), 200);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGithub, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
