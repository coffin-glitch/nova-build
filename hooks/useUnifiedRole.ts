"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabaseUser } from "@/components/providers/SupabaseProvider";
import { useRealtimeUserRoles } from "@/hooks/useRealtimeUserRoles";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Unified role hook - Now uses Supabase only with Realtime updates
 * Automatically refreshes role when user_roles_cache changes in database
 */
export function useUnifiedRole() {
  const [role, setRole] = useState<UserRole>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCarrier, setIsCarrier] = useState(false);

  // Always use Supabase (we're fully migrated)
  const { user, isLoading: supabaseLoading } = useSupabaseUser();

  // Fetch role from database
  const fetchRole = useCallback(async () => {
    if (supabaseLoading) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setRole("none");
      setIsAdmin(false);
      setIsCarrier(false);
      setIsLoading(false);
      return;
    }

    try {
      // CRITICAL: Always query database first (source of truth)
      // User metadata may be stale after role changes
      const response = await fetch('/api/user/role', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always fetch fresh role from database
      });

      if (response.ok) {
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          const userRole = (data.role || "carrier") as UserRole;
          setRole(userRole);
          setIsAdmin(userRole === "admin");
          setIsCarrier(userRole === "carrier");
          setIsLoading(false);
          return;
        } else {
          // Response is not JSON (probably HTML error page)
          console.warn('Role API returned non-JSON response, falling back to metadata');
        }
      } else {
        // API returned an error, fall back to metadata
        console.warn('Role API error, falling back to user metadata');
      }
      
      // Fallback: Check user metadata if API fails
      const metadataRole = user.user_metadata?.role;
      if (metadataRole === "admin" || metadataRole === "carrier") {
        const userRole = metadataRole as UserRole;
        setRole(userRole);
        setIsAdmin(userRole === "admin");
        setIsCarrier(userRole === "carrier");
        setIsLoading(false);
        return;
      }
      
      // Final fallback: default to carrier
      setRole("carrier");
      setIsAdmin(false);
      setIsCarrier(true);
    } catch (error) {
      console.error("Error fetching role:", error);
      // Fallback to metadata if available
      const metadataRole = user.user_metadata?.role;
      if (metadataRole === "admin" || metadataRole === "carrier") {
        const userRole = metadataRole as UserRole;
        setRole(userRole);
        setIsAdmin(userRole === "admin");
        setIsCarrier(userRole === "carrier");
      } else {
        // Default to carrier for authenticated users
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, supabaseLoading]);

  // Initial fetch on mount or when user changes
  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  // Subscribe to Realtime updates for user_roles_cache
  // This ensures role changes are reflected instantly without page refresh
  useRealtimeUserRoles({
    userId: user?.id,
    onUpdate: (payload) => {
      // Only refresh if this update is for the current user
      if (payload.new?.supabase_user_id === user?.id) {
        console.log('[useUnifiedRole] Role updated in database, refreshing...', payload.new);
        fetchRole(); // Refresh role immediately
      }
    },
    onInsert: (payload) => {
      // New role assigned to current user
      if (payload.new?.supabase_user_id === user?.id) {
        console.log('[useUnifiedRole] Role inserted for current user, refreshing...', payload.new);
        fetchRole();
      }
    },
    enabled: !!user?.id, // Only subscribe when user is logged in
  });

  return {
    role,
    isAdmin,
    isCarrier,
    isLoading,
    error: null,
  };
}

// Convenience hooks
export function useIsAdmin(): boolean {
  const { isAdmin } = useUnifiedRole();
  return isAdmin;
}

export function useIsCarrier(): boolean {
  const { isCarrier } = useUnifiedRole();
  return isCarrier;
}

export function useRole(): UserRole {
  const { role } = useUnifiedRole();
  return role;
}
