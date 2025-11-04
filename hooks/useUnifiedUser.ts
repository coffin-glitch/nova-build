"use client";

import { useSupabaseUser } from "@/components/providers/SupabaseProvider";

/**
 * Unified user hook - Now uses Supabase only
 * Returns user object in Clerk-like format for compatibility
 */
export function useUnifiedUser() {
  // Always use Supabase (we're fully migrated)
  const { user, isLoading, isLoaded } = useSupabaseUser();
  
  // Convert Supabase user to Clerk-like format
  return {
    user: user ? {
      id: user.id,
      emailAddresses: user.email ? [{ emailAddress: user.email }] : [],
      firstName: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || null,
      lastName: user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || null,
      email: user.email || null,
      // Map Supabase metadata to Clerk metadata format
      publicMetadata: {
        role: user.user_metadata?.role || "carrier",
      },
    } : null,
    isLoaded,
    isLoading,
  };
}
