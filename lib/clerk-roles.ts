"use client";

import { useUser } from "@clerk/nextjs";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Hook to get user role directly from Clerk metadata
 * This replaces the complex database-based role system
 */
export function useClerkRole() {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded || !user) {
    return {
      role: "none" as UserRole,
      isAdmin: false,
      isCarrier: false,
      isLoading: !isLoaded,
      error: null,
    };
  }

  // Get role from Clerk public metadata
  const role = (user.publicMetadata?.role as string)?.toLowerCase() || "carrier";
  
  // Validate role
  const validRole: UserRole = role === "admin" || role === "carrier" ? role : "carrier";
  
  return {
    role: validRole,
    isAdmin: validRole === "admin",
    isCarrier: validRole === "carrier",
    isLoading: false,
    error: null,
  };
}

// Convenience hooks
export function useIsAdmin(): boolean {
  const { isAdmin } = useClerkRole();
  return isAdmin;
}

export function useIsCarrier(): boolean {
  const { isCarrier } = useClerkRole();
  return isCarrier;
}

export function useRole(): UserRole {
  const { role } = useClerkRole();
  return role;
}
