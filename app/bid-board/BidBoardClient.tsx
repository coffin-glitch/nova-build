"use client";

import FavoritesConsole from "@/components/carrier/FavoritesConsole";
import ManageBidsConsole from "@/components/carrier/ManageBidsConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useIsAdmin } from "@/hooks/useUserRole";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
    AlertCircle,
    Archive,
    Calendar,
    Clock,
    DollarSign,
    Gavel,
    MapPin,
    Navigation,
    RefreshCw,
    Search,
    Star,
    Truck,
    User
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

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
  const [viewDetailsBid, setViewDetailsBid] = useState<TelegramBid | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<string | null>(null);
  const [showManageBidsConsole, setShowManageBidsConsole] = useState(false);
  const [showFavoritesConsole, setShowFavoritesConsole] = useState(false);
  
  // New state for filtering
  const [showExpired, setShowExpired] = useState(false);
  const isAdmin = useIsAdmin();
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBids, setArchivedBids] = useState<any[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedFilters, setArchivedFilters] = useState({
    date: "",
    city: "",
    state: "",
    milesMin: "",
    milesMax: "",
    sortBy: "date" // "date", "bids"
  });
  
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  const { theme } = useTheme();
  
  // Check profile status for access restriction
  const { data: profileData, isLoading: profileLoading } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null }
    }
  );

  const profile = profileData?.data;
  
  // Stable color values to prevent hydration mismatch
  const [iconColor, setIconColor] = useState('#6b7280');
  const [buttonTextColor, setButtonTextColor] = useState('#ffffff');
  
  useEffect(() => {
    // Calculate colors on client side only to prevent hydration mismatch
    if (accentColor === 'hsl(0, 0%, 100%)') {
      setIconColor('#6b7280');
      setButtonTextColor('#000000');
    } else {
      setIconColor(accentColor);
      setButtonTextColor('#ffffff');
    }
  }, [accentColor]);

  // Fetch data for the main view - uses same API as admin page
  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=false`,
    fetcher,
    { 
      refreshInterval: 5000, // Match admin refresh interval
      fallbackData: { ok: true, data: initialBids }
    }
  );

  // Fetch separate data for accurate stats (like admin page)
  const { data: activeData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=false`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: expiredData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=false`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const bids = data?.data || initialBids;
  const activeBidsAll = activeData?.data || [];
  const expiredBidsAll = expiredData?.data || [];

  // Fetch favorites status for all bids
  const { data: favoritesData } = useSWR(
    bids.length > 0 ? `/api/carrier/favorites/check?bid_numbers=${bids.map((b: TelegramBid) => b.bid_number).join(',')}` : null,
    fetcher,
    { 
      refreshInterval: 30000,
      fallbackData: { ok: true, data: {} }
    }
  );

  // Use favorites data directly (stable reference pattern)
  const favorites = favoritesData?.data || {};

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

  const handleToggleFavorite = async (bidNumber: string) => {
    setIsTogglingFavorite(bidNumber);
    try {
      const isFavorited = favorites[bidNumber];
      
      if (isFavorited) {
        // Remove from favorites
        const deleteResponse = await fetch(`/api/carrier/favorites?bid_number=${bidNumber}`, {
          method: 'DELETE'
        });
        const deleteResult = await deleteResponse.json();
        
        if (deleteResult.ok) {
          toast.success("Removed from favorites");
          // Trigger SWR revalidation to update the favorites data
          mutate();
        } else {
          toast.error(deleteResult.error || "Failed to remove from favorites");
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/carrier/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bid_number: bidNumber })
        });
        const result = await response.json();
        
        if (result.ok) {
          toast.success("Added to favorites");
          // Trigger SWR revalidation to update the favorites data
          mutate();
        } else {
          toast.error(result.error || "Failed to add to favorites");
        }
      }
    } catch (error) {
      toast.error("Failed to update favorites");
    } finally {
      setIsTogglingFavorite(null);
    }
  };

  const loadArchivedBids = async () => {
    setIsLoadingArchived(true);
    try {
      const params = new URLSearchParams();
      if (archivedFilters.date) params.append('date', archivedFilters.date);
      if (archivedFilters.city) params.append('city', archivedFilters.city);
      if (archivedFilters.state) params.append('state', archivedFilters.state);
      if (archivedFilters.milesMin) params.append('milesMin', archivedFilters.milesMin);
      if (archivedFilters.milesMax) params.append('milesMax', archivedFilters.milesMax);
      if (archivedFilters.sortBy) params.append('sortBy', archivedFilters.sortBy);
      
      const response = await fetch(`/api/archive-bids/list?${params.toString()}`);
      const result = await response.json();
      
      if (result.ok) {
        setArchivedBids(result.data);
      } else {
        toast.error("Failed to load archived bids");
      }
    } catch (error) {
      toast.error("Failed to load archived bids");
    } finally {
      setIsLoadingArchived(false);
    }
  };

  // Filter bids based on current settings - use useMemo to prevent hydration mismatch
  const filteredBids = useMemo(() => {
    return bids.filter((bid: TelegramBid) => {
      // Apply showExpired filter
      if (!showExpired && bid.is_expired) return false;
      return true;
    });
  }, [bids, showExpired]);

  // Calculate stats with useMemo to prevent hydration mismatch
  const stats = useMemo(() => {
    // Use separate API calls for accurate counts (matching admin page logic)
    // activeBidsAll already contains only active bids (from showExpired=false query)
    // expiredBidsAll already contains only expired bids (from showExpired=true query)
    const activeCount = activeBidsAll.length;
    const expiredCount = expiredBidsAll.length;
    const uniqueStates = new Set([...activeBidsAll, ...expiredBidsAll].map((b: TelegramBid) => b.tag).filter(Boolean)).size;
    
    return {
      activeCount,
      expiredCount,
      statesCount: uniqueStates,
      totalValue: filteredBids.length > 0 ? "Live" : "0"
    };
  }, [activeBidsAll, expiredBidsAll, showExpired, filteredBids]);

  // Show access restriction banner for unapproved users
  const renderAccessBanner = () => {
    if (profileLoading) return null;
    
    if (!profile || profile.profile_status !== 'approved') {
      return (
        <Glass className="border-l-4 border-l-red-500 dark:border-l-red-400 mb-6">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 dark:text-red-400">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Access to website features are restricted until you setup your profile and it has been reviewed by an admin.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your profile to gain access to all features and start bidding on loads.
                </p>
              </div>
              <Button asChild>
                <Link href="/carrier/profile">
                  <User className="h-4 w-4 mr-2" />
                  Complete Profile
                </Link>
              </Button>
            </div>
          </div>
        </Glass>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Access Restriction Banner */}
      {renderAccessBanner()}
      
      {/* Filters - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
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
      )}

      {/* Filter Controls - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <Glass className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant={showExpired ? "default" : "outline"}
              onClick={() => setShowExpired(!showExpired)}
              style={showExpired ? {
                backgroundColor: accentColor,
                color: buttonTextColor
              } : {}}
            >
              <Clock className="w-4 h-4 mr-2" />
              {showExpired ? "Hide Expired" : "Show Expired"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowManageBidsConsole(true)}
              className="hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30"
            >
              <Gavel className="w-4 h-4 mr-2" />
              Manage Bids
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowFavoritesConsole(true)}
              className="hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30"
            >
              <Star className="w-4 h-4 mr-2" />
              Favorites
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
            Showing {showExpired ? "all" : "live"} bids
            {!isAdmin && !showExpired && " (today only)"}
          </div>
        </div>
        </Glass>
      )}

      {/* Stats - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">Active Auctions</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.activeCount}
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
                {stats.expiredCount}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">States</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.statesCount}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalValue}
              </p>
            </div>
          </div>
        </Glass>
        </div>
      )}

      {/* Bids Grid - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <>
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
                  <span className="text-sm">{formatStops(bid.stops || [])}</span>
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
                  <span className="text-sm">{formatStopCount(bid.stops || [])}</span>
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
                      onClick={() => handleToggleFavorite(bid.bid_number)}
                      disabled={isTogglingFavorite === bid.bid_number}
                      className={`${
                        favorites[bid.bid_number] 
                          ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 border-yellow-500/30' 
                          : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/20'
                      }`}
                    >
                      {isTogglingFavorite === bid.bid_number ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Star className={`w-4 h-4 ${favorites[bid.bid_number] ? 'fill-current' : ''}`} />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewDetailsBid(bid)}
                    >
                      View Details
                    </Button>
                    {!bid.is_expired && (
                      <Button
                        size="sm"
                        onClick={() => openBidDialog(bid)}
                        style={{
                          backgroundColor: accentColor,
                          color: buttonTextColor
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
                  <span className="text-sm">{formatStops(selectedBid.stops || [])}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatDistance(selectedBid.distance_miles)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Pickup: {formatPickupDateTime(selectedBid.pickup_timestamp)} | Delivery: {formatPickupDateTime(selectedBid.delivery_timestamp)}
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
                  style={{
                    backgroundColor: accentColor,
                    color: buttonTextColor
                  }}
                  className="hover:opacity-90"
                >
                  {isBidding ? "Placing Bid..." : "Place Bid"}
                </Button>
              </div>
            </div>
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
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bid Number</label>
                  <p className="text-lg font-semibold">#{viewDetailsBid.bid_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State Tag</label>
                  <p className="text-lg font-semibold">{viewDetailsBid.tag || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Distance</label>
                  <p className="text-lg font-semibold">{formatDistance(viewDetailsBid.distance_miles)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stops</label>
                  <p className="text-lg font-semibold">{formatStopCount(viewDetailsBid.stops || [])}</p>
                </div>
              </div>

              {/* Pickup & Delivery Times */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                  <p className="text-lg font-semibold">Pickup: {formatPickupDateTime(viewDetailsBid.pickup_timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                  <p className="text-lg font-semibold">Delivery: {formatPickupDateTime(viewDetailsBid.delivery_timestamp)}</p>
                </div>
              </div>

              {/* Detailed Stops */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Route Details</h3>
                <div className="space-y-2">
                  {formatStopsDetailed(viewDetailsBid.stops || []).map((stop, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{stop}</p>
                        <p className="text-sm text-muted-foreground">
                          {index === 0 ? 'Pickup Location' : 
                           index === formatStopsDetailed(viewDetailsBid.stops || []).length - 1 ? 'Delivery Location' : 
                           'Stop Location'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Route Map */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Route Map</h3>
                <div className="rounded-lg overflow-hidden border border-border/40">
                  <MapboxMap 
                    stops={formatStopsDetailed(viewDetailsBid.stops || [])} 
                    className="w-full"
                  />
                </div>
              </div>

              {/* Bidding Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Auction Information</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Bids</label>
                    <p className="text-lg font-semibold">{viewDetailsBid.bids_count || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="text-lg font-semibold">
                      {viewDetailsBid.is_expired ? 'Auction Closed' : 'Bidding Open'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Time Remaining</label>
                    <div className="flex items-center gap-2">
                      <Countdown 
                        expiresAt={viewDetailsBid.expires_at_25}
                        variant={viewDetailsBid.is_expired ? "expired" : viewDetailsBid.time_left_seconds <= 300 ? "urgent" : "default"}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Source Information</h3>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Received At</label>
                    <p className="text-lg font-semibold">{formatPickupDateTime(viewDetailsBid.received_at)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setViewDetailsBid(null)}
                >
                  Close
                </Button>
                {!viewDetailsBid.is_expired && (
                  <Button
                    onClick={() => {
                      setViewDetailsBid(null);
                      openBidDialog(viewDetailsBid);
                    }}
                    style={{
                      backgroundColor: accentColor,
                      color: buttonTextColor
                    }}
                    className="hover:opacity-90"
                  >
                    <Gavel className="w-4 h-4 mr-2" />
                    Place Bid
                  </Button>
                )}
              </div>
            </div>
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
          
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={archivedFilters.date}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <Input
                  placeholder="Enter city"
                  value={archivedFilters.city}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">State</label>
                <Input
                  placeholder="Enter state"
                  value={archivedFilters.state}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Miles</label>
                <Input
                  type="number"
                  placeholder="Min miles"
                  value={archivedFilters.milesMin}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, milesMin: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Miles</label>
                <Input
                  type="number"
                  placeholder="Max miles"
                  value={archivedFilters.milesMax}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, milesMax: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <select
                  className="w-full p-2 border border-border rounded-md bg-background"
                  value={archivedFilters.sortBy}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                >
                  <option value="date">Date (Newest First)</option>
                  <option value="bids">Bid Count (Lowest to Highest)</option>
                </select>
              </div>
            </div>

            {/* Archived Bids List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Archived Bids</h3>
              {isLoadingArchived ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading archived bids...</p>
                </div>
              ) : archivedBids.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Archived Bids Found</h4>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or select a different date range.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {archivedBids.map((bid: any) => (
                    <div key={`${bid.bid_number}-${bid.archived_date}`} className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">#{bid.bid_number}</Badge>
                        <Badge variant="secondary">{bid.tag}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{formatStops(bid.stops)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDistance(bid.distance_miles)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{new Date(bid.archived_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gavel className="w-4 h-4 text-muted-foreground" />
                          <span>{bid.bids_count || 0} bids</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowArchived(false)}
              >
                Close
              </Button>
              <Button
                onClick={loadArchivedBids}
                disabled={isLoadingArchived}
                style={{
                  backgroundColor: accentColor,
                  color: buttonTextColor
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                {isLoadingArchived ? "Searching..." : "Search Archived"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Manage Bids Console */}
      <ManageBidsConsole 
        isOpen={showManageBidsConsole} 
        onClose={() => setShowManageBidsConsole(false)} 
      />

      {/* Favorites Console */}
      <FavoritesConsole 
        isOpen={showFavoritesConsole} 
        onClose={() => setShowFavoritesConsole(false)} 
      />
    </div>
  );
}