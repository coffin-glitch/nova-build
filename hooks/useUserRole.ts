"use client";

import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useMemo } from "react";

export type UserRole = "admin" | "carrier" | "none";

interface RoleState {
  role: UserRole;
  isAdmin: boolean;
  isCarrier: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Secure and efficient user role hook (Supabase-only)
 * Uses Supabase user metadata and server-side validation
 * DEPRECATED: Use useUnifiedRole() instead - this is kept for backward compatibility
 */
export function useUserRole(): RoleState {
  const { user, isLoaded } = useUnifiedUser();
  const { role, isAdmin, isCarrier, isLoading } = useUnifiedRole();

  // Memoize the role state to prevent unnecessary re-renders
  const roleState = useMemo((): RoleState => {
    // Still loading
    if (!isLoaded || isLoading) {
      return {
        role: "none",
        isAdmin: false,
        isCarrier: false,
        isLoading: true,
        error: null,
      };
    }

    // No user authenticated
    if (!user) {
      return {
        role: "none",
        isAdmin: false,
        isCarrier: false,
        isLoading: false,
        error: null,
      };
    }

    return {
      role: role || "carrier",
      isAdmin,
      isCarrier,
      isLoading: false,
      error: null,
    };
  }, [user, isLoaded, role, isAdmin, isCarrier, isLoading]);

  return roleState;
}

/**
 * Optimized convenience hooks that don't cause re-renders
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useUserRole();
  return isAdmin;
}

export function useIsCarrier(): boolean {
  const { isCarrier } = useUserRole();
  return isCarrier;
}

export function useRole(): UserRole {
  const { role } = useUserRole();
  return role;
}

/**
 * Hook for server-side role validation
 * This should be used for sensitive operations
 * DEPRECATED: Use useUnifiedRole() instead
 */
export function useServerRoleValidation() {
  const { user } = useUnifiedUser();
  
  const validateRole = async (requiredRole: UserRole): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const response = await fetch(`/api/auth/validate-role?role=${requiredRole}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) return false;
      
      const result = await response.json();
      return result.valid;
    } catch (error) {
      console.error('Role validation failed:', error);
      return false;
    }
  };

  return { validateRole };
}