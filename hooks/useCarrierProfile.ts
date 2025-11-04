"use client";

import { swrFetcher } from "@/lib/safe-fetcher";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useEffect } from "react";
import useSWR from "swr";

/**
 * Custom hook for fetching carrier profile with optimized caching
 * This hook is used by ProfileGuard and other components that need profile data
 * 
 * Features:
 * - Only fetches when user is logged in
 * - Aggressive caching to prevent unnecessary requests
 * - Auto-refreshes on visibility change (catches admin approvals)
 * - Returns mutate function for manual cache updates
 */
export function useCarrierProfile() {
  const { user } = useUnifiedUser();

  const { 
    data: profileData, 
    error: profileError, 
    isLoading: profileLoading,
    mutate: mutateProfile 
  } = useSWR(
    user ? "/api/carrier/profile" : null,
    swrFetcher,
    { 
      // Only refresh on focus/reconnect - no aggressive polling
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Don't refresh on interval to prevent constant re-fetching
      refreshInterval: 0,
      // Dedupe requests within 30 seconds
      dedupingInterval: 30000,
      // Cache profile data aggressively
      revalidateIfStale: false,
      // Revalidate on mount to get fresh data
      revalidateOnMount: true,
      // Keep data on unmount for faster navigation
      keepPreviousData: true,
      // Error retry with exponential backoff
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  const profile = profileData?.data;
  // Explicitly check for approved status with null safety
  const isApproved = profile?.profile_status === 'approved' || false;
  const isPending = profile?.profile_status === 'pending' || false;
  const isDeclined = profile?.profile_status === 'declined' || false;

  // Refresh profile when page becomes visible (catches admin approvals)
  // This must be in useEffect to avoid adding listeners on every render
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to avoid immediate refetch on mount
        setTimeout(() => {
          mutateProfile();
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, mutateProfile]);

  return {
    profile,
    isLoading: profileLoading,
    error: profileError,
    isApproved,
    isPending,
    isDeclined,
    mutate: mutateProfile,
  };
}

