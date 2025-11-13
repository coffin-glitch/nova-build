"use client";

import { BidMessageConsole } from "@/components/bid-message/BidMessageConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { formatDistance, formatMoney, formatPickupDateTime, formatStopCount } from "@/lib/format";
import {
  Calendar,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  Grid3X3,
  List,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  Upload,
  XCircle,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { BidAnalytics } from "./BidAnalytics";
import { BidDetailsDialog } from "./BidDetailsDialog";
import { BidLifecycleManager } from "./BidLifecycleManager";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AwardedBid {
  id: number;
  bid_number: string;
  winner_user_id: string;
  winner_amount_cents: number;
  awarded_by: string;
  awarded_at: string;
  // Bid details from telegram_bids
  distance_miles?: number;
  pickup_timestamp?: string;
  delivery_timestamp?: string;
  stops?: any;
  tag?: string;
  source_channel?: string;
  // Lifecycle status
  status?: 'awarded' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  updated_at?: string;
  // Driver information fields (similar to load offers)
  driver_info_required?: boolean;
  driver_info_submitted_at?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  truck_number?: string;
  trailer_number?: string;
}

interface BidStats {
  totalAwarded: number;
  activeBids: number;
  completedBids: number;
  totalRevenue: number;
  averageAmount: number;
}

interface FilterState {
  searchTerm: string;
  status: string[];
  dateRange: { start: string; end: string };
  revenueRange: [number, number];
  distanceRange: [number, number];
  tag: string[];
  originStates: string[];
  destinationStates: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Progress calculation utility
const getProgressForStatus = (status: string) => {
  // If status is 'awarded' (not yet accepted), return 0%
  if (status === 'awarded') {
    return 0;
  }
  
  const statusOrder = [
    'bid_awarded',
    'load_assigned', 
    'checked_in_origin',
    'picked_up',
    'departed_origin',
    'in_transit',
    'checked_in_destination',
    'delivered',
    'completed'
  ];
  
  const currentIndex = statusOrder.indexOf(status);
  if (currentIndex === -1) return 0;
  
  // Use the same calculation as BidLifecycleManager: (currentIndex + 1) / length
  return Math.round(((currentIndex + 1) / statusOrder.length) * 100);
};

export function CarrierBidsConsole() {
  const { user, isLoaded } = useUnifiedUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [selectedMessageBid, setSelectedMessageBid] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBidForDialog, setSelectedBidForDialog] = useState<AwardedBid | null>(null);
  const [viewLoadDetailsBid, setViewLoadDetailsBid] = useState<any | null>(null);
  const [documentUploadBid, setDocumentUploadBid] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateBids, setSelectedDateBids] = useState<AwardedBid[]>([]);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [expandedRecentBids, setExpandedRecentBids] = useState<Set<string>>(new Set());
  const { accentColor } = useAccentColor();
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    searchTerm: '',
    status: [],
    dateRange: { start: '', end: '' },
    revenueRange: [0, 10000],
    distanceRange: [0, 3000],
    tag: [],
    originStates: [],
    destinationStates: [],
    sortBy: 'awarded_at',
    sortOrder: 'desc'
  });

  // Expand/Collapse state for lifecycle bids
  const [expandedBids, setExpandedBids] = useState<Set<string>>(new Set());

  // Toggle expand/collapse for lifecycle bids
  const toggleBidExpansion = (bidId: string) => {
    const newExpanded = new Set(expandedBids);
    if (newExpanded.has(bidId)) {
      newExpanded.delete(bidId);
    } else {
      newExpanded.add(bidId);
    }
    setExpandedBids(newExpanded);
  };

  // Fetch awarded bids
  const { data: bidsData, mutate: mutateBids } = useSWR(
    user ? "/api/carrier/awarded-bids" : null,
    fetcher,
    { refreshInterval: 60000 } // Increased to prevent rate limiting
  );

  // Fetch bid statistics
  const { data: statsData } = useSWR(
    user ? "/api/carrier/bid-stats" : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch active bids (bids placed on bid-board that are still active)
  const { data: activeBidsData, mutate: mutateActiveBids } = useSWR(
    user ? "/api/carrier/bids" : null,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds for active bids
  );

  const awardedBids: AwardedBid[] = bidsData?.data || [];
  const serverStats: BidStats = statsData?.data || {
    totalAwarded: 0,
    activeBids: 0,
    completedBids: 0,
    totalRevenue: 0,
    averageAmount: 0
  };

  // Filter active bids - only show bids that are still active (not expired, not won/lost)
  const allBids: any[] = activeBidsData?.data || [];
  const activeBidsList = allBids.filter((bid: any) => bid.bidStatus === 'active' && !bid.isExpired);
  
  // Active awarded bids: Any bid that is in the "bid_awarded" lifecycle until marked "completed"
  // This includes: awarded, bid_awarded, load_assigned, checked_in_origin, picked_up, 
  // departed_origin, in_transit, checked_in_destination, delivered, accepted, in_progress
  // Excludes: completed, cancelled
  const activeAwardedBids = awardedBids.filter(bid => {
    const status = bid.status || 'awarded';
    return status !== 'completed' && status !== 'cancelled';
  }).length;
  
  const stats: BidStats = {
    totalAwarded: serverStats.totalAwarded,
    activeBids: activeBidsList.length + activeAwardedBids, // Active bids from bid-board + active awarded bids
    completedBids: serverStats.completedBids,
    totalRevenue: serverStats.totalRevenue,
    averageAmount: serverStats.averageAmount
  };

  // Filter bids based on search and filters
  const filteredBids = awardedBids.filter(bid => {
    const matchesSearch = !searchTerm || 
      bid.bid_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.source_channel?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || bid.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      awarded: "bg-blue-500/20 text-blue-300 border-blue-400",
      accepted: "bg-green-500/20 text-green-300 border-green-400",
      in_progress: "bg-orange-500/20 text-orange-300 border-orange-400",
      completed: "bg-gray-500/20 text-gray-300 border-gray-400",
      cancelled: "bg-red-500/20 text-red-300 border-red-400"
    };
    
    // Show "Awaiting Acceptance" for awarded status
    const displayStatus = status === 'awarded' ? 'Awaiting Acceptance' : status.replace('_', ' ').toUpperCase();
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.awarded}>
        {displayStatus}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      awarded: Package,
      accepted: CheckCircle,
      in_progress: Truck,
      completed: CheckCircle,
      cancelled: XCircle
    };
    
    const Icon = icons[status as keyof typeof icons] || Package;
    return <Icon className="w-4 h-4" />;
  };

  // Date formatting and grouping functions
  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleDateClick = (date: string, bids: AwardedBid[]) => {
    setSelectedDate(date);
    setSelectedDateBids(bids);
    setShowDateDialog(true);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">Please sign in to view your bids</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Bids Console</h2>
          <p className="text-muted-foreground">Manage your awarded bids and track their lifecycle</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Awarded</p>
                <p className="text-2xl font-bold">{stats.totalAwarded}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Avg: {formatMoney(stats.averageAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Bids</p>
                <p className="text-2xl font-bold">{stats.activeBids}</p>
              </div>
              <Truck className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.completedBids} completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Bids</p>
                <p className="text-2xl font-bold">{stats.completedBids}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.totalAwarded} total awarded
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                From {stats.activeBids} bids
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            mutateBids();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="my-bids">My Bids</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Bids - Live Auction Console */}
            <Card className="overflow-hidden lg:col-span-1">
              <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b p-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-blue-500" />
                    Active Bids
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    {activeBidsList.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {activeBidsList.length > 0 ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {activeBidsList.map((bid: any) => {
                      const expiresAt = bid.expiresAt || (() => {
                        const receivedAt = new Date(bid.receivedAt);
                        return new Date(receivedAt.getTime() + (25 * 60 * 1000)).toISOString();
                      })();
                      const stops = Array.isArray(bid.stops) ? bid.stops : (bid.stops ? JSON.parse(bid.stops) : []);
                      const origin = stops[0] || 'Unknown';
                      const destination = stops[stops.length - 1] || 'Unknown';
                      
                      return (
                        <div
                          key={bid.bidNumber}
                          onClick={() => {
                            // For active bids, show load details only (not lifecycle)
                            setViewLoadDetailsBid(bid);
                          }}
                          className="group relative p-2.5 border rounded-lg bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer hover:shadow-md hover:border-primary/50"
                        >
                          {/* Pulse animation for active status */}
                          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          
                          <div className="space-y-2">
                            {/* Header Row */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h4 className="font-semibold text-xs">#{bid.bidNumber}</h4>
                                  {bid.tag && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                      {bid.tag}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span className="truncate">{origin} → {destination}</span>
                                </div>
                              </div>
                              
                              {/* Countdown Timer */}
                              <div className="flex-shrink-0">
                                <Countdown 
                                  expiresAt={expiresAt}
                                  variant={bid.timeLeftSeconds && bid.timeLeftSeconds <= 300 ? "urgent" : "default"}
                                  className="text-[10px]"
                                />
                              </div>
                            </div>

                            {/* Details Row */}
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{formatDistance(bid.distance || 0)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
                              </div>
                            </div>

                            {/* Bid Info Row */}
                            <div className="flex items-center justify-between pt-1.5 border-t">
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-green-500" />
                                <div>
                                  <p className="text-[10px] text-muted-foreground">My Bid</p>
                                  <p className="font-semibold text-xs text-green-500">
                                    ${Number(bid.myBid || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // For active bids, show load details only (not lifecycle)
                                  setViewLoadDetailsBid(bid);
                                }}
                              >
                                <Eye className="w-3 h-3 mr-0.5" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Truck className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground mb-1">No Active Bids</p>
                    <p className="text-[10px] text-muted-foreground">
                      Place bids on the bid-board to see them here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Awarded Bids */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Recent Awarded Bids
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {awardedBids.slice(0, 5).map((bid) => {
                    const isExpanded = expandedRecentBids.has(bid.bid_number);
                    return (
                      <Card 
                        key={bid.id} 
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => {
                              const newExpanded = new Set(expandedRecentBids);
                              if (isExpanded) {
                                newExpanded.delete(bid.bid_number);
                              } else {
                                newExpanded.add(bid.bid_number);
                              }
                              setExpandedRecentBids(newExpanded);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(bid.status || 'awarded')}
                              <div>
                                <p className="font-medium">#{bid.bid_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'} • {bid.tag || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-semibold">{formatMoney(bid.winner_amount_cents)}</p>
                                {getStatusBadge(bid.status || 'awarded')}
                              </div>
                              <ChevronDown 
                                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t">
                              <BidDetailsDialog bid={bid} />
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMessageBid(bid.bid_number);
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Message
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocumentUploadBid(bid.bid_number);
                                }}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Documents
                              </Button>
                              {/* Show Accept Bid button only for newly awarded bids (status === 'awarded') */}
                              {bid.status === 'awarded' && (
                                <Button 
                                  size="sm"
                                  disabled={acceptingBid === bid.bid_number}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setAcceptingBid(bid.bid_number);
                                    try {
                                      const response = await fetch(`/api/carrier/bid-lifecycle/${bid.bid_number}`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                          status: 'bid_awarded',
                                          notes: 'Bid accepted by carrier'
                                        }),
                                      });

                                      if (response.ok) {
                                        mutateBids();
                                        toast.success('Bid accepted successfully! You can now access the lifecycle.');
                                      } else {
                                        const errorData = await response.json();
                                        toast.error(`Failed to accept bid: ${errorData.error || 'Unknown error'}`);
                                        console.error('Error accepting bid:', errorData.error);
                                      }
                                    } catch (error) {
                                      toast.error('Failed to accept bid. Please try again.');
                                      console.error('Error accepting bid:', error);
                                    } finally {
                                      setAcceptingBid(null);
                                    }
                                  }}
                                >
                                  <Truck className="w-4 h-4 mr-2" />
                                  {acceptingBid === bid.bid_number ? 'Accepting...' : 'Accept Bid'}
                                </Button>
                              )}
                              {/* Show View Lifecycle button only after bid is accepted (status !== 'awarded') */}
                              {bid.status !== 'awarded' && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBidForDialog(bid);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Truck className="w-4 h-4 mr-2" />
                                  View Lifecycle
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {awardedBids.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No awarded bids yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="my-bids" className="space-y-4">
          {filteredBids.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Awarded Bids</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search criteria"
                    : "Your awarded bids will appear here once you win auctions"
                  }
                </p>
                <Button asChild>
                  <a href="/bid-board">View Live Auctions</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CarrierBidCalendarView 
              bids={filteredBids}
              onDateClick={handleDateClick}
              accentColor={accentColor}
            />
          )}
        </TabsContent>

        {/* Legacy list view - keeping for reference but hidden */}
        <div className="hidden">
          <div className="grid gap-4">
            {filteredBids.map((bid) => (
              <Card key={bid.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">#{bid.bid_number}</h3>
                        {getStatusBadge(bid.status || 'awarded')}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Distance</p>
                          <p className="font-medium">
                            {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pickup</p>
                          <p className="font-medium">
                            {bid.pickup_timestamp ? new Date(bid.pickup_timestamp).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery</p>
                          <p className="font-medium">
                            {bid.delivery_timestamp ? new Date(bid.delivery_timestamp).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">State Tag</p>
                          <p className="font-medium">{bid.tag || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-semibold text-lg">{formatMoney(bid.winner_amount_cents)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span>{bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'}</span>
                        </div>
                        {bid.source_channel && bid.source_channel !== '-1002560784901' && (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-500" />
                            <span>{bid.source_channel}</span>
                          </div>
                        )}
                      </div>

                      {bid.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground">Notes</p>
                          <p className="text-sm">{bid.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Awarded: {new Date(bid.awarded_at).toLocaleDateString()}</span>
                        </div>
                        {bid.updated_at && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Updated: {new Date(bid.updated_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <BidDetailsDialog bid={bid} />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedMessageBid(bid.bid_number)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDocumentUploadBid(bid.bid_number)}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Submit Documents
                      </Button>
                      {bid.status === 'awarded' && (
                        <Button 
                          size="sm"
                          disabled={acceptingBid === bid.bid_number}
                          onClick={async () => {
                            setAcceptingBid(bid.bid_number);
                            try {
                              const response = await fetch(`/api/carrier/bid-lifecycle/${bid.bid_number}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  status: 'bid_awarded',
                                  notes: 'Bid accepted by carrier'
                                }),
                              });

                              if (response.ok) {
                                // Refresh the data to show updated status
                                mutateBids();
                                toast.success('Bid accepted successfully!');
                              } else {
                                const errorData = await response.json();
                                toast.error(`Failed to accept bid: ${errorData.error || 'Unknown error'}`);
                                console.error('Error accepting bid:', errorData.error);
                              }
                            } catch (error) {
                              toast.error('Failed to accept bid. Please try again.');
                              console.error('Error accepting bid:', error);
                            } finally {
                              setAcceptingBid(null);
                            }
                          }}
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          {acceptingBid === bid.bid_number ? 'Accepting...' : 'Accept Bid'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredBids.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Awarded Bids</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search criteria"
                      : "Your awarded bids will appear here once you win auctions"
                    }
                  </p>
                  <Button asChild>
                    <a href="/bid-board">View Live Auctions</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <TabsContent value="lifecycle" className="space-y-4">
          {awardedBids.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Active Bids</h3>
                <p className="text-muted-foreground">
                  You don't have any active bids to track yet. Win auctions to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Calendar View */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Calendar View</h3>
                <CarrierBidCalendarView 
                  bids={awardedBids}
                  onDateClick={handleDateClick}
                  accentColor={accentColor}
                />
              </div>

              {/* Original Lifecycle View */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Bid Lifecycle</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">View:</span>
                    <div className="flex border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-8 px-3"
                      >
                        <List className="w-4 h-4 mr-1" />
                        List
                      </Button>
                      <Button
                        variant={viewMode === 'card' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('card')}
                        className="h-8 px-3"
                      >
                        <Grid3X3 className="w-4 h-4 mr-1" />
                        Card
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
                  {awardedBids.map((bid) => {
                    const isExpanded = expandedBids.has(bid.bid_number);
                    return (
                      <Card key={bid.id} className={viewMode === 'card' ? 'h-fit' : ''}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Truck className="w-5 h-5" />
                              Bid {bid.bid_number}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {(bid.status || 'awarded') === 'awarded' ? 'Awaiting Acceptance' : (bid.status || 'awarded').replace('_', ' ').toUpperCase()}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (viewMode === 'card') {
                                    setSelectedBidForDialog(bid);
                                    setDialogOpen(true);
                                  } else {
                                    toggleBidExpansion(bid.bid_number);
                                  }
                                }}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </CardTitle>
                          
                          {/* Progress Bar Preview */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                              <span>Progress</span>
                              <span>{getProgressForStatus(bid.status || 'awarded')}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                                style={{ width: `${getProgressForStatus(bid.status || 'awarded')}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Bid Awarded</span>
                              <span>Completed</span>
                            </div>
                          </div>
                          
                          {/* State Tag and Miles Preview */}
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md text-xs font-medium">
                                {bid.tag || 'N/A'}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="text-xs font-medium">
                                  {bid.distance_miles ? `${bid.distance_miles} mi` : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-green-600">
                                ${bid.winner_amount_cents ? (bid.winner_amount_cents / 100).toFixed(2) : '0.00'}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && viewMode === 'list' && (
                          <CardContent>
                            <BidLifecycleManager 
                              bidId={bid.bid_number} 
                              bidData={bid}
                            />
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Legacy lifecycle view - keeping for reference but hidden */}
        <div className="hidden">
          <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Bid Lifecycle</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <div className="flex border rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8 px-3"
                  >
                    <List className="w-4 h-4 mr-1" />
                    List
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className="h-8 px-3"
                  >
                    <Grid3X3 className="w-4 h-4 mr-1" />
                    Card
                  </Button>
                </div>
              </div>
            </div>
            
            <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
              {awardedBids.map((bid) => {
                  const isExpanded = expandedBids.has(bid.bid_number);
                  return (
                    <Card key={bid.id} className={viewMode === 'card' ? 'h-fit' : ''}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="w-5 h-5" />
                            Bid {bid.bid_number}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {(bid.status || 'awarded') === 'awarded' ? 'Awaiting Acceptance' : (bid.status || 'awarded').replace('_', ' ').toUpperCase()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (viewMode === 'card') {
                                  setSelectedBidForDialog(bid);
                                  setDialogOpen(true);
                                } else {
                                  toggleBidExpansion(bid.bid_number);
                                }
                              }}
                              className="h-8 w-8 p-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardTitle>
                        
                        {/* Progress Bar Preview */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                            <span>Progress</span>
                            <span>{getProgressForStatus(bid.status || 'awarded')}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                              style={{ width: `${getProgressForStatus(bid.status || 'awarded')}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Bid Awarded</span>
                            <span>Completed</span>
                          </div>
                        </div>
                        
                        {/* State Tag and Miles Preview */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md text-xs font-medium">
                              {bid.tag || 'N/A'}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="text-xs font-medium">
                                {bid.distance_miles ? `${bid.distance_miles} mi` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-green-600">
                              ${bid.winner_amount_cents ? (bid.winner_amount_cents / 100).toFixed(2) : '0.00'}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                    {isExpanded && viewMode === 'list' && (
                      <CardContent>
                        <BidLifecycleManager 
                          bidId={bid.bid_number} 
                          bidData={bid}
                        />
                      </CardContent>
                    )}
                  </Card>
                );
              })}
              </div>
            </div>
        </div>

        <TabsContent value="analytics" className="space-y-4">
          <CarrierBidCalendarView 
            bids={awardedBids}
            onDateClick={handleDateClick}
            accentColor={accentColor}
          />
          <div className="mt-6">
            <BidAnalytics stats={stats} bids={awardedBids} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Bid Details Dialog for Card View */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Bid {selectedBidForDialog?.bid_number} - Lifecycle Details
            </DialogTitle>
          </DialogHeader>
          {selectedBidForDialog && (
            <div className="overflow-x-auto">
              {/* Only show lifecycle if bid has been accepted (status !== 'awarded') */}
              {selectedBidForDialog.status !== 'awarded' ? (
                <BidLifecycleManager 
                  bidId={selectedBidForDialog.bid_number} 
                  bidData={selectedBidForDialog}
                />
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Accept Bid to Access Lifecycle</h3>
                  <p className="text-muted-foreground mb-4">
                    Please accept this bid first to access the lifecycle management.
                  </p>
                  <Button
                    onClick={async () => {
                      if (!selectedBidForDialog) return;
                      setAcceptingBid(selectedBidForDialog.bid_number);
                      try {
                        const response = await fetch(`/api/carrier/bid-lifecycle/${selectedBidForDialog.bid_number}`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            status: 'bid_awarded',
                            notes: 'Bid accepted by carrier'
                          }),
                        });

                        if (response.ok) {
                          mutateBids();
                          toast.success('Bid accepted successfully! You can now access the lifecycle.');
                          setDialogOpen(false);
                        } else {
                          const errorData = await response.json();
                          toast.error(`Failed to accept bid: ${errorData.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        toast.error('Failed to accept bid. Please try again.');
                      } finally {
                        setAcceptingBid(null);
                      }
                    }}
                    disabled={acceptingBid === selectedBidForDialog.bid_number}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    {acceptingBid === selectedBidForDialog.bid_number ? 'Accepting...' : 'Accept Bid'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Load Details Dialog for Active Bids */}
      <Dialog open={!!viewLoadDetailsBid} onOpenChange={() => setViewLoadDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Details - #{viewLoadDetailsBid?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {viewLoadDetailsBid && (() => {
            const stops = Array.isArray(viewLoadDetailsBid.stops) 
              ? viewLoadDetailsBid.stops 
              : (viewLoadDetailsBid.stops ? JSON.parse(viewLoadDetailsBid.stops) : []);
            const origin = stops[0] || 'Unknown';
            const destination = stops[stops.length - 1] || 'Unknown';
            
            return (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Bid Number</label>
                    <p className="text-lg font-semibold">#{viewLoadDetailsBid.bidNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">State Tag</label>
                    <p className="text-lg font-semibold">{viewLoadDetailsBid.tag || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Distance</label>
                    <p className="text-lg font-semibold">{formatDistance(viewLoadDetailsBid.distance || 0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stops</label>
                    <p className="text-lg font-semibold">{formatStopCount(stops)}</p>
                  </div>
                </div>

                {/* Route */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Route</label>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-lg font-semibold">{origin} → {destination}</p>
                  </div>
                  {stops.length > 2 && (
                    <div className="mt-2 space-y-1">
                      {stops.slice(1, -1).map((stop: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
                          <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                          {stop}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pickup & Delivery Times */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                    <p className="text-lg font-semibold">
                      {viewLoadDetailsBid.pickupDate ? formatPickupDateTime(viewLoadDetailsBid.pickupDate) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                    <p className="text-lg font-semibold">
                      {viewLoadDetailsBid.deliveryDate ? formatPickupDateTime(viewLoadDetailsBid.deliveryDate) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* My Bid Info */}
                {viewLoadDetailsBid.myBid && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">My Bid</label>
                        <p className="text-2xl font-bold text-green-500">
                          ${Number(viewLoadDetailsBid.myBid || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Countdown */}
                {viewLoadDetailsBid.expiresAt && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Time Remaining</label>
                    <Countdown 
                      expiresAt={viewLoadDetailsBid.expiresAt || (() => {
                        const receivedAt = new Date(viewLoadDetailsBid.receivedAt);
                        return new Date(receivedAt.getTime() + (25 * 60 * 1000)).toISOString();
                      })()}
                      variant={viewLoadDetailsBid.timeLeftSeconds && viewLoadDetailsBid.timeLeftSeconds <= 300 ? "urgent" : "default"}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Bid Message Console */}
      <BidMessageConsole
        bidNumber={selectedMessageBid || ""}
        userRole="carrier"
        userId={user?.id || ""}
        onClose={() => setSelectedMessageBid(null)}
      />

      {/* Document Upload Dialog */}
      {documentUploadBid && (
        <DocumentUploadDialog
          bidNumber={documentUploadBid}
          isOpen={!!documentUploadBid}
          onClose={() => setDocumentUploadBid(null)}
          onUploaded={() => mutateBids()}
        />
      )}

      {/* Date Detail Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Bids for {selectedDate ? new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDateBids.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No bids found for this date.</p>
              </Card>
            ) : (
              selectedDateBids.map((bid, index) => (
                <Card 
                  key={`${bid.bid_number}-${bid.id}-${index}`} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedBidForDialog(bid);
                    setDialogOpen(true);
                    setShowDateDialog(false);
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">#{bid.bid_number}</h3>
                          {getStatusBadge(bid.status || 'awarded')}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Distance</p>
                            <p className="font-medium">
                              {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Pickup</p>
                            <p className="font-medium">
                              {bid.pickup_timestamp ? new Date(bid.pickup_timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Delivery</p>
                            <p className="font-medium">
                              {bid.delivery_timestamp ? new Date(bid.delivery_timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">State Tag</p>
                            <p className="font-medium">{bid.tag || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="font-semibold text-lg">{formatMoney(bid.winner_amount_cents)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <span>{bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Awarded: {new Date(bid.awarded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div 
                        className="flex items-center gap-2 flex-wrap ml-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <BidDetailsDialog bid={bid} />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedMessageBid(bid.bid_number);
                            setShowDateDialog(false);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Message
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setDocumentUploadBid(bid.bid_number);
                            setShowDateDialog(false);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Documents
                        </Button>
                        {/* Show Accept Bid button only for newly awarded bids (status === 'awarded') */}
                        {bid.status === 'awarded' && (
                          <Button 
                            size="sm"
                            disabled={acceptingBid === bid.bid_number}
                            onClick={async () => {
                              setAcceptingBid(bid.bid_number);
                              try {
                                const response = await fetch(`/api/carrier/bid-lifecycle/${bid.bid_number}`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    status: 'bid_awarded',
                                    notes: 'Bid accepted by carrier'
                                  }),
                                });

                                if (response.ok) {
                                  mutateBids();
                                  toast.success('Bid accepted successfully! You can now access the lifecycle.');
                                  setShowDateDialog(false);
                                } else {
                                  const errorData = await response.json();
                                  toast.error(`Failed to accept bid: ${errorData.error || 'Unknown error'}`);
                                  console.error('Error accepting bid:', errorData.error);
                                }
                              } catch (error) {
                                toast.error('Failed to accept bid. Please try again.');
                                console.error('Error accepting bid:', error);
                              } finally {
                                setAcceptingBid(null);
                              }
                            }}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            {acceptingBid === bid.bid_number ? 'Accepting...' : 'Accept Bid'}
                          </Button>
                        )}
                        {/* Show View Lifecycle button only after bid is accepted (status !== 'awarded') */}
                        {bid.status !== 'awarded' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => {
                              setSelectedBidForDialog(bid);
                              setDialogOpen(true);
                              setShowDateDialog(false);
                            }}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            View Lifecycle
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Carrier Calendar View Component
function CarrierBidCalendarView({ 
  bids, 
  onDateClick, 
  accentColor 
}: { 
  bids: AwardedBid[]; 
  onDateClick: (date: string, bids: AwardedBid[]) => void;
  accentColor: string;
}) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Initialize to the month of the most recent bid, or current month
    if (bids.length > 0) {
      const dates = bids.map(bid => new Date(bid.awarded_at));
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
      return new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const groupBidsByDate = (bids: AwardedBid[]) => {
    const grouped: Record<string, AwardedBid[]> = {};
    bids.forEach(bid => {
      const dateKey = formatDateOnly(bid.awarded_at);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bid);
    });
    return grouped;
  };

  const getSortedDates = (bids: AwardedBid[], monthFilter?: Date) => {
    const dates = new Set<string>();
    bids.forEach(bid => {
      const bidDate = new Date(bid.awarded_at);
      if (!monthFilter || 
          (bidDate.getFullYear() === monthFilter.getFullYear() && 
           bidDate.getMonth() === monthFilter.getMonth())) {
        dates.add(formatDateOnly(bid.awarded_at));
      }
    });
    return Array.from(dates).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime(); // Newest first
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const bidsByDate = groupBidsByDate(bids);
  const sortedDates = getSortedDates(bids, currentMonth);
  
  // Get all available months from bids
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    bids.forEach(bid => {
      const date = new Date(bid.awarded_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      months.add(monthKey);
    });
    return Array.from(months)
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        return new Date(year, month, 1);
      })
      .sort((a, b) => b.getTime() - a.getTime());
  }, [bids]);

  const currentMonthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      year: date.getFullYear(),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      full: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    };
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <div className="space-y-4">
      {/* Month/Year Navigation Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-4">
            <select
              value={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-').map(Number);
                setCurrentMonth(new Date(year, month, 1));
              }}
              className="px-4 py-2 border border-border rounded-md bg-background text-foreground font-semibold text-lg cursor-pointer hover:bg-accent transition-colors"
              style={{ color: accentColor }}
            >
              {availableMonths.map(month => {
                const key = `${month.getFullYear()}-${month.getMonth()}`;
                const label = month.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric"
                });
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="flex items-center gap-2"
            disabled={currentMonth.getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {sortedDates.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">No bids for {currentMonthLabel}</h3>
            <p className="text-muted-foreground">
              Select a different month to view bids.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedDates.map((dateStr) => {
            const dateBids = bidsByDate[dateStr] || [];
            const dateInfo = formatDateDisplay(dateStr);
            const bidCount = dateBids.length;
            const totalRevenue = dateBids.reduce((sum, bid) => sum + (bid.winner_amount_cents || 0), 0) / 100;

            return (
              <Card
                key={dateStr}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-opacity-50"
                style={{ 
                  borderColor: accentColor,
                  opacity: 0.8
                }}
                onClick={() => onDateClick(dateStr, dateBids)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        {dateInfo.weekday}
                      </span>
                      <span className="text-2xl font-bold" style={{ color: accentColor }}>
                        {dateInfo.day}
                      </span>
                    </div>
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{dateInfo.month} {dateInfo.year}</div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Bids:</span>
                      <span className="text-sm font-semibold">{bidCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Revenue:</span>
                      <span className="text-sm font-semibold text-green-600">
                        ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}