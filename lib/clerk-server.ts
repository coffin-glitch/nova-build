import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "carrier" | "none";

/**
 * Server-side function to get user role from Clerk
 */
export async function getClerkUserRole(userId: string): Promise<UserRole> {
  try {
    const { users } = await import("@clerk/clerk-sdk-node");
    const user = await users.getUser(userId);
    
    const role = (user.publicMetadata?.role as string)?.toLowerCase() || "carrier";
    return role === "admin" || role === "carrier" ? role : "carrier";
  } catch (error) {
    console.error("Error getting Clerk user role:", error);
    return "carrier"; // Default to carrier on error
  }
}

/**
 * Server-side function to set user role in Clerk
 */
export async function setClerkUserRole(userId: string, role: "admin" | "carrier"): Promise<void> {
  try {
    const { users } = await import("@clerk/clerk-sdk-node");
    
    await users.updateUser(userId, {
      publicMetadata: {
        role: role,
      },
    });
    
    console.log(`✅ Updated Clerk role for ${userId} to ${role}`);
  } catch (error) {
    console.error("Error setting Clerk user role:", error);
    throw new Error("Failed to set user role");
  }
}

/**
 * Server-side function to check if user is admin
 */
export async function isClerkAdmin(userId: string): Promise<boolean> {
  const role = await getClerkUserRole(userId);
  return role === "admin";
}

/**
 * Server-side function to check if user is carrier
 */
export async function isClerkCarrier(userId: string): Promise<boolean> {
  const role = await getClerkUserRole(userId);
  return role === "carrier" || role === "admin"; // Admins can also access carrier features
}

/**
 * Server-side authentication helpers
 */
export async function requireSignedIn() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  const isAdmin = await isClerkAdmin(userId);
  if (!isAdmin) redirect("/forbidden");
  
  return userId;
}

export async function requireCarrier() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  const isCarrier = await isClerkCarrier(userId);
  if (!isCarrier) redirect("/forbidden");
  
  return userId;
}

export async function getCurrentRole() {
  const { userId } = await auth();
  if (!userId) return "none";
  
  return await getClerkUserRole(userId);
}

export async function getUserRole(userId: string) {
  return await getClerkUserRole(userId);
}

export async function isAdmin(userId?: string) {
  if (!userId) {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) return false;
    return await isClerkAdmin(currentUserId);
  }
  return await isClerkAdmin(userId);
}

export async function isCarrier(userId?: string) {
  if (!userId) {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) return false;
    return await isClerkCarrier(currentUserId);
  }
  return await isClerkCarrier(userId);
}
