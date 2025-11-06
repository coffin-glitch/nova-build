import type { UserRole } from "@/lib/auth-unified";
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from "next/server";

// Simple route matcher function (replaces Clerk's createRouteMatcher)
function matchRoute(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Handle patterns like "/sign-in(.*)" - convert to "/sign-in.*"
    let normalizedPattern = pattern.replace(/\(\.\*\)/g, '.*').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    // If pattern doesn't start with ^, add it; if it doesn't end with $, add it
    if (!normalizedPattern.startsWith('^')) {
      normalizedPattern = '^' + normalizedPattern.replace(/^\//, '\\/');
    }
    if (!normalizedPattern.endsWith('$')) {
      normalizedPattern = normalizedPattern + '$';
    }
    const regex = new RegExp(normalizedPattern);
    return regex.test(pathname);
  });
}

// Define public routes that don't require authentication
const publicRoutes = [
  "/",
  "/contact",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/auth/callback(.*)",
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
];

// Define admin-only routes
const adminRoutes = [
  "/admin(.*)",
  "/api/admin(.*)",
];

// Define carrier-only routes
const carrierRoutes = [
  "/carrier(.*)",
  "/api/carrier(.*)",
];

// Define authenticated routes (accessible to both carriers and admins)
const authenticatedRoutes = [
  "/find-loads",
  "/bid-board",
  "/book-loads",
  "/my-loads",
  "/current-offers",
  "/dedicated-lanes",
  "/profile",
  "/pricing",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Helper function to create response with CSP headers
  const createResponse = (res?: NextResponse) => {
    const finalResponse = res || NextResponse.next();
    
    // Build CSP with Supabase domains only (Clerk removed)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseBaseUrl = supabaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const isDev = process.env.NODE_ENV === 'development';
    
    // Build CSP with proper template literal interpolation (avoiding literal ${} strings)
    const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.supabase.co https://*.supabase.in${supabaseBaseUrl ? ` ${supabaseBaseUrl}` : ''}`;
    const connectSrc = `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in${supabaseBaseUrl ? ` ${supabaseBaseUrl} ${supabaseBaseUrl}/auth/v1 ${supabaseBaseUrl}/rest/v1` : ''}`;
    const frameSrc = `frame-src 'self' https://*.supabase.co https://*.supabase.in${supabaseBaseUrl ? ` ${supabaseBaseUrl}` : ''}`;
    
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      connectSrc,
      frameSrc,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    finalResponse.headers.set('Content-Security-Policy', csp);
    return finalResponse;
  };

  // Allow public routes - check this FIRST before any auth logic
  if (matchRoute(pathname, publicRoutes)) {
    // For public routes, just return early without any auth checks
    return createResponse();
  }

  // Get Supabase auth
  let userId: string | null = null;
  let userRole: UserRole = "none";

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[middleware] Supabase not configured. Redirecting to sign-in.");
      const signInUrl = new URL("/sign-in", req.url);
      return createResponse(NextResponse.redirect(signInUrl));
    }

    // Create Supabase client with proper cookie handling for Edge runtime
    // Use getAll/setAll format (preferred by Supabase SSR v0.7+) for better chunked cookie support
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          // Get all cookies and filter out Clerk cookies
          return req.cookies.getAll()
            .filter(cookie => {
              const name = cookie.name;
              // Filter out Clerk cookies - we're using Supabase only
              return !name.startsWith('__clerk_') && !name.startsWith('clerk_');
            })
            .map(cookie => ({
              name: cookie.name,
              value: cookie.value
            }));
        },
        setAll(cookiesToSet) {
          // Cookies will be set via response headers
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
        },
      },
    });
    
    // Get user from session with error handling for fresh sign-ins
    let user = null;
    let error = null;
    
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      error = result.error;
    } catch (getUserError: any) {
      // If getUser throws an error (e.g., cookie parsing issue), log but don't block
      console.warn("[middleware] Error getting user (might be fresh sign-in):", getUserError?.message || getUserError);
      // Don't immediately fail - cookies might still be setting up
    }
    
    if (user && !error) {
      // Check if email is confirmed - redirect to verification page if not
      // OAuth providers (like Google) auto-confirm emails, so this mainly applies to email/password
      if (!user.email_confirmed_at && !pathname.startsWith('/verify-email') && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up') && !pathname.startsWith('/auth/callback')) {
        console.log('⚠️ [Middleware] Email not confirmed, redirecting to verification page');
        const verifyUrl = new URL('/verify-email', req.url);
        verifyUrl.searchParams.set('email', user.email || '');
        return createResponse(NextResponse.redirect(verifyUrl));
      }
      
      userId = user.id;
      // Resolve role immediately - this is critical for admin route protection
      userRole = await resolveUserRole(userId);
    }
    
    // Debug logging (only in development and only for page routes, not static assets)
    if (process.env.NODE_ENV === 'development' && !pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|css|js|woff|woff2|ttf|eot)$/)) {
      console.log("🔍 Supabase Auth Result:", {
        userId: userId ? `${userId.substring(0, 8)}...` : null,
        userRole,
        email: user?.email
      });
    }
  } catch (error) {
    console.error("❌ Error in Supabase auth:", error);
  }

  // ⚠️ CRITICAL: API routes should NEVER be redirected - they must return JSON errors
  // Let API routes handle their own authentication and return proper JSON responses
  if (pathname.startsWith('/api/')) {
    let response = createResponse();
    // Set auth headers if authenticated, otherwise let API route return JSON error
    if (userId) {
      response.headers.set("X-User-Id", userId);
      response.headers.set("X-User-Role", userRole);
      response.headers.set("X-Auth-Provider", "supabase");
    }
    return response; // Always allow API routes through - they handle auth errors with JSON
  }

  // Redirect to sign-in if not authenticated (only for page routes, not API routes)
  // IMPORTANT: Only redirect if NOT accessing public routes or auth pages
  // This prevents redirect loops after Google sign-in
  if (!userId && 
      !pathname.startsWith('/sign-in') && 
      !pathname.startsWith('/sign-up') && 
      !pathname.startsWith('/verify-email') && 
      !pathname.startsWith('/auth/callback') &&
      !matchRoute(pathname, publicRoutes)) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set('next', pathname); // Preserve intended destination
    return createResponse(NextResponse.redirect(signInUrl));
  }
  
  // If not authenticated and trying to access sign-in/sign-up or public routes, allow it
  if (!userId) {
    return createResponse();
  }

  // Create response with auth headers for downstream routes
  let response = createResponse();
  
  // Add auth headers for server components
  response.headers.set("X-User-Id", userId);
  response.headers.set("X-User-Role", userRole);
  response.headers.set("X-Auth-Provider", "supabase");

  // CRITICAL: Aggressively delete all Clerk cookies on every request
  // We're using Supabase only, so Clerk cookies must be completely removed
  const allCookieNames = Array.from(req.cookies.getAll()).map(c => c.name);
  const clerkCookieNames = allCookieNames.filter((cookieName) => {
    return cookieName.startsWith('__clerk_') || 
           cookieName.startsWith('clerk_') || 
           cookieName.includes('clerk') ||
           cookieName.startsWith('__refresh_') ||
           cookieName.startsWith('__client_uat') ||
           cookieName.startsWith('__session_');
  });
  
  clerkCookieNames.forEach((cookieName) => {
    // Delete with multiple path/domain combinations to ensure removal
    response.cookies.delete(cookieName);
    response.cookies.set(cookieName, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  });
  
  if (clerkCookieNames.length > 0) {
    console.log(`🧹 [MIDDLEWARE] Deleted ${clerkCookieNames.length} Clerk cookies:`, clerkCookieNames);
  }

  // Check admin routes (only for page routes, not API routes)
  if (!pathname.startsWith('/api/') && matchRoute(pathname, adminRoutes)) {
    if (userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return createResponse(NextResponse.redirect(forbiddenUrl));
    }
  }

  // Check carrier profile status for ALL authenticated PAGE routes (not API routes)
  // This ensures new carriers are redirected to profile setup even when accessing home page
  // Skip API routes - they handle their own errors and return JSON
  if (userRole === "carrier" && !pathname.startsWith('/api/') && !matchRoute(pathname, publicRoutes) && pathname !== '/carrier/profile') {
      try {
        let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // If Supabase URL not set, try to extract from DATABASE_URL
        if (!supabaseUrl && process.env.DATABASE_URL) {
          const dbUrl = process.env.DATABASE_URL;
          const match = dbUrl.match(/postgres\.([^.]+)\./);
          if (match && match[1]) {
            supabaseUrl = `https://${match[1]}.supabase.co`;
          }
        }

        // If we still don't have Supabase credentials, skip server-side check
        if (!supabaseUrl || !supabaseKey) {
          console.warn('[middleware] Supabase env vars not set, skipping server-side profile check.');
          return response;
        }

        // Use Supabase client compatible with Edge runtime
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check profile using supabase_user_id
        const { data: profileResult, error } = await supabase
          .from('carrier_profiles')
          .select('profile_status, is_first_login, profile_completed_at')
          .eq('supabase_user_id', userId)
          .limit(1)
          .maybeSingle();

        // If no profile exists (not just an error), redirect to profile setup
        if (error || !profileResult) {
          console.log('🐛 [Middleware] No carrier profile found for user, redirecting to profile setup');
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url)));
        }

        const profile = profileResult;

        // Check profile status and redirect accordingly
        const profileStatus = profile.profile_status;
        const isFirstLogin = profile.is_first_login;
        const profileCompleted = profile.profile_completed_at;

        // If approved, allow access to all carrier pages
        if (profileStatus === 'approved') {
          return response;
        }

        // If profile is open (needs setup or edits enabled by admin), redirect to profile page
        if (profileStatus === 'open') {
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url)));
        }

        // If first login and profile not completed, redirect to profile setup
        if (isFirstLogin && !profileCompleted) {
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url)));
        }

        // If profile needs setup (no completion), redirect to profile page
        if (!profileCompleted) {
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?setup=true', req.url)));
        }

        // If pending, redirect to profile status page
        if (profileStatus === 'pending') {
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?status=pending', req.url)));
        }

        // If declined, redirect to profile declined page
        if (profileStatus === 'declined') {
          return createResponse(NextResponse.redirect(new URL('/carrier/profile?status=declined', req.url)));
        }
      } catch (error) {
        console.error('Profile check error:', error);
        // On error, allow access to prevent blocking users
        return response;
      }
  }

  // Check carrier routes for access control (only for page routes, not API routes)
  if (!pathname.startsWith('/api/') && matchRoute(pathname, carrierRoutes)) {
    if (userRole !== "carrier" && userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return createResponse(NextResponse.redirect(forbiddenUrl));
    }
  }

  // Check authenticated routes (only for page routes, not API routes)
  if (!pathname.startsWith('/api/') && matchRoute(pathname, authenticatedRoutes)) {
    if (userRole !== "carrier" && userRole !== "admin") {
      const forbiddenUrl = new URL("/forbidden", req.url);
      return createResponse(NextResponse.redirect(forbiddenUrl));
    }
  }

  // All other routes require authentication
  // Return response with auth headers and CSP
  return response;
}

// In-memory role cache for middleware (Edge runtime doesn't support persistent caching)
const roleCache = new Map<string, { role: UserRole; timestamp: number }>();
const ROLE_CACHE_TTL = 30 * 1000; // 30 seconds cache for middleware

/**
 * Resolve user role from Supabase user_roles_cache
 * Uses service role key for admin access in Edge runtime
 * Implements caching to reduce database queries and improve performance
 */
async function resolveUserRole(userId: string): Promise<UserRole> {
  try {
    // Check cache first (30 second TTL)
    const cached = roleCache.get(userId);
    if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
      return cached.role;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      // If service key not available, default to carrier
      const defaultRole: UserRole = "carrier";
      roleCache.set(userId, { role: defaultRole, timestamp: Date.now() });
      return defaultRole;
    }

    // Use Supabase client to query user_roles_cache
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First, try to get role from user_roles_cache table
    const { data, error } = await supabase
      .from('user_roles_cache')
      .select('role')
      .eq('supabase_user_id', userId)
      .limit(1)
      .maybeSingle();

    if (data && data.role) {
      const role = (data.role as UserRole) || "carrier";
      // Cache the result
      roleCache.set(userId, { role, timestamp: Date.now() });
      return role;
    }

    // Fallback: Check user metadata for role (useful for admin accounts)
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (!userError && userData?.user?.user_metadata?.role) {
        const metadataRole = userData.user.user_metadata.role as UserRole;
        if (metadataRole === "admin" || metadataRole === "carrier") {
          // Cache the result
          roleCache.set(userId, { role: metadataRole, timestamp: Date.now() });
          return metadataRole;
        }
      }
    } catch (metadataError) {
      // Ignore metadata lookup errors
      console.warn("[middleware] Error checking user metadata:", metadataError);
    }

    // Default to carrier for authenticated users if no role found
    const defaultRole: UserRole = "carrier";
    roleCache.set(userId, { role: defaultRole, timestamp: Date.now() });
    
    // Log warning if it's a real error (not just "no rows")
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn("[middleware] Error resolving user role:", error.message);
    } else if (!data) {
      // Log if no role found in cache or metadata
      console.log(`[middleware] No role found for user ${userId.substring(0, 8)}..., defaulting to carrier`);
    }
    
    return defaultRole;
  } catch (error: any) {
    console.error("[middleware] Error resolving user role:", error?.message || error);
    const defaultRole: UserRole = "carrier";
    roleCache.set(userId, { role: defaultRole, timestamp: Date.now() });
    return defaultRole; // Safe default
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|.*\\..*).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

