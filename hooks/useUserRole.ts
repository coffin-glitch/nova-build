"use client";

import { useUser } from "@clerk/nextjs";
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
 * Secure and efficient user role hook that prevents infinite loops
 * Uses Clerk's built-in metadata and server-side validation
 */
export function useUserRole(): RoleState {
  const { user, isLoaded } = useUser();

  // Memoize the role state to prevent unnecessary re-renders
  const roleState = useMemo((): RoleState => {
    // Still loading Clerk
    if (!isLoaded) {
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

    // Get role from Clerk metadata (most secure and efficient)
    const metadataRole = (user.publicMetadata as any)?.role?.toLowerCase();
    
    // Validate role and provide secure defaults
    let role: UserRole = "carrier"; // Default to least privileged role
    
    if (metadataRole === "admin") {
      role = "admin";
    } else if (metadataRole === "carrier") {
      role = "carrier";
    }
    // Any other value defaults to "carrier" for security

    return {
      role,
      isAdmin: role === "admin",
      isCarrier: role === "carrier",
      isLoading: false,
      error: null,
    };
  }, [user?.id, user?.publicMetadata, isLoaded]);

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
 */
export function useServerRoleValidation() {
  const { user } = useUser();
  
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