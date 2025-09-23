import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { listActiveTelegramBids } from "@/lib/auctions";
import { SectionHeader } from "@/components/ui/section";
import AdminAuctionsClient from "./AdminAuctionsClient";
import { AdminAuctionListSkeleton } from "@/components/ui/Skeletons";

export default async function AdminAuctionsPage() {
  await requireAdmin();

  // Fetch initial data server-side
  const initialBids = await listActiveTelegramBids({ limit: 100 });

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <SectionHeader 
          title="Auction Management Console" 
          subtitle="Manage live auctions and award winning bids"
        />

        <Suspense fallback={<AdminAuctionListSkeleton />}>
          <AdminAuctionsClient initialBids={initialBids} />
        </Suspense>
      </div>
    </div>
  );
}