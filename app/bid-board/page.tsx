import { Suspense } from "react";
import { listActiveTelegramBids } from "@/lib/auctions";
import { SectionHeader } from "@/components/ui/section";
import BidBoardClient from "./BidBoardClient";
import { BidBoardSkeleton } from "@/components/ui/Skeletons";

export default async function BidBoardPage() {
  // Fetch initial data server-side
  const initialBids = await listActiveTelegramBids({ limit: 50 });

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <SectionHeader 
          title="Live Auction Board" 
          subtitle="Bid on USPS loads with 25-minute live countdowns"
        />

        <Suspense fallback={<BidBoardSkeleton />}>
          <BidBoardClient initialBids={initialBids} />
        </Suspense>
      </div>
    </div>
  );
}