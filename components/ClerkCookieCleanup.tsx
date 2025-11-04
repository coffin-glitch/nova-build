"use client";

import { useEffect } from "react";

/**
 * Client-side component to aggressively delete Clerk cookies
 * This ensures Clerk cookies are removed even if middleware misses them
 */
export function ClerkCookieCleanup() {
  useEffect(() => {
    // List of all known Clerk cookie patterns
    const clerkCookiePatterns = [
      /^__clerk_/,
      /^clerk_/,
      /__clerk/,
      /^__refresh_/,
      /^__client_uat/,
      /^__session_/,
      /clerk/,
    ];

    // Function to delete a cookie
    const deleteCookie = (name: string, path = '/', domain?: string) => {
      // Try with domain
      if (domain) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain};`;
      }
      // Try without domain (for localhost)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
      // Try with empty path
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    };

    // Get all cookies
    const allCookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);

    // Find and delete Clerk cookies
    const deletedCookies: string[] = [];
    allCookies.forEach(cookieName => {
      if (clerkCookiePatterns.some(pattern => pattern.test(cookieName))) {
        deleteCookie(cookieName);
        deleteCookie(cookieName, '/', 'localhost');
        deleteCookie(cookieName, '/', window.location.hostname);
        deletedCookies.push(cookieName);
      }
    });

    if (deletedCookies.length > 0) {
      console.log(`🧹 [CLIENT] Deleted ${deletedCookies.length} Clerk cookies:`, deletedCookies);
    }

    // Also try to clear localStorage and sessionStorage of Clerk data
    try {
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.toLowerCase().includes('clerk')) {
          localStorage.removeItem(key);
          console.log(`🧹 [CLIENT] Removed Clerk localStorage key:`, key);
        }
      });
    } catch (e) {
      // Ignore localStorage errors (might be disabled)
    }

    try {
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.toLowerCase().includes('clerk')) {
          sessionStorage.removeItem(key);
          console.log(`🧹 [CLIENT] Removed Clerk sessionStorage key:`, key);
        }
      });
    } catch (e) {
      // Ignore sessionStorage errors
    }
  }, []);

  return null; // This component doesn't render anything
}

