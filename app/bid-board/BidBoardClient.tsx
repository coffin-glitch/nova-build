"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Glass } from "@/components/ui/glass";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Countdown } from "@/components/ui/Countdown";
import { 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  Truck, 
  DollarSign,
  RefreshCw,
  AlertCircle,
  Gavel
} from "lucide-react";
import { formatMoney, formatDistance, formatStops, formatTimeOnly } from "@/lib/format";
import { TelegramBid } from "@/lib/auctions";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface BidBoardClientProps {
  initialBids: TelegramBid[];
}

export default function BidBoardClient({ initialBids }: BidBoardClientProps) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isBidding, setIsBidding] = useState(false);

  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=50`,
    fetcher,
    { 
      refreshInterval: 10000,
      fallbackData: { ok: true, data: initialBids }
    }
  );

  const bids = data?.data || [];

  const handlePlaceBid = async () => {
    if (!selectedBid || !bidAmount) return;

    setIsBidding(true);
    try {
      const response = await fetch("/api/carrier-bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bid_number: selectedBid.bid_number,
          amount: parseFloat(bidAmount),
          notes: bidNotes,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Bid placed successfully!");
        setSelectedBid(null);
        setBidAmount("");
        setBidNotes("");
        mutate(); // Refresh data
      } else {
        toast.error(result.error || "Failed to place bid");
      }
    } catch (error) {
      toast.error("Failed to place bid");
    } finally {
      setIsBidding(false);
    }
  };

  const openBidDialog = (bid: TelegramBid) => {
    setSelectedBid(bid);
    setBidAmount("");
    setBidNotes("");
  };

  const filteredBids = bids.filter((bid: TelegramBid) => {
    if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
    if (tag && bid.tag !== tag.toUpperCase()) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Glass className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Bid number..."
                className="pl-10"
              />
            </div>
          </div>

          {/* State Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">State</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              placeholder="State tag (e.g. GA)"
            />
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sort By</label>
            <select 
              className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onChange={(e) => {
                // TODO: Implement sorting logic
                console.log("Sort by:", e.target.value);
              }}
            >
              <option value="time-remaining">Time Remaining</option>
              <option value="lowest-bid">Lowest Bid</option>
              <option value="distance">Distance</option>
              <option value="bid-number">Bid Number</option>
            </select>
          </div>

          {/* Refresh */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground opacity-0">Refresh</label>
            <Button
              onClick={() => mutate()}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Glass>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Active Auctions</p>
              <p className="text-2xl font-bold text-foreground">
                {bids.filter((b: TelegramBid) => !b.is_expired).length}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-foreground">
                {bids.filter((b: TelegramBid) => b.is_expired).length}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">States</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(bids.map((b: TelegramBid) => b.tag).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-foreground">
                {bids.length > 0 ? "Live" : "0"}
              </p>
            </div>
          </div>
        </Glass>
      </div>

      {/* Bids Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Glass key={i} className="p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-6 bg-muted rounded w-1/2"></div>
              <div className="h-3 bg-muted rounded w-1/3"></div>
            </Glass>
          ))}
        </div>
      ) : filteredBids.length === 0 ? (
        <Glass className="p-12 text-center">
          <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Active Auctions</h3>
          <p className="text-muted-foreground">Check back later for new USPS loads to bid on.</p>
        </Glass>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBids.map((bid: TelegramBid) => (
            <Glass key={bid.bid_number} className="p-6 space-y-4 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    #{bid.bid_number}
                  </Badge>
                  {bid.tag && (
                    <Badge variant="secondary">
                      {bid.tag}
                    </Badge>
                  )}
                </div>
                <Countdown 
                  expiresAt={bid.expires_at_25} 
                  variant={bid.is_expired ? "expired" : bid.time_left_seconds <= 300 ? "urgent" : "default"}
                />
              </div>

              {/* Route Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{formatStops(bid.stops)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="w-4 h-4" />
                  <span className="text-sm">{formatDistance(bid.distance_miles)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {formatTimeOnly(bid.pickup_timestamp || bid.received_at)} - {formatTimeOnly(bid.delivery_timestamp || bid.received_at)}
                  </span>
                </div>
              </div>

              {/* Bidding Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bids:</span>
                  <span className="font-medium">{bid.bids_count || 0}</span>
                </div>
                {bid.lowest_amount_cents > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Lowest:</span>
                    <span className="text-primary font-medium">
                      {formatMoney(bid.lowest_amount_cents)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {bid.is_expired ? "Auction Closed" : "Bidding Open"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBid(bid)}
                    >
                      View Details
                    </Button>
                    {!bid.is_expired && (
                      <Button
                        size="sm"
                        onClick={() => openBidDialog(bid)}
                      >
                        <Gavel className="w-4 h-4 mr-1" />
                        Bid
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Glass>
          ))}
        </div>
      )}

      {/* Bid Dialog */}
      <Dialog open={!!selectedBid} onOpenChange={() => setSelectedBid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid - #{selectedBid?.bid_number}</DialogTitle>
          </DialogHeader>
          
          {selectedBid && (
            <div className="space-y-6">
              {/* Bid Details */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatStops(selectedBid.stops)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatDistance(selectedBid.distance_miles)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatTimeOnly(selectedBid.pickup_timestamp || selectedBid.received_at)} - {formatTimeOnly(selectedBid.delivery_timestamp || selectedBid.received_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Countdown 
                    expiresAt={selectedBid.expires_at_25}
                    variant={selectedBid.is_expired ? "expired" : selectedBid.time_left_seconds <= 300 ? "urgent" : "default"}
                  />
                </div>
              </div>

              {/* Bid Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Bid Amount ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={selectedBid.is_expired}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Notes (Optional)
                  </label>
                  <Input
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    disabled={selectedBid.is_expired}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedBid(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePlaceBid}
                  disabled={!bidAmount || isBidding || selectedBid.is_expired}
                >
                  {isBidding ? "Placing Bid..." : "Place Bid"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}