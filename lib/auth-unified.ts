/**
 * Supabase-Only Authentication Helper
 * 
 * Provides a single interface for Supabase auth operations.
 * All Clerk dependencies have been removed.
 */

import { cookies, headers } from "next/headers";
import { getSupabaseService } from "./supabase";

// Lazy import for db to avoid Edge runtime issues
let sql: any = null;
let sqlImportError: Error | null = null;

async function getSql() {
  if (!sql && !sqlImportError) {
    try {
      const dbModule = await import("./db");
      sql = dbModule.default;
    } catch (error) {
      sqlImportError = error as Error;
      throw error;
    }
  }
  if (sqlImportError) {
    throw sqlImportError;
  }
  return sql;
}

export type UserRole = "admin" | "carrier" | "none";
export type AuthProvider = "supabase" | "none";

interface UnifiedAuthResult {
  userId: string | null;
  userRole: UserRole;
  email: string | null;
  provider: AuthProvider;
}

interface UnifiedUser {
  id: string;
  email: string | null;
  role: UserRole;
  provider: AuthProvider;
}

// In-memory cache for role resolution (5s TTL for faster role updates)
const roleCache = new Map<string, { role: UserRole; timestamp: number }>();
const ROLE_CACHE_TTL = 5 * 1000; // 5 seconds (reduced for faster role updates)

/**
 * Get unified auth result from Supabase
 */
export async function getUnifiedAuth(): Promise<UnifiedAuthResult> {
  try {
    return await getSupabaseAuth();
  } catch (error) {
    console.error("[auth-unified] Error getting auth:", error);
    return {
      userId: null,
      userRole: "none",
      email: null,
      provider: "none",
    };
  }
}

/**
 * Get auth from Supabase
 */
async function getSupabaseAuth(): Promise<UnifiedAuthResult> {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();
    
    // Use getAll/setAll format (preferred by Supabase SSR v0.7+)
    // This ensures proper handling of chunked cookies (like PKCE code verifiers)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        userId: null,
        userRole: "none",
        email: null,
        provider: "none",
      };
    }
    
    const { createServerClient } = await import('@supabase/ssr');
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          // Filter out Clerk cookies
          return cookieStore.getAll()
            .filter(cookie => {
              const name = cookie.name;
              return !name.startsWith('__clerk_') && !name.startsWith('clerk_');
            })
            .map(cookie => ({
              name: cookie.name,
              value: cookie.value
            }));
        },
        setAll(cookiesToSet) {
          // Server Components can't set cookies, but API routes can
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore - we're in a Server Component context where cookies can't be modified
          }
        },
      },
    });
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return {
        userId: null,
        userRole: "none",
        email: null,
        provider: "none",
      };
    }
    
    // Check cache first
    const cached = roleCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
      return {
        userId: user.id,
        userRole: cached.role,
        email: user.email || null,
        provider: "supabase",
      };
    }
    
    // Resolve role from database
    const userRole = await getSupabaseUserRole(user.id);
    
    // Cache the result
    roleCache.set(user.id, {
      role: userRole,
      timestamp: Date.now(),
    });
    
    return {
      userId: user.id,
      userRole,
      email: user.email || null,
      provider: "supabase",
    };
  } catch (error) {
    console.error("[auth-unified] Supabase auth error:", error);
    return {
      userId: null,
      userRole: "none",
      email: null,
      provider: "none",
    };
  }
}

/**
 * Get Supabase user role from user_roles_cache using supabase_user_id
 */
async function getSupabaseUserRole(userId: string): Promise<UserRole> {
  try {
    // Try to import SQL - if it fails, we're in Edge runtime
    let sqlClient;
    try {
      sqlClient = await getSql();
    } catch (error) {
      // In Edge runtime, use Supabase admin API only
      const supabase = getSupabaseService();
      const { data: user } = await supabase.auth.admin.getUserById(userId);
      
      // Try to get role from user metadata
      if (user?.user?.user_metadata?.role) {
        return user.user.user_metadata.role as UserRole;
      }
      
      return "carrier"; // Safe default
    }
    
    // In Node.js runtime (API routes, server components), use database queries
    // Check user_roles_cache by supabase_user_id
    const result = await sqlClient`
      SELECT role 
      FROM user_roles_cache 
      WHERE supabase_user_id = ${userId}
      LIMIT 1
    `;
    
    if (result.length > 0 && result[0].role) {
      return result[0].role as UserRole;
    }
    
    // Fallback: check by email if available
    const supabase = getSupabaseService();
    const { data: user, error } = await supabase.auth.admin.getUserById(userId);
    
    if (!error && user?.user?.email) {
      const emailResult = await sqlClient`
        SELECT role 
        FROM user_roles_cache 
        WHERE email = ${user.user.email.toLowerCase()}
        LIMIT 1
      `;
      
      if (emailResult.length > 0 && emailResult[0].role) {
        return emailResult[0].role as UserRole;
      }
    }
    
    // Default to carrier for authenticated users
    return "carrier";
  } catch (error) {
    console.error("[auth-unified] Error getting Supabase role:", error);
    return "carrier"; // Safe default
  }
}

/**
 * Require authentication (returns userId or throws)
 */
export async function requireAuthenticated(): Promise<string> {
  const authResult = await getUnifiedAuth();
  
  if (!authResult.userId) {
    throw new Error("Unauthorized");
  }
  
  return authResult.userId;
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<string> {
  const authResult = await getUnifiedAuth();
  
  if (!authResult.userId) {
    throw new Error("Unauthorized");
  }
  
  if (authResult.userRole !== "admin") {
    throw new Error("Admin access required");
  }
  
  return authResult.userId;
}

/**
 * Require carrier or admin role
 */
export async function requireCarrier(): Promise<string> {
  const authResult = await getUnifiedAuth();
  
  if (!authResult.userId) {
    throw new Error("Unauthorized");
  }
  
  if (authResult.userRole !== "carrier" && authResult.userRole !== "admin") {
    throw new Error("Carrier access required");
  }
  
  return authResult.userId;
}

/**
 * Get current user with role
 */
export async function getCurrentUser(): Promise<UnifiedUser | null> {
  const authResult = await getUnifiedAuth();
  
  if (!authResult.userId) {
    return null;
  }
  
  return {
    id: authResult.userId,
    email: authResult.email,
    role: authResult.userRole,
    provider: authResult.provider,
  };
}

/**
 * Clear role cache for a user (useful after role changes)
 */
export function clearRoleCache(userId: string): void {
  roleCache.delete(userId);
}

/**
 * Get user info from Supabase (replaces getClerkUserInfo)
 * Returns user information in a format compatible with Clerk's user info structure
 */
export async function getSupabaseUserInfo(userId: string): Promise<{
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  username: string | null;
  role: "admin" | "carrier";
}> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      // If not found in Supabase, try database fallback
      const sql = (await import('./db')).default;
      const dbUser = await sql`
        SELECT 
          cp.contact_name,
          cp.legal_name,
          urc.role,
          urc.email
        FROM carrier_profiles cp
        LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
        WHERE cp.supabase_user_id = ${userId}
        LIMIT 1
      `;

      if (dbUser.length > 0) {
        const db = dbUser[0];
        const contactName = db.contact_name || db.legal_name || '';
        const nameParts = contactName.split(' ');
        return {
          id: userId,
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(' ') || null,
          fullName: contactName || db.legal_name || null,
          emailAddresses: db.email ? [{ emailAddress: db.email }] : [],
          username: db.legal_name || null,
          role: (db.role as "admin" | "carrier") || "carrier"
        };
      }

      // Final fallback
      return {
        id: userId,
        firstName: null,
        lastName: null,
        fullName: userId,
        emailAddresses: [],
        username: userId,
        role: "carrier"
      };
    }

    // Get role from database
    const role = await getSupabaseUserRole(userId);
    
    const firstName = user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || null;
    const lastName = user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || null;
    const fullName = user.user_metadata?.full_name || 
                    (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || user.email?.split('@')[0] || null);

    return {
      id: user.id,
      firstName,
      lastName,
      fullName,
      emailAddresses: user.email ? [{ emailAddress: user.email }] : [],
      username: user.user_metadata?.username || user.email?.split('@')[0] || null,
      role
    };
  } catch (error) {
    console.error(`Error getting Supabase user info for ${userId}:`, error);
    // Return fallback
    return {
      id: userId,
      firstName: null,
      lastName: null,
      fullName: userId,
      emailAddresses: [],
      username: userId,
      role: "carrier"
    };
  }
}

/**
 * Clear all role cache
 */
export function clearAllRoleCache(): void {
  roleCache.clear();
}
