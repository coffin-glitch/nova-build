"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSupabaseUser } from "@/components/providers/SupabaseProvider";
import { useRealtimeUserRoles } from "@/hooks/useRealtimeUserRoles";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Unified role hook - Now uses Supabase only with Realtime updates
 * Automatically refreshes role when user_roles_cache changes in database
 * 
 * CRITICAL FIXES:
 * - Prevents role from switching back to carrier randomly
 * - Preserves admin role if API fails (doesn't downgrade)
 * - Debounces rapid role fetches to prevent race conditions
 * - Stabilizes callbacks to prevent unnecessary re-renders
 */
export function useUnifiedRole() {
  const [role, setRole] = useState<UserRole>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCarrier, setIsCarrier] = useState(false);

  // Always use Supabase (we're fully migrated)
  const { user, isLoading: supabaseLoading } = useSupabaseUser();

  // Store current role in ref to preserve it during API failures
  const currentRoleRef = useRef<UserRole>("none");
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref when role changes
  useEffect(() => {
    currentRoleRef.current = role;
  }, [role]);

  // Fetch role from database with debouncing and error handling
  const fetchRole = useCallback(async (force: boolean = false) => {
    if (supabaseLoading) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setRole("none");
      setIsAdmin(false);
      setIsCarrier(false);
      setIsLoading(false);
      currentRoleRef.current = "none";
      return;
    }

    // Debounce: Don't fetch if we just fetched recently (unless forced)
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 1000) {
      console.log('[useUnifiedRole] Debouncing role fetch (too soon after last fetch)');
      return;
    }

    lastFetchTimeRef.current = now;

    // CRITICAL: Don't default to carrier immediately - wait for API response
    // This prevents the race condition where admin logs in but sees carrier role
    setIsLoading(true);

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
          
          // Only update if role actually changed (prevents unnecessary re-renders)
          if (userRole !== currentRoleRef.current) {
            console.log(`[useUnifiedRole] Role updated: ${currentRoleRef.current} -> ${userRole}`);
            setRole(userRole);
            setIsAdmin(userRole === "admin");
            setIsCarrier(userRole === "carrier" || userRole === "admin");
            currentRoleRef.current = userRole;
          }
          setIsLoading(false);
          return;
        } else {
          // Response is not JSON (probably HTML error page)
          console.warn('Role API returned non-JSON response, preserving current role');
        }
      } else {
        // API returned an error, preserve current role if it's admin
        console.warn('Role API error, preserving current role');
      }
      
      // CRITICAL: If we have a valid role (especially admin), preserve it on API failure
      // Don't downgrade from admin to carrier just because API failed
      if (currentRoleRef.current === "admin") {
        console.log('[useUnifiedRole] API failed but preserving admin role');
        setIsLoading(false);
        return; // Keep admin role
      }
      
      // Fallback: Check user metadata if API fails (only if we don't have admin role)
      const metadataRole = user.user_metadata?.role;
      if (metadataRole === "admin" || metadataRole === "carrier") {
        const userRole = metadataRole as UserRole;
        if (userRole !== currentRoleRef.current) {
          setRole(userRole);
          setIsAdmin(userRole === "admin");
          setIsCarrier(userRole === "carrier" || userRole === "admin");
          currentRoleRef.current = userRole;
        }
        setIsLoading(false);
        return;
      }
      
      // Final fallback: default to carrier (but only if we don't have admin role)
      if (currentRoleRef.current !== "admin") {
        console.warn('[useUnifiedRole] No role found in API or metadata, defaulting to carrier');
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
        currentRoleRef.current = "carrier";
      }
    } catch (error) {
      console.error("Error fetching role:", error);
      
      // CRITICAL: Preserve admin role on error - don't downgrade
      if (currentRoleRef.current === "admin") {
        console.log('[useUnifiedRole] Error fetching role but preserving admin role');
        setIsLoading(false);
        return; // Keep admin role
      }
      
      // Fallback to metadata if available (only if not admin)
      const metadataRole = user.user_metadata?.role;
      if (metadataRole === "admin" || metadataRole === "carrier") {
        const userRole = metadataRole as UserRole;
        if (userRole !== currentRoleRef.current) {
          setRole(userRole);
          setIsAdmin(userRole === "admin");
          setIsCarrier(userRole === "carrier" || userRole === "admin");
          currentRoleRef.current = userRole;
        }
      } else if (currentRoleRef.current !== "admin") {
        // Default to carrier for authenticated users (only after all attempts fail and not admin)
        console.warn('[useUnifiedRole] All role fetch attempts failed, defaulting to carrier');
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
        currentRoleRef.current = "carrier";
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, supabaseLoading]);

  // CRITICAL: Fetch role immediately when user changes (not just on mount)
  // This ensures role is fetched as soon as user logs in, preventing race conditions
  useEffect(() => {
    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    if (user && !supabaseLoading) {
      // Force immediate role fetch when user changes
      fetchRole(true); // Force fetch on user change
    } else if (!user) {
      // Clear role when user logs out
      setRole("none");
      setIsAdmin(false);
      setIsCarrier(false);
      setIsLoading(false);
      currentRoleRef.current = "none";
    }
  }, [user?.id, supabaseLoading]); // Removed fetchRole from dependencies to prevent loops

  // Subscribe to Realtime updates for user_roles_cache
  // This ensures role changes are reflected instantly without page refresh
  // Use ref for callbacks to prevent re-subscriptions
  const realtimeCallbacksRef = useRef({
    onUpdate: (payload: any) => {
      // Only refresh if this update is for the current user
      if (payload.new?.supabase_user_id === user?.id) {
        console.log('[useUnifiedRole] Role updated in database, refreshing...', payload.new);
        // Debounce: Wait a bit before fetching to avoid rapid updates
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          fetchRole(true); // Force fetch on Realtime update
        }, 500); // 500ms debounce
      }
    },
    onInsert: (payload: any) => {
      // New role assigned to current user
      if (payload.new?.supabase_user_id === user?.id) {
        console.log('[useUnifiedRole] Role inserted for current user, refreshing...', payload.new);
        // Debounce: Wait a bit before fetching to avoid rapid updates
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          fetchRole(true); // Force fetch on Realtime update
        }, 500); // 500ms debounce
      }
    },
  });

  useRealtimeUserRoles({
    userId: user?.id,
    onUpdate: realtimeCallbacksRef.current.onUpdate,
    onInsert: realtimeCallbacksRef.current.onInsert,
    enabled: !!user?.id, // Only subscribe when user is logged in
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

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
