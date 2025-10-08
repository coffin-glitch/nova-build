"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export type UserRole = "admin" | "carrier" | "none";

interface RoleState {
  role: UserRole;
  isAdmin: boolean;
  isCarrier: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useUserRole(): RoleState {
  const { user, isLoaded } = useUser();
  const [roleState, setRoleState] = useState<RoleState>({
    role: "none",
    isAdmin: false,
    isCarrier: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkRole = async () => {
      if (!user || !isLoaded) {
        setRoleState({
          role: "none",
          isAdmin: false,
          isCarrier: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      try {
        console.log("🔍 useUserRole: Checking role for user:", user.id);
        setRoleState(prev => ({ ...prev, isLoading: true, error: null }));

        const response = await fetch(`/api/roles?userId=${user.id}&action=check`);
        
        if (!response.ok) {
          throw new Error(`Role check failed: ${response.status}`);
        }

        const data = await response.json();
        console.log("🎯 useUserRole: Role result:", data);

        setRoleState({
          role: data.role,
          isAdmin: data.isAdmin,
          isCarrier: data.isCarrier,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("❌ useUserRole: Error checking role:", error);
        setRoleState({
          role: "none",
          isAdmin: false,
          isCarrier: false,
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    checkRole();
  }, [user, isLoaded]);

  return roleState;
}

// Convenience hooks
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
