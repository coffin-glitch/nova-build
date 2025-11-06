import { redirect } from "next/navigation";
import { getUnifiedAuth } from "@/lib/auth-unified";
import { AdminProfileClient } from "./AdminProfileClient";

export default async function AdminProfilePage() {
  const auth = await getUnifiedAuth();
  
  if (!auth.userId) {
    redirect('/sign-in');
  }

  // Verify admin role
  if (auth.userRole !== 'admin') {
    redirect('/profile');
  }

  return <AdminProfileClient />;
}

