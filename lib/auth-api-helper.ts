/**
 * API Route Authentication Helper (Supabase-Only)
 * 
 * Provides utilities for API routes to read auth information from middleware headers
 * or fall back to direct Supabase auth calls.
 * 
 * All routes should use these helpers for authentication.
 */

import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UserRole } from "./auth-unified";

interface ApiAuthResult {
  userId: string;
  userRole: UserRole;
  email: string | null;
  provider: "supabase";
  fromHeader: boolean;
  authProvider: "supabase"; // For compatibility with existing code
}

/**
 * Get auth from middleware headers (preferred) or fallback to direct Supabase auth
 * 
 * API routes should use this to get user identity. It first checks middleware headers
 * (set by Supabase middleware) for performance, then falls back to direct Supabase calls.
 * 
 * Supports both NextRequest (for reading headers) and direct header access.
 */
export async function getApiAuth(request?: NextRequest): Promise<ApiAuthResult | null> {
  try {
    let userId: string | null = null;
    let userRole: UserRole | null = null;
    
    // Try to get from middleware headers first (fastest)
    if (request) {
      // Use NextRequest headers if provided
      userId = request.headers.get("X-User-Id");
      userRole = request.headers.get("X-User-Role") as UserRole | null;
    } else {
      // Fallback to Next.js headers() function
      const headersList = await headers();
      userId = headersList.get("X-User-Id");
      userRole = headersList.get("X-User-Role") as UserRole | null;
    }
    
    if (userId && userRole) {
      // Try to get email from headers or fetch it
      let email: string | null = null;
      if (request) {
        email = request.headers.get("X-User-Email");
      } else {
        const headersList = await headers();
        email = headersList.get("X-User-Email");
      }
      
      // If email not in headers, fetch from Supabase
      if (!email) {
        try {
          const { getUnifiedAuth } = await import('@/lib/auth-unified');
          const unifiedAuth = await getUnifiedAuth();
          email = unifiedAuth.email;
        } catch {
          // Ignore - email is optional
        }
      }
      
      return {
        userId,
        userRole: userRole as UserRole,
        email,
        provider: "supabase",
        fromHeader: true,
        authProvider: "supabase",
      };
    }
    
    // Fallback to direct Supabase auth (slower but works if headers not set)
    // For API routes, use getUnifiedAuth which properly handles Supabase session cookies
    try {
      const { getUnifiedAuth } = await import('@/lib/auth-unified');
      const unifiedAuth = await getUnifiedAuth();
      
      if (!unifiedAuth.userId) {
        console.log('[auth-api-helper] No user from unified auth fallback');
        return null;
      }
      
      return {
        userId: unifiedAuth.userId,
        userRole: unifiedAuth.userRole,
        email: unifiedAuth.email,
        provider: "supabase",
        fromHeader: false,
        authProvider: "supabase",
      };
    } catch (fallbackError) {
      console.error("[auth-api-helper] Error in Supabase fallback:", fallbackError);
      return null;
    }
  } catch (error) {
    console.error("[auth-api-helper] Error getting API auth:", error);
    return null;
  }
}

/**
 * Require authentication in API route (throws if not authenticated)
 */
export async function requireApiAuth(request?: NextRequest): Promise<ApiAuthResult> {
  const auth = await getApiAuth(request);
  
  if (!auth) {
    // Return proper JSON error response instead of throwing
    // This prevents Next.js from rendering HTML error pages
    throw new Error("Unauthorized");
  }
  
  return auth;
}

/**
 * Require admin role in API route (throws if not admin)
 * Returns NextResponse with 403 if not admin (for easy error handling)
 */
export async function requireApiAdmin(request?: NextRequest): Promise<ApiAuthResult> {
  try {
    const auth = await requireApiAuth(request);
    
    if (auth.userRole !== "admin") {
      throw new Error("Admin access required");
    }
    
    return auth;
  } catch (error: any) {
    if (error.message === "Admin access required") {
      throw error; // Let caller handle with 403
    }
    throw error;
  }
}

/**
 * Require carrier or admin role in API route (throws if neither)
 */
export async function requireApiCarrier(request?: NextRequest): Promise<ApiAuthResult> {
  const auth = await requireApiAuth(request);
  
  if (auth.userRole !== "carrier" && auth.userRole !== "admin") {
    throw new Error("Carrier access required");
  }
  
  return auth;
}

/**
 * Helper to return 401 Unauthorized response
 */
export function unauthorizedResponse(): NextResponse {
  const { addSecurityHeaders } = require('./api-security');
  const response = NextResponse.json(
    { 
      error: "Unauthorized",
      message: "Authentication required",
      code: "UNAUTHORIZED"
    },
    { status: 401 }
  );
  return addSecurityHeaders(response);
}

/**
 * Helper to return 403 Forbidden response
 */
export function forbiddenResponse(message: string = "Forbidden"): NextResponse {
  const { addSecurityHeaders } = require('./api-security');
  const response = NextResponse.json(
    { 
      error: "Forbidden",
      message: message,
      code: "FORBIDDEN"
    },
    { status: 403 }
  );
  return addSecurityHeaders(response);
}

