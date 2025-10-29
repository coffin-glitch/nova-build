import { getClerkUserRole } from "@/lib/auth-server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

// If Clerk env vars are missing during build, fail fast with a readable error.
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
  console.warn("[middleware] Clerk keys are not set. Authentication will not work.");
}

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/contact",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/test-db",
  "/api/reset-telegram-bids",
  "/api/test(.*)",
  "/api/bids(.*)",
  "/api/telegram-bids(.*)",
  "/api/health(.*)",
  "/api/archive-bids(.*)",
  "/api/loads(.*)",
  "/api/offers(.*)",
  "/debug",
]);

// Define admin-only routes
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

// Define carrier-only routes
const isCarrierRoute = createRouteMatcher([
  "/carrier(.*)",
  "/api/carrier(.*)",
]);

// Define authenticated routes (accessible to both carriers and admins)
const isAuthenticatedRoute = createRouteMatcher([
  "/find-loads",
  "/bid-board",
  "/book-loads",
  "/my-loads",
  "/current-offers",
  "/dedicated-lanes",
  "/profile",
  "/pricing",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const { pathname } = req.nextUrl;

  // Debug logging
  console.log("🔍 Middleware Debug:", {
    pathname,
    userId,
    sessionClaims: sessionClaims?.public_metadata,
    userRole: (sessionClaims?.public_metadata as any)?.role?.toLowerCase()
  });

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect to sign-in if not authenticated
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get user role from Clerk metadata (fallback to server-side check)
  let userRole = (sessionClaims?.public_metadata as any)?.role?.toLowerCase() || "carrier";
  
  // If session claims don't have role, fetch from server
  if (!(sessionClaims?.public_metadata as any)?.role) {
    try {
      userRole = await getClerkUserRole(userId);
      console.log("🔍 Server-side role check:", { userId, userRole });
    } catch (error) {
      console.error("❌ Error fetching user role:", error);
      userRole = "carrier"; // Default to carrier on error
    }
  }

  // Check admin routes
  if (isAdminRoute(req)) {
    console.log("🔍 Admin route check:", { userRole, isAdmin: userRole === "admin" });
    if (userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // Check carrier routes and profile status
  if (isCarrierRoute(req)) {
    if (userRole !== "carrier" && userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return NextResponse.redirect(forbiddenUrl);
    }

    // Check carrier profile status for carrier users (skip for admins)
    // Skip profile check if Supabase env vars are not set - client-side ProfileGuard will handle it
    if (userRole === "carrier" && pathname !== '/carrier/profile') {
      try {
        // Extract Supabase URL from DATABASE_URL if NEXT_PUBLIC_SUPABASE_URL is not set
        let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // If Supabase URL not set, try to extract from DATABASE_URL
        if (!supabaseUrl && process.env.DATABASE_URL) {
          const dbUrl = process.env.DATABASE_URL;
          // Extract project ref from Supabase pooler URL format:
          // postgresql://postgres.PROJECT_REF:password@...
          const match = dbUrl.match(/postgres\.([^.]+)\./);
          if (match && match[1]) {
            supabaseUrl = `https://${match[1]}.supabase.co`;
          }
        }

        // If we still don't have Supabase credentials, skip server-side check
        // Client-side ProfileGuard will handle profile validation
        if (!supabaseUrl || !supabaseKey) {
          console.warn('[middleware] Supabase env vars not set, skipping server-side profile check. Client-side ProfileGuard will handle.');
          return NextResponse.next();
        }

        // Use Supabase client compatible with Edge runtime
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: profileResult, error } = await supabase
          .from('carrier_profiles')
          .select('profile_status, is_first_login, profile_completed_at')
          .eq('clerk_user_id', userId)
          .limit(1)
          .single();

        if (error || !profileResult) {
          // If no profile, allow access (will handle client-side)
          return NextResponse.next();
        }

        const profile = profileResult;

        // Check profile status and redirect accordingly
        const profileStatus = profile.profile_status;
        const isFirstLogin = profile.is_first_login;
        const profileCompleted = profile.profile_completed_at;

        // If approved, allow access to all carrier pages
        if (profileStatus === 'approved') {
          return NextResponse.next();
        }

        // If profile needs setup (no completion or first login)
        if (!profileCompleted || (isFirstLogin && !profileCompleted)) {
          return NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url));
        }

        // If profile is open (setup required), redirect to profile page
        if (profileStatus === 'open') {
          return NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url));
        }

        // If pending, redirect to profile status page
        if (profileStatus === 'pending') {
          return NextResponse.redirect(new URL('/carrier/profile?status=pending', req.url));
        }

        // If declined, redirect to profile declined page
        if (profileStatus === 'declined') {
          return NextResponse.redirect(new URL('/carrier/profile?status=declined', req.url));
        }
      } catch (error) {
        console.error('Profile check error:', error);
        // On error, allow access to prevent blocking users - client-side ProfileGuard will handle
        return NextResponse.next();
      }
    }
  }

  // Check authenticated routes (accessible to both carriers and admins)
  if (isAuthenticatedRoute(req)) {
    if (userRole !== "carrier" && userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // All other routes require authentication
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|.*\\..*).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
