import { roleManager } from "@/lib/role-manager";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AdminOffersClient from "./view.client";

export const dynamic = "force-dynamic";

export default async function AdminOffersPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user is admin
  const userRole = await roleManager.getUserRole(userId);
  if (userRole !== 'admin') {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Manage Offers</h1>
      <AdminOffersClient />
    </div>
  );
}