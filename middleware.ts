import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { initializeRoleSystem } from "@/lib/role-sync";

// If Clerk env vars are missing during build, fail fast with a readable error.
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
  console.warn("[middleware] Clerk keys are not set. Authentication will not work.");
}

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/bid-board",
  "/find-loads", // Find Loads page
  "/book-loads", // Legacy redirect
  "/contact",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/test-db",
  "/api/test(.*)", // Test API routes
  "/api/bids(.*)", // Bid board API and all sub-routes
  "/api/telegram-bids(.*)", // Telegram bids API
  "/api/health(.*)", // Health check endpoints
  "/api/dev-admin(.*)", // Dev admin API routes
  "/api/admin(.*)", // Admin API routes
  "/api/roles(.*)", // Role management API routes
  "/api/loads(.*)", // Loads API routes
  "/api/offers(.*)", // Offers API routes
  "/debug", // Debug page
  "/dev-admin", // Dev admin page
  // Admin pages now require authentication - removed from public routes
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect to sign-in if not authenticated
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
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
