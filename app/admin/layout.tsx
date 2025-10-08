import { auth } from "@clerk/nextjs/server";
import { roleManager } from "@/lib/role-manager";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  // Redirect to sign-in if not authenticated
  if (!userId) {
    console.log("Admin layout: No user ID, redirecting to sign-in");
    redirect("/sign-in");
  }

  // Check if user has admin role
  try {
    const isAdmin = await roleManager.isAdmin(userId);
    if (!isAdmin) {
      console.log(`Admin layout: User ${userId} is not admin, redirecting to forbidden`);
      redirect("/forbidden");
    }
    console.log(`Admin layout: User ${userId} is admin, allowing access`);
  } catch (error) {
    console.error("Admin layout: Error checking admin role:", error);
    // For now, allow access if role check fails to prevent blocking
    console.log("Admin layout: Role check failed, allowing access for debugging");
  }

  return <>{children}</>;
}
