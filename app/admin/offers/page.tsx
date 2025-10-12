import { requireAdmin } from "@/lib/clerk-server";
import AdminOffersClient from "./AdminOffersClient";

export const dynamic = "force-dynamic";

export default async function AdminOffersPage() {
  // This will redirect if user is not admin
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Offers Management</h1>
        <p className="text-muted-foreground">
          Review and manage carrier offers on published loads. Accept, reject, or counter offers to optimize your freight operations.
        </p>
      </div>
      
      <AdminOffersClient />
    </div>
  );
}