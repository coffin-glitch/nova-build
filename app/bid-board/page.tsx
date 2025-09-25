import { Suspense } from "react";
import { listActiveTelegramBids } from "@/lib/auctions";
import PageHeader from "@/components/layout/PageHeader";
import AuctionBoard from "@/components/auctions/AuctionBoard";

// Transform telegram bids to auction format
function transformBidsToAuctions(bids: any[]) {
  return bids.map(bid => {
    const receivedAt = new Date(bid.received_at);
    const endsAt = new Date(receivedAt.getTime() + 25 * 60 * 1000); // 25 minutes
    
    return {
      bidNumber: bid.bid_number,
      tag: bid.tag || "Unknown",
      route: `${bid.stops?.[0]?.city || "Unknown"}, ${bid.stops?.[0]?.state || "XX"} → ${bid.stops?.[1]?.city || "Unknown"}, ${bid.stops?.[1]?.state || "XX"}`,
      pickup: `Today, ${receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      delivery: `Tomorrow, ${endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      distanceMiles: bid.distance_miles || 0,
      receivedAt: bid.received_at,
      endsAt: endsAt.toISOString(),
      lowestBid: bid.lowest_bid ? {
        amount: bid.lowest_bid.amount_cents / 100,
        carrierName: bid.lowest_bid.carrier_name || "Unknown Carrier",
        mcNumber: bid.lowest_bid.mc_number
      } : undefined
    };
  });
}

export default async function BidBoardPage() {
  // Fetch initial data server-side
  const initialBids = await listActiveTelegramBids({ limit: 50 });
  const initialAuctions = transformBidsToAuctions(initialBids);

  return (
    <div className="py-8">
      <PageHeader 
        title="Live Auctions" 
        subtitle="Bid in real-time. 25-minute windows."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Live Auctions" }
        ]}
      />

      <Suspense fallback={
        <div className="space-y-6">
          {/* Toolbar Skeleton */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Results Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-6 bg-muted rounded w-16"></div>
                      <div className="h-4 bg-muted rounded w-20"></div>
                    </div>
                    <div className="text-center">
                      <div className="h-6 bg-muted rounded w-16 mb-2"></div>
                      <div className="h-4 bg-muted rounded w-12 mb-2"></div>
                      <div className="h-2 bg-muted rounded w-24"></div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="h-5 bg-muted rounded w-48 mb-2"></div>
                    <div className="flex items-center gap-4">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-4 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <div className="h-8 bg-muted rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="h-6 bg-muted rounded w-24 mb-4"></div>
                <div className="aspect-square bg-muted/30 rounded-lg mb-4"></div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-muted rounded-full"></div>
                        <div className="h-4 bg-muted rounded w-16"></div>
                      </div>
                      <div className="h-5 bg-muted rounded w-8"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      }>
        <AuctionBoard initialAuctions={initialAuctions} />
      </Suspense>
    </div>
  );
}