import { Suspense } from "react";
import { listActiveTelegramBids } from "@/lib/auctions";
import PageHeader from "@/components/layout/PageHeader";
import BidBoardClient from "./BidBoardClient";
import { BidBoardSkeleton } from "@/components/ui/Skeletons";

export default async function BidBoardPage() {
  // Fetch initial data server-side
  const initialBids = await listActiveTelegramBids({ limit: 50 });

  return (
    <div className="py-8">
      <PageHeader 
        title="Live Auction Board" 
        subtitle="Bid on USPS loads with 25-minute live countdowns"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Live Auctions" }
        ]}
      />

      <Suspense fallback={<BidBoardSkeleton />}>
        <BidBoardClient initialBids={initialBids} />
      </Suspense>
    </div>
  );
}