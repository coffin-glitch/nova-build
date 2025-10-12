import { getClerkUserRole, isClerkAdmin, isClerkCarrier } from "@/lib/clerk-roles";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
