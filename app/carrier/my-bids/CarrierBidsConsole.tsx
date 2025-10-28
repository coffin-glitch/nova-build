"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistance, formatMoney } from "@/lib/format";
import { useUser } from "@clerk/nextjs";
import {
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    DollarSign,
    Grid3X3,
    List,
    MapPin,
    MessageSquare,
    Package,
    RefreshCw,
    TrendingUp,
    Truck,
    XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { BidAnalytics } from "./BidAnalytics";
import { BidDetailsDialog } from "./BidDetailsDialog";
import { BidLifecycleManager } from "./BidLifecycleManager";

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
  
  // Handle both 'awarded' and 'bid_awarded' as the same status
  const normalizedStatus = status === 'awarded' ? 'bid_awarded' : status;
  
  const currentIndex = statusOrder.indexOf(normalizedStatus);
  if (currentIndex === -1) return 0;
  
  // Use the same calculation as BidLifecycleManager: (currentIndex + 1) / length
  return Math.round(((currentIndex + 1) / statusOrder.length) * 100);
};

export function CarrierBidsConsole() {
  const { user, isLoaded } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBidForDialog, setSelectedBidForDialog] = useState<AwardedBid | null>(null);
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
    { refreshInterval: 30000 }
  );

  // Fetch bid statistics
  const { data: statsData } = useSWR(
    user ? "/api/carrier/bid-stats" : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const awardedBids: AwardedBid[] = bidsData?.data || [];
  const stats: BidStats = statsData?.data || {
    totalAwarded: 0,
    activeBids: 0,
    completedBids: 0,
    totalRevenue: 0,
    averageAmount: 0
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
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.awarded}>
        {status.replace('_', ' ').toUpperCase()}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Bids */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Recent Bids
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {awardedBids.slice(0, 5).map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(bid.status || 'awarded')}
                        <div>
                          <p className="font-medium">#{bid.bid_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'} • {bid.tag || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(bid.winner_amount_cents)}</p>
                        {getStatusBadge(bid.status || 'awarded')}
                      </div>
                    </div>
                  ))}
                  {awardedBids.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No awarded bids yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Bids */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Active Bids
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {awardedBids.filter(bid => ['accepted', 'in_progress'].includes(bid.status || 'awarded')).slice(0, 5).map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(bid.status || 'awarded')}
                        <div>
                          <p className="font-medium">#{bid.bid_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'} • {bid.tag || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(bid.winner_amount_cents)}</p>
                        {getStatusBadge(bid.status || 'awarded')}
                      </div>
                    </div>
                  ))}
                  {awardedBids.filter(bid => ['accepted', 'in_progress'].includes(bid.status || 'awarded')).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No active bids</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="my-bids" className="space-y-4">
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
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-500" />
                          <span>{bid.source_channel || 'N/A'}</span>
                        </div>
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

                    <div className="flex items-center gap-2">
                      <BidDetailsDialog bid={bid} />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // TODO: Connect to bid message console
                          console.log('Open message console');
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
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
                                  status: 'load_assigned',
                                  notes: 'Bid accepted by carrier - load assigned'
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
        </TabsContent>

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
                              {(bid.status || 'awarded').replace('_', ' ').toUpperCase()}
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
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <BidAnalytics stats={stats} bids={filteredBids} />
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
              <BidLifecycleManager 
                bidId={selectedBidForDialog.bid_number} 
                bidData={selectedBidForDialog}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}