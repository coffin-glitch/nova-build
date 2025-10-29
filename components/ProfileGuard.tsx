"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");

  const { data: profileData, error: profileError, isLoading: profileLoading } = useSWR(
    user ? "/api/carrier/profile" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const profile = profileData?.data;

  useEffect(() => {
    if (!isLoaded || !user) return;

    const currentPath = window.location.pathname;
    
    // Always allow profile page access - never redirect away from profile page
    if (currentPath === '/carrier/profile' || currentPath.startsWith('/carrier/profile')) {
      setShouldRedirect(false);
      return;
    }

    // Don't redirect while profile is still loading - wait for data
    // This prevents flickering and false redirects during SWR re-fetches
    if (profileLoading) {
      setShouldRedirect(false);
      return;
    }

    // If no profile exists or there was an error fetching profile, redirect to profile creation
    // But only if we're not already on an allowed page
    if (!profile || profileError) {
      // Allow dashboard access even if profile is missing (will show prompt there)
      if (currentPath === '/carrier' || currentPath === '/dashboard') {
        setShouldRedirect(false);
        return;
      }
      setRedirectUrl("/carrier/profile?setup=true");
      setShouldRedirect(true);
      return;
    }

    // If profile is not approved, restrict access to only dashboard and profile pages
    if (profile.profile_status !== 'approved') {
      // Allow dashboard and profile pages only
      if (currentPath === '/carrier' || currentPath.startsWith('/carrier/profile')) {
        setShouldRedirect(false);
        return;
      }
      
      // Redirect all other pages to profile with appropriate status
      if (profile.is_first_login && !profile.profile_completed_at) {
        setRedirectUrl("/carrier/profile?setup=true");
      } else if (profile.profile_status === 'pending') {
        setRedirectUrl("/carrier/profile?status=pending");
      } else if (profile.profile_status === 'declined') {
        setRedirectUrl("/carrier/profile?status=declined");
      } else {
        setRedirectUrl("/carrier/profile?setup=true");
      }
      
      setShouldRedirect(true);
      return;
    }

    // If profile is approved, allow access to all pages
    setShouldRedirect(false);

  }, [isLoaded, user, profile, profileLoading, profileError, router]);

  useEffect(() => {
    if (shouldRedirect && redirectUrl) {
      router.push(redirectUrl);
    }
  }, [shouldRedirect, redirectUrl, router]);

  // Show loading ONLY on initial load (when user or profile data is not yet loaded)
  // Don't block rendering during SWR re-fetches to prevent flickering
  if (!isLoaded || (profileLoading && !profile && !profileError)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If we need to redirect, show loading but don't block for too long
  // This prevents flickering when redirect happens during profile re-fetch
  if (shouldRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
