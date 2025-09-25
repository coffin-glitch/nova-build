"use client";

import { useState, useEffect } from "react";
import { Search, Filter, SortAsc, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import SectionCard from "@/components/layout/SectionCard";
import AuctionCard from "./AuctionCard";
import MapPanel from "@/components/find-loads/MapPanel";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

interface Auction {
  bidNumber: string;
  tag: string;
  route: string;
  pickup: string;
  delivery: string;
  distanceMiles: number;
  receivedAt: string;
  endsAt: string;
  lowestBid?: {
    amount: number;
    carrierName: string;
    mcNumber?: string;
  };
}

interface AuctionBoardProps {
  initialAuctions: Auction[];
}

const sortOptions = [
  { value: "time-remaining", label: "Time Remaining" },
  { value: "lowest-bid", label: "Lowest Bid" },
  { value: "distance", label: "Distance" },
  { value: "bid-number", label: "Bid Number" },
];

export default function AuctionBoard({ initialAuctions }: AuctionBoardProps) {
  const { user, isLoaded } = useUser();
  const [auctions, setAuctions] = useState<Auction[]>(initialAuctions);
  const [filteredAuctions, setFilteredAuctions] = useState<Auction[]>(initialAuctions);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortBy, setSortBy] = useState("time-remaining");

  // Get unique tags for filter
  const availableTags = Array.from(new Set(auctions.map(a => a.tag))).sort();

  // Filter and sort auctions
  useEffect(() => {
    let filtered = auctions;

    // Filter by search term (bid number)
    if (searchTerm) {
      filtered = filtered.filter(auction => 
        auction.bidNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by tag
    if (tagFilter !== "all") {
      filtered = filtered.filter(auction => auction.tag === tagFilter);
    }

    // Sort auctions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "time-remaining":
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
        case "lowest-bid":
          const aBid = a.lowestBid?.amount || Infinity;
          const bBid = b.lowestBid?.amount || Infinity;
          return aBid - bBid;
        case "distance":
          return a.distanceMiles - b.distanceMiles;
        case "bid-number":
          return a.bidNumber.localeCompare(b.bidNumber);
        default:
          return 0;
      }
    });

    setFilteredAuctions(filtered);
  }, [auctions, searchTerm, tagFilter, sortBy]);

  const handlePlaceBid = async (bidNumber: string, amount: number, notes?: string) => {
    // TODO: Implement actual API call to /api/carrier-bids
    console.log("Placing bid:", { bidNumber, amount, notes });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update local state optimistically
    setAuctions(prev => prev.map(auction => {
      if (auction.bidNumber === bidNumber) {
        return {
          ...auction,
          lowestBid: {
            amount,
            carrierName: user?.firstName || "You",
            mcNumber: "123456"
          }
        };
      }
      return auction;
    }));
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // TODO: Implement actual API call to refresh auctions
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Auctions refreshed");
    } catch (error) {
      toast.error("Failed to refresh auctions");
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = () => {
    if (!isLoaded || !user) return null;
    // TODO: Get actual user role from your auth system
    return "carrier"; // Placeholder
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <SectionCard className="group hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Bid number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tag Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">State</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Filter by state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sort By</label>
            <div className="relative">
              <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Sort auctions" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Refresh */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground opacity-0">Refresh</label>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="w-full group-hover:shadow-lg transition-all duration-300"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {filteredAuctions.length} active auctions
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time bidding with 25-minute windows
          </p>
        </div>
      </div>

      {/* Results Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Auctions List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredAuctions.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No auctions found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or check back later for new auctions.
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Auctions
              </Button>
            </div>
          ) : (
            // Auction cards
            filteredAuctions.map((auction) => (
              <AuctionCard
                key={auction.bidNumber}
                {...auction}
                userRole={getUserRole()}
                isSignedIn={!!user}
                onPlaceBid={handlePlaceBid}
              />
            ))
          )}
        </div>

        {/* Map Panel */}
        <div className="lg:col-span-1">
          <MapPanel />
        </div>
      </div>
    </div>
  );
}
