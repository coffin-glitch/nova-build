"use client";

import { useEffect, useState } from "react";
import { useSupabaseUser } from "@/components/providers/SupabaseProvider";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Unified role hook - Now uses Supabase only
 */
export function useUnifiedRole() {
  const [role, setRole] = useState<UserRole>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCarrier, setIsCarrier] = useState(false);

  // Always use Supabase (we're fully migrated)
  const { user, isLoading: supabaseLoading } = useSupabaseUser();

  useEffect(() => {
    async function fetchRole() {
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
        // First check user metadata
        const metadataRole = user.user_metadata?.role;
        if (metadataRole === "admin" || metadataRole === "carrier") {
          const userRole = metadataRole as UserRole;
          setRole(userRole);
          setIsAdmin(userRole === "admin");
          setIsCarrier(userRole === "carrier");
          setIsLoading(false);
          return;
        }

        // If not in metadata, fetch from API
        const response = await fetch('/api/user/role', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
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
          } else {
            // Response is not JSON (probably HTML error page)
            console.warn('Role API returned non-JSON response, defaulting to carrier');
            setRole("carrier");
            setIsAdmin(false);
            setIsCarrier(true);
          }
        } else {
          // API returned an error, default to carrier
          setRole("carrier");
          setIsAdmin(false);
          setIsCarrier(true);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
        // Default to carrier for authenticated users
        setRole("carrier");
        setIsAdmin(false);
        setIsCarrier(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRole();
  }, [user, supabaseLoading]);

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
