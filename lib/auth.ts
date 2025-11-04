import { redirect } from "next/navigation";
import sql from "./db";
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Redirect to /sign-in if not authenticated. Returns userId on success. (Supabase-only) */
export async function requireSignedIn() {
  const headersList = await headers();
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect("/sign-in");
  }
  
  // Use getAll/setAll format (preferred by Supabase SSR v0.7+)
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
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
        // Server Components can't set cookies - this is safe to ignore
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore - we're in a Server Component context
        }
      },
    },
  });
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  return user.id;
}

/** Get user role from database. Defaults to "carrier" if no role row exists. (Supabase-only) */
export async function getUserRole(userId: string): Promise<"admin" | "carrier"> {
  try {
    console.log("🔍 getUserRole: Checking role for user:", userId);
    
    // Use supabase_user_id (Supabase-only)
    let result = await sql`
      SELECT role FROM user_roles_cache WHERE supabase_user_id = ${userId}
    `;
    
    console.log("📊 getUserRole: supabase_user_id query result:", result);
    
    const role = result[0]?.role || "carrier";
    console.log("🎯 getUserRole: Final role:", role);
    return role;
  } catch (error) {
    console.error("❌ getUserRole: Error fetching user role:", error);
    return "carrier"; // Default to carrier on error
  }
}

/** Get current user's role from database. (Supabase-only) */
export async function getCurrentRole(): Promise<"admin" | "carrier"> {
  const userId = await requireSignedIn();
  return getUserRole(userId);
}

/** Require one of the allowed roles; redirect to forbidden if unauthorized. (Supabase-only) */
export async function requireRole(allowed: Array<"admin" | "carrier">) {
  const userId = await requireSignedIn();
  const role = await getUserRole(userId);
  if (!allowed.includes(role)) {
    redirect("/forbidden");
  }
  return { userId, role };
}

/** Require admin role. Redirects to forbidden if not admin. (Supabase-only) */
export async function requireAdmin() {
  return requireRole(["admin"]);
}

/** Require carrier role (admin can also pass). Redirects to forbidden if neither. (Supabase-only) */
export async function requireCarrier() {
  return requireRole(["carrier", "admin"]);
}

/** Create or update user role in database. (Supabase-only) */
export async function setUserRole(userId: string, role: "admin" | "carrier") {
  try {
    // Use supabase_user_id (Supabase-only)
    await sql`
      INSERT INTO user_roles_cache (supabase_user_id, role, created_at) 
      VALUES (${userId}, ${role}, NOW())
      ON CONFLICT (supabase_user_id) 
      DO UPDATE SET role = ${role}
    `;
  } catch (error) {
    console.error("Error setting user role:", error);
    throw new Error("Failed to set user role");
  }
}

/** Check if user has admin role without redirecting. (Supabase-only) */
export async function isAdmin(userId?: string): Promise<boolean> {
  try {
    const targetUserId = userId || (await requireSignedIn());
    const role = await getUserRole(targetUserId);
    return role === "admin";
  } catch (error) {
    console.error("Error checking admin role:", error);
    return false;
  }
}

/** Check if user has carrier role without redirecting. (Supabase-only) */
export async function isCarrier(userId?: string): Promise<boolean> {
  try {
    const targetUserId = userId || (await requireSignedIn());
    const role = await getUserRole(targetUserId);
    return role === "carrier" || role === "admin";
  } catch (error) {
    console.error("Error checking carrier role:", error);
    return false;
  }
}
