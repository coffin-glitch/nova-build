import { requireAdmin } from "@/lib/clerk-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This will redirect if user is not admin
  await requireAdmin();

  return <>{children}</>;
}
