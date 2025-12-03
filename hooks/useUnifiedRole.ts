"use client";

import { useEffect, useRef } from "react";
import { useSupabaseUser } from "@/components/providers/SupabaseProvider";
import { useRealtimeUserRoles } from "@/hooks/useRealtimeUserRoles";
import { useUnifiedRoleCore, type UserRole } from "./unifiedRoleCore";

// Re-export type for backward compatibility
export type { UserRole };

/**
 * Unified role hook - Now uses Supabase only with Realtime updates
 * Automatically refreshes role when user_roles_cache changes in database
 * 
 * CRITICAL FIXES:
 * - Prevents role from switching back to carrier randomly
 * - Preserves admin role if API fails (doesn't downgrade)
 * - Debounces rapid role fetches to prevent race conditions
 * - Stabilizes callbacks to prevent unnecessary re-renders
 * - BREAKS CIRCULAR DEPENDENCY: Uses unifiedRoleCore to avoid provider dependency cycles
 */
export function useUnifiedRole() {
  // Get user from Supabase context (this is the only provider dependency)
  // This is safe because hooks are called during render, not module initialization
  const { user, isLoading: supabaseLoading } = useSupabaseUser();

  // Use core role logic (separated to avoid circular dependencies)
  // The core hook accepts user as parameter instead of getting it from context
  const {
    role,
    isAdmin,
    isCarrier,
    isLoading,
    error,
    fetchRole,
    currentRoleRef,
    fetchTimeoutRef,
  } = useUnifiedRoleCore(user, supabaseLoading);

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
    }
  }, [user?.id, supabaseLoading, fetchRole]); // Include fetchRole but it's memoized in core

  // Subscribe to Realtime updates for user_roles_cache
  // This ensures role changes are reflected instantly without page refresh
  // Use ref for callbacks to prevent re-subscriptions
  // FIXED: Initialize ref with functions that access current values via closure
  // This prevents TDZ issues if user or fetchRole aren't ready during module initialization
  const realtimeCallbacksRef = useRef<{
    onUpdate: (payload: any) => void;
    onInsert: (payload: any) => void;
  }>({
    onUpdate: (payload: any) => {
      // Access user and fetchRole from closure - they'll be current when callback is called
      // This is safe because callbacks are only called after component is mounted
    },
    onInsert: (payload: any) => {
      // Access user and fetchRole from closure - they'll be current when callback is called
    },
  });

  // Update callbacks ref when user or fetchRole change (without triggering re-subscription)
  useEffect(() => {
    realtimeCallbacksRef.current = {
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
    };
  }, [user?.id, fetchRole]);

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
