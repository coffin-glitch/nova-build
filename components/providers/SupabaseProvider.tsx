"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User, Session } from "@supabase/supabase-js";

interface SupabaseContextType {
  supabase: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

/**
 * Supabase Provider Component
 * 
 * Replaces ClerkProvider and provides Supabase auth context to the app.
 * Handles session management and provides user/session state.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);

  // Initialize Supabase client in useEffect to ensure env vars are available
  useEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !anonKey) {
        const error = new Error("Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
        console.error("❌ [SupabaseProvider]", error.message);
        console.error("❌ NEXT_PUBLIC_SUPABASE_URL:", url ? "✅ Set" : "❌ Missing");
        console.error("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY:", anonKey ? "✅ Set" : "❌ Missing");
        setInitError(error);
        return;
      }
      
      // Ensure URL doesn't have trailing slash
      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      
      console.log('🐛 [SupabaseProvider] Initializing client with URL:', cleanUrl);
      console.log('🐛 [SupabaseProvider] Anon key (first 20 chars):', anonKey?.substring(0, 20) + '...');
      
      // Use createClient from @supabase/supabase-js for browser-side
      // Configure with custom fetch to handle browser extension interference
      const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
        try {
          // Use native fetch, but wrap it to catch and log errors
          const response = await fetch(url, {
            ...options,
            // Ensure headers are set correctly
            headers: {
              ...options?.headers,
              'apikey': anonKey,
              'Content-Type': 'application/json',
            },
          });
          return response;
        } catch (error) {
          console.error('❌ [SupabaseProvider] Custom fetch error:', error);
          throw error;
        }
      };
      
      // Use createBrowserClient from @supabase/ssr for proper PKCE support with Next.js
      // This ensures the code verifier is stored correctly for OAuth callbacks
      const client = createBrowserClient(cleanUrl, anonKey, {
        global: {
          fetch: customFetch,
        },
      });
      
      setSupabase(client);
      console.log('✅ [SupabaseProvider] Client initialized successfully');
      
      // Test the client immediately
      client.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('❌ [SupabaseProvider] Session check error:', error);
        } else {
          console.log('✅ [SupabaseProvider] Session check successful:', data.session ? 'Has session' : 'No session');
        }
      }).catch((err) => {
        console.error('❌ [SupabaseProvider] Session check exception:', err);
      });
    } catch (error) {
      console.error("❌ [SupabaseProvider] Error creating browser client:", error);
      setInitError(error as Error);
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || initError) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("❌ [SupabaseProvider] Error getting session:", error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, initError]);

  // Show error message if initialization failed
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">Supabase Configuration Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{initError.message}</p>
          <p className="text-xs text-muted-foreground">
            Please check your <code className="bg-muted px-1 rounded">.env.local</code> file and ensure
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set.
          </p>
        </div>
      </div>
    );
  }

  // Don't block server components - always render children immediately
  // Server components don't need the Supabase client context
  // Only client components that use useSupabase() will need to wait for initialization
  // Provide a context value even if supabase isn't ready yet
  const contextValue: SupabaseContextType = {
    supabase,
    user,
    session,
    loading: loading || !supabase,
  };

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

/**
 * Hook to access Supabase context
 */
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error("useSupabase must be used within SupabaseProvider. Make sure SupabaseProvider is wrapping your app.");
  }
  // Return context - components should check context.loading and context.supabase before using
  // This allows server components to render while client components wait for initialization
  return context;
}

/**
 * Hook to get current user (similar to Clerk's useUser)
 */
export function useSupabaseUser() {
  const { user, loading } = useSupabase();
  return { user, isLoading: loading, isLoaded: !loading };
}

/**
 * Hook to check if user is signed in (similar to Clerk's useAuth)
 */
export function useSupabaseAuth() {
  const { user, session, loading } = useSupabase();
  return {
    userId: user?.id || null,
    isSignedIn: !!user,
    isLoading: loading,
    session,
  };
}

