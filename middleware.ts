import { getClerkUserRole } from "@/lib/clerk-server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
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
  if (!sessionClaims?.public_metadata?.role) {
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

  // Check carrier routes
  if (isCarrierRoute(req)) {
    if (userRole !== "carrier" && userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return NextResponse.redirect(forbiddenUrl);
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
