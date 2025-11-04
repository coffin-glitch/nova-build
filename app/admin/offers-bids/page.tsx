import { requireAdmin } from "@/lib/auth";
import AdminBidsClient from "./AdminBidsClient";

export const dynamic = "force-dynamic";

export default async function AdminBidsPage() {
  // This will redirect if user is not admin
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Bids Management</h1>
        <p className="text-muted-foreground">
          Review and manage carrier bids on auction loads. Track bid lifecycle stages and driver information for awarded bids.
        </p>
      </div>
      
      <AdminBidsClient />
    </div>
  );
}
