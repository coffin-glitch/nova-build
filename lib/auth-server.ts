import { auth } from "@clerk/nextjs/server";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Secure server-side role management utilities
 * All role changes must go through server-side validation
 */

/**
 * Get user role from Clerk metadata (server-side)
 * This is the most secure way to get user roles
 */
export async function getClerkUserRole(userId: string): Promise<UserRole> {
  try {
    // Use the correct Clerk SDK approach
    const { users } = await import("@clerk/clerk-sdk-node");
    const user = await users.getUser(userId);
    
    const role = (user.publicMetadata?.role as string)?.toLowerCase() || "carrier";
    
    // Validate and sanitize role
    if (role === "admin") {
      return "admin";
    } else if (role === "carrier") {
      return "carrier";
    }
    
    // Default to carrier for authenticated users (least privilege)
    return "carrier";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "carrier"; // Safe default
  }
}

/**
 * Set user role in Clerk metadata (admin only)
 * This should only be called by admin users
 */
export async function setClerkUserRole(userId: string, role: "admin" | "carrier"): Promise<void> {
  try {
    // Validate role
    if (!["admin", "carrier"].includes(role)) {
      throw new Error("Invalid role");
    }

    // Use the correct Clerk SDK approach
    const { users } = await import("@clerk/clerk-sdk-node");
    
    // Update user metadata
    await users.updateUser(userId, {
      publicMetadata: {
        role: role
      }
    });
    
    console.log(`✅ Updated Clerk role for ${userId} to ${role}`);
  } catch (error) {
    console.error("Error setting user role:", error);
    throw error;
  }
}

/**
 * Check if current user is admin (server-side)
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  
  const role = await getClerkUserRole(userId);
  return role === "admin";
}

/**
 * Check if current user is carrier or admin (server-side)
 */
export async function isCurrentUserCarrier(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  
  const role = await getClerkUserRole(userId);
  return role === "carrier" || role === "admin";
}

/**
 * Require admin role (throws if not admin)
 */
export async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  const role = await getClerkUserRole(userId);
  if (role !== "admin") {
    throw new Error("Admin access required");
  }
  
  return userId;
}

/**
 * Require carrier or admin role (throws if neither)
 */
export async function requireCarrier(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  
  const role = await getClerkUserRole(userId);
  if (role !== "carrier" && role !== "admin") {
    throw new Error("Carrier access required");
  }
  
  return userId;
}
