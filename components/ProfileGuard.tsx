"use client";

import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useCarrierProfile } from "@/hooks/useCarrierProfile";

interface ProfileGuardProps {
  children: React.ReactNode;
}

/**
 * ProfileGuard Component - Supabase Auth Compatible
 * 
 * Best Practices Implementation:
 * - Uses stable caching to prevent constant re-fetching
 * - Only refreshes profile on focus/reconnect, not on interval
 * - Properly handles approved status without flickering
 * - Uses pathname from next/navigation for accurate route detection
 * - Prevents redirect loops with proper state management
 */
export function ProfileGuard({ children }: ProfileGuardProps) {
  const { user, isLoaded } = useUnifiedUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track last known approved status to prevent flickering
  const lastApprovedStatus = useRef<boolean | null>(null);

  // Use optimized profile hook
  const { 
    profile,
    isLoading: profileLoading,
    error: profileError,
    isApproved,
    mutate: mutateProfile
  } = useCarrierProfile();

  const profileStatus = profile?.profile_status;

  // Track mounted state (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle profile approval status changes - refresh cache when approved
  useEffect(() => {
    if (mounted && isLoaded && user && isApproved && lastApprovedStatus.current !== true) {
      // Profile just got approved - clear any redirect state
      setIsRedirecting(false);
      lastApprovedStatus.current = true;
      
      // Invalidate SWR cache to ensure fresh data everywhere
      mutateProfile();
    } else if (mounted && isLoaded && user && !isApproved) {
      lastApprovedStatus.current = false;
    }
  }, [mounted, isLoaded, user, isApproved, mutateProfile]);

  // Main redirect logic
  useEffect(() => {
    // Clear any pending redirect timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    // Don't process redirects until mounted and user loaded
    if (!mounted || !isLoaded || !user) {
      return;
    }

    // Always allow profile page access - never redirect away from it
    if (pathname === '/carrier/profile' || pathname.startsWith('/carrier/profile')) {
      setIsRedirecting(false);
      return;
    }

    // CRITICAL: Check if profile is approved FIRST - even before loading check
    // This prevents race conditions where profile loads as approved but redirect triggers
    if (profile && (profile.profile_status === 'approved' || isApproved || profileStatus === 'approved')) {
      setIsRedirecting(false);
      // Clear any pending redirects since profile is approved
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      return;
    }

    // Don't redirect while profile is loading - wait for data
    if (profileLoading) {
      setIsRedirecting(false);
      return;
    }

    // If there was an error fetching profile, don't redirect - allow user to proceed
    // The API route will return 401/403 if auth is actually required
    if (profileError) {
      console.warn('[ProfileGuard] Error fetching profile (allowing access):', profileError);
      setIsRedirecting(false);
      return;
    }

    // If no profile exists, redirect to profile creation
    if (!profile) {
      // Allow dashboard and profile pages even if profile is missing
      if (pathname === '/carrier' || pathname === '/dashboard') {
        setIsRedirecting(false);
        return;
      }
      
      // Redirect to profile setup after a brief delay to prevent flicker
      redirectTimeoutRef.current = setTimeout(() => {
        setIsRedirecting(true);
        router.push("/carrier/profile?setup=true");
      }, 100);
      return;
    }

    // If profile is not approved, restrict access to only dashboard and profile pages
    // Allow dashboard and profile pages
    if (pathname === '/carrier' || pathname === '/dashboard') {
      setIsRedirecting(false);
      return;
    }
    
    // Determine redirect URL based on profile status
    let redirectUrl = "/carrier/profile?setup=true";
    
    if (profile.is_first_login && !profile.profile_completed_at) {
      redirectUrl = "/carrier/profile?setup=true";
    } else if (profileStatus === 'pending') {
      redirectUrl = "/carrier/profile?status=pending";
    } else if (profileStatus === 'declined') {
      redirectUrl = "/carrier/profile?status=declined";
    }
    
    // Only set redirect if profile is NOT approved (double-check to prevent race condition)
    if (profileStatus !== 'approved' && !isApproved) {
      // Redirect after a brief delay to prevent flicker
      redirectTimeoutRef.current = setTimeout(() => {
        // Final check before redirecting - ensure profile hasn't been approved
        if (!isApproved && profileStatus !== 'approved') {
          setIsRedirecting(true);
          router.push(redirectUrl);
        }
      }, 100);
    }

    // Cleanup function
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [
    mounted, 
    isLoaded, 
    user, 
    profile, 
    profileStatus,
    profileLoading, 
    profileError, 
    pathname,
    router,
    isApproved
  ]);

  // Note: Visibility change handling is now in useCarrierProfile hook

  // CRITICAL: Always render children immediately - never block server components
  // During SSR or initial render, always render to prevent hydration issues
  const isProfilePage = pathname === '/carrier/profile' || pathname.startsWith('/carrier/profile');
  
  // NEVER block profile page - always render it immediately
  if (isProfilePage || !mounted) {
    return <>{children}</>;
  }
  
  // For non-profile pages, show loading only if:
  // 1. User is not loaded yet
  // 2. Profile is loading AND we don't have cached data
  // 3. We're actively redirecting
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Only show loading if profile is loading AND we don't have any cached data
  // This prevents flickering when navigating between pages
  if (profileLoading && !profile && !profileError && !isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show loading spinner only when actively redirecting
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Always render children as fallback
  return <>{children}</>;
}
