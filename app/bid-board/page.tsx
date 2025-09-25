import { Suspense } from "react";
import { listActiveTelegramBids } from "@/lib/auctions";
import PageHeader from "@/components/layout/PageHeader";
import BidBoardClient from "./BidBoardClient";
import CollapsibleMapPanel from "@/components/bid-board/CollapsibleMapPanel";

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

      {/* Main Content - Full Width */}
      <Suspense fallback={
        <div className="space-y-6">
          {/* Filters Skeleton */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="sm:w-48">
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="sm:w-32">
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
          </div>
          
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                    <div className="h-6 bg-muted rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Bids Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-12"></div>
                  </div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-muted rounded w-20"></div>
                      <div className="h-8 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }>
        <BidBoardClient initialBids={initialBids} />
      </Suspense>

      {/* Collapsible Map Panel */}
      <CollapsibleMapPanel />
    </div>
  );
}