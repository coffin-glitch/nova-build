"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Core unified role logic - separated from provider dependencies
 * This module contains the role state management without depending on SupabaseProvider
 * to prevent circular dependency issues.
 * 
 * The actual hook useUnifiedRole() will wrap this and provide the user from context.
 */
export interface UnifiedRoleState {
  role: UserRole;
  isAdmin: boolean;
  isCarrier: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Core role fetching logic - accepts user as parameter to avoid provider dependency
 * This is a hook that can be used independently without requiring SupabaseProvider context
 */
export function useUnifiedRoleCore(user: User | null, supabaseLoading: boolean) {
  const [role, setRole] = useState<UserRole>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCarrier, setIsCarrier] = useState(false);

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
      console.log('[unifiedRoleCore] Debouncing role fetch (too soon after last fetch)');
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
            console.log(`[unifiedRoleCore] Role updated: ${currentRoleRef.current} -> ${userRole}`);
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
        console.log('[unifiedRoleCore] API failed but preserving admin role');
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
        console.warn('[unifiedRoleCore] No role found in API or metadata, defaulting to carrier');
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
        currentRoleRef.current = "carrier";
      }
    } catch (error) {
      console.error("Error fetching role:", error);
      
      // CRITICAL: Preserve admin role on error - don't downgrade
      if (currentRoleRef.current === "admin") {
        console.log('[unifiedRoleCore] Error fetching role but preserving admin role');
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
        console.warn('[unifiedRoleCore] All role fetch attempts failed, defaulting to carrier');
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
        currentRoleRef.current = "carrier";
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, supabaseLoading]);

  return {
    role,
    isAdmin,
    isCarrier,
    isLoading,
    error: null,
    fetchRole,
    currentRoleRef,
    fetchTimeoutRef,
  };
}

