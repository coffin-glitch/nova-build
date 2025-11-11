import { requireSignedIn } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

async function getRole(userId: string) {
  const sql = (await import("@/lib/db")).default;
  const rows = await sql/*sql*/`select role from public.user_roles_cache where supabase_user_id = ${userId} limit 1`;
  return rows?.[0]?.role ?? "—";
}

export default async function ProfilePage() {
  const userId = await requireSignedIn();
  const role = await getRole(userId);
  
  // Redirect admins to admin profile page
  if (role === 'admin') {
    redirect('/admin/profile');
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ProfileClient />
    </Suspense>
  );
}