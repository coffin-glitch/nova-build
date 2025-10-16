import PageHeader from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/clerk-server";
import { AdminBiddingConsole } from "./AdminBiddingConsole";

export const dynamic = "force-dynamic";

export default async function AdminBidsPage() {
  await requireAdmin();

  return (
    <div className="py-8">
      <PageHeader 
        title="Admin Bidding Console" 
        subtitle="Manage live auctions, monitor bids, and oversee the bidding process"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Bids" }
        ]}
      />
      
      <AdminBiddingConsole />
    </div>
  );
}