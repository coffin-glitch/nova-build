import { SectionHeader } from "@/components/ui/section";
import { AdminAuctionListSkeleton } from "@/components/ui/Skeletons";
import { Suspense } from "react";
import AdminAuctionsClient from "./AdminAuctionsClient";

export default async function AdminAuctionsPage() {
  // Remove server-side authentication to prevent redirect issues
  // Authentication will be handled client-side in AdminAuctionsClient

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <SectionHeader 
          title="Auction Management Console" 
          subtitle="Manage live auctions and award winning bids"
        />

        <Suspense fallback={<AdminAuctionListSkeleton />}>
          <AdminAuctionsClient />
        </Suspense>
      </div>
    </div>
  );
}