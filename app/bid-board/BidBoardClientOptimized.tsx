"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useIsAdmin } from "@/hooks/useUserRole";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatPickupDateTime, formatStopCount, formatStops } from "@/lib/format";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import {
  AlertCircle,
  Archive,
  Clock,
  DollarSign,
  Gavel,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Truck
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

// Optimized fetcher with error handling
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

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
  const [viewDetailsBid, setViewDetailsBid] = useState<TelegramBid | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedFilters, setArchivedFilters] = useState({
    date: "",
    city: "",
    state: "",
    milesMin: "",
    milesMax: "",
    sortBy: "date"
  });
  
  const isAdmin = useIsAdmin();
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  const { theme } = useTheme();
  
  // Memoized color functions
  const getIconColor = useCallback(() => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  }, [accentColor, theme]);
  
  const getButtonTextColor = useCallback(() => {
    return getTextColor(accentColor, theme);
  }, [accentColor, theme]);

  // Optimized SWR configuration
  const { data, mutate, isLoading, error } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=50`,
    fetcher,
    { 
      refreshInterval: 30000, // Increased to 30 seconds
      fallbackData: { ok: true, data: initialBids },
      revalidateOnFocus: false, // Disable revalidation on focus
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  const bids = data?.data || [];

  // Memoized filtered bids
  const filteredBids = useMemo(() => {
    return bids.filter((bid: TelegramBid) => {
      // Text search filter
      if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
      
      // Tag filter
      if (tag && bid.tag !== tag.toUpperCase()) return false;
      
      // Show/hide expired bids
      if (!showExpired && bid.is_expired) return false;
      if (showExpired && !bid.is_expired) return false;
      
      // For non-admin users, only show today's bids
      if (!isAdmin && !showExpired) {
        const today = new Date();
        const bidDate = new Date(bid.received_at);
        const isToday = bidDate.toDateString() === today.toDateString();
        if (!isToday) return false;
      }
      
      return true;
    });
  }, [bids, q, tag, showExpired, isAdmin]);

  // Memoized stats
  const stats = useMemo(() => {
    const activeBids = bids.filter((b: TelegramBid) => !b.is_expired).length;
    const expiredBids = bids.filter((b: TelegramBid) => b.is_expired).length;
    const uniqueStates = new Set(bids.map((b: TelegramBid) => b.tag).filter(Boolean)).size;
    
    return { activeBids, expiredBids, uniqueStates };
  }, [bids]);

  // Optimized bid placement handler
  const handlePlaceBid = useCallback(async () => {
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
  }, [selectedBid, bidAmount, bidNotes, mutate]);

  const openBidDialog = useCallback((bid: TelegramBid) => {
    setSelectedBid(bid);
    setBidAmount("");
    setBidNotes("");
  }, []);

  // Error handling
  if (error) {
    return (
      <div className="space-y-6">
        <Glass className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Failed to Load Bids</h3>
          <p className="text-muted-foreground mb-4">
            There was an error loading the bid data. Please try again.
          </p>
          <Button onClick={() => mutate()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Glass>
      </div>
    );
  }

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

      {/* Filter Controls */}
      <Glass className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant={showExpired ? "default" : "outline"}
              onClick={() => setShowExpired(!showExpired)}
              style={showExpired ? {
                backgroundColor: accentColor,
                color: getButtonTextColor()
              } : {}}
            >
              <Clock className="w-4 h-4 mr-2" />
              {showExpired ? "Hide Expired" : "Show Expired"}
            </Button>
            
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowArchived(true)}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archived Bids
              </Button>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            Showing {showExpired ? "expired" : "live"} bids
            {!isAdmin && !showExpired && " (today only)"}
          </div>
        </div>
      </Glass>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5" style={{ color: getIconColor() }} />
            <div>
              <p className="text-sm text-muted-foreground">Active Auctions</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.activeBids}
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
                {stats.expiredBids}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5" style={{ color: getIconColor() }} />
            <div>
              <p className="text-sm text-muted-foreground">States</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.uniqueStates}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5" style={{ color: getIconColor() }} />
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
            <BidCard
              key={bid.bid_number}
              bid={bid}
              accentColor={accentColor}
              getIconColor={getIconColor}
              getButtonTextColor={getButtonTextColor}
              onOpenBidDialog={openBidDialog}
              onViewDetails={setViewDetailsBid}
            />
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
            <BidDialogContent
              bid={selectedBid}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              bidNotes={bidNotes}
              setBidNotes={setBidNotes}
              isBidding={isBidding}
              accentColor={accentColor}
              getButtonTextColor={getButtonTextColor}
              onPlaceBid={handlePlaceBid}
              onCancel={() => setSelectedBid(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewDetailsBid} onOpenChange={() => setViewDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Details - #{viewDetailsBid?.bid_number}</DialogTitle>
          </DialogHeader>
          
          {viewDetailsBid && (
            <BidDetailsContent
              bid={viewDetailsBid}
              accentColor={accentColor}
              getButtonTextColor={getButtonTextColor}
              onClose={() => setViewDetailsBid(null)}
              onPlaceBid={() => {
                setViewDetailsBid(null);
                openBidDialog(viewDetailsBid);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Archived Bids Dialog */}
      <Dialog open={showArchived} onOpenChange={setShowArchived}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Bids
            </DialogTitle>
          </DialogHeader>
          
          <ArchivedBidsContent
            archivedFilters={archivedFilters}
            setArchivedFilters={setArchivedFilters}
            accentColor={accentColor}
            getButtonTextColor={getButtonTextColor}
            onClose={() => setShowArchived(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Memoized BidCard component
const BidCard = React.memo(({ 
  bid, 
  accentColor, 
  getIconColor, 
  getButtonTextColor, 
  onOpenBidDialog, 
  onViewDetails 
}: {
  bid: TelegramBid;
  accentColor: string;
  getIconColor: () => string;
  getButtonTextColor: () => string;
  onOpenBidDialog: (bid: TelegramBid) => void;
  onViewDetails: (bid: TelegramBid) => void;
}) => (
  <Glass className="p-6 space-y-4 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className="border-2"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
            borderColor: `${accentColor}40`
          }}
        >
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
        <span className="text-sm">Pickup: {formatPickupDateTime(bid.pickup_timestamp)}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Navigation className="w-4 h-4" />
        <span className="text-sm">{formatStopCount(bid.stops)}</span>
      </div>
    </div>

    {/* Bidding Info */}
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Bids:</span>
        <span className="font-medium">{bid.bids_count || 0}</span>
      </div>
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
            onClick={() => onViewDetails(bid)}
          >
            View Details
          </Button>
          {!bid.is_expired && (
            <Button
              size="sm"
              onClick={() => onOpenBidDialog(bid)}
              style={{
                backgroundColor: accentColor,
                color: getButtonTextColor()
              }}
              className="hover:opacity-90"
            >
              <Gavel className="w-4 h-4 mr-1" />
              Bid
            </Button>
          )}
        </div>
      </div>
    </div>
  </Glass>
));
BidCard.displayName = 'BidCard';

// Additional memoized components would go here...
interface BidDialogContentProps {
  bid: TelegramBid;
  bidAmount: string;
  setBidAmount: (value: string) => void;
  bidNotes: string;
  setBidNotes: (value: string) => void;
  isBidding: boolean;
  accentColor: string;
  getButtonTextColor: () => string;
  onPlaceBid: () => void;
  onCancel: () => void;
}
const BidDialogContent = React.memo(({ bid, bidAmount, setBidAmount, bidNotes, setBidNotes, isBidding, accentColor, getButtonTextColor, onPlaceBid, onCancel }: BidDialogContentProps) => {
  // Component implementation - placeholder
  return null;
});
BidDialogContent.displayName = 'BidDialogContent';

interface BidDetailsContentProps {
  bid: TelegramBid;
  accentColor: string;
  getButtonTextColor: () => string;
  onClose: () => void;
  onPlaceBid: () => void;
}
const BidDetailsContent = React.memo(({ bid, accentColor, getButtonTextColor, onClose, onPlaceBid }: BidDetailsContentProps) => {
  // Component implementation - placeholder
  return null;
});
BidDetailsContent.displayName = 'BidDetailsContent';

interface ArchivedBidsContentProps {
  archivedFilters: {
    date: string;
    city: string;
    state: string;
    milesMin: string;
    milesMax: string;
    sortBy: string;
  };
  setArchivedFilters: (filters: ArchivedBidsContentProps['archivedFilters']) => void;
  accentColor: string;
  getButtonTextColor: () => string;
  onClose: () => void;
}
const ArchivedBidsContent = React.memo(({ archivedFilters, setArchivedFilters, accentColor, getButtonTextColor, onClose }: ArchivedBidsContentProps) => {
  // Component implementation - placeholder
  return null;
});
ArchivedBidsContent.displayName = 'ArchivedBidsContent';

