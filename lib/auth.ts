import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "./db";

/** Redirect to /sign-in if not authenticated. Returns userId on success. */
export async function requireSignedIn() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  return userId!;
}

/** Get user role from database. Defaults to "carrier" if no role row exists. */
export async function getUserRole(userId: string): Promise<"admin" | "carrier"> {
  try {
    console.log("🔍 getUserRole: Checking role for user:", userId);
    
    // Try with 'user_id' first (newer schema)
    let result = await sql`
      SELECT role FROM user_roles WHERE user_id = ${userId}
    `;
    
    console.log("📊 getUserRole: user_id query result:", result);
    
    if (result.length === 0) {
      console.log("🔄 getUserRole: No result with user_id, trying clerk_user_id...");
      // Fallback to 'clerk_user_id' (older schema)
      result = await sql`
        SELECT role FROM user_roles WHERE clerk_user_id = ${userId}
      `;
      console.log("📊 getUserRole: clerk_user_id query result:", result);
    }
    
    const role = result[0]?.role || "carrier";
    console.log("🎯 getUserRole: Final role:", role);
    return role;
  } catch (error) {
    console.error("❌ getUserRole: Error fetching user role:", error);
    return "carrier"; // Default to carrier on error
  }
}

/** Get current user's role from database. */
export async function getCurrentRole(): Promise<"admin" | "carrier"> {
  const userId = await requireSignedIn();
  return getUserRole(userId);
}

/** Require one of the allowed roles; redirect to forbidden if unauthorized. */
export async function requireRole(allowed: Array<"admin" | "carrier">) {
  const userId = await requireSignedIn();
  const role = await getUserRole(userId);
  if (!allowed.includes(role)) {
    redirect("/forbidden");
  }
  return { userId, role };
}

/** Require admin role. Redirects to forbidden if not admin. */
export async function requireAdmin() {
  return requireRole(["admin"]);
}

/** Require carrier role (admin can also pass). Redirects to forbidden if neither. */
export async function requireCarrier() {
  return requireRole(["carrier", "admin"]);
}

/** Create or update user role in database. */
export async function setUserRole(userId: string, role: "admin" | "carrier") {
  try {
    // Try with 'user_id' first (newer schema)
    try {
      await sql`
        INSERT INTO user_roles (user_id, role, created_at) 
        VALUES (${userId}, ${role}, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET role = ${role}
      `;
    } catch (error) {
      // Fallback to 'clerk_user_id' (older schema)
      await sql`
        INSERT INTO user_roles (clerk_user_id, role, created_at) 
        VALUES (${userId}, ${role}, NOW())
        ON CONFLICT (clerk_user_id) 
        DO UPDATE SET role = ${role}
      `;
    }
  } catch (error) {
    console.error("Error setting user role:", error);
    throw new Error("Failed to set user role");
  }
}

/** Check if user has admin role without redirecting. */
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

/** Check if user has carrier role without redirecting. */
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
