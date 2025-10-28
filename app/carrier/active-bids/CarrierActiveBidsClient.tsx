"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatDistance, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
    Activity,
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle,
    Clock,
    DollarSign,
    Edit,
    Gavel,
    MapPin,
    Navigation,
    Search,
    Target,
    TrendingDown,
    TrendingUp,
    Truck,
    X,
    XCircle
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ActiveBid {
  id: string;
  bidNumber: string;
  myBid: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  distance: number;
  pickupDate: string;
  deliveryDate: string;
  stops: string[];
  tag: string;
  sourceChannel: string;
  receivedAt: string;
  expiresAt: string;
  isExpired: boolean;
  currentBid: number;
  bidCount: number;
  bidStatus?: 'active' | 'won' | 'lost' | 'expired' | 'pending';
}

export default function CarrierActiveBidsClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDetailsBid, setViewDetailsBid] = useState<ActiveBid | null>(null);
  const [modifyBidDialog, setModifyBidDialog] = useState<ActiveBid | null>(null);
  const [cancelBidDialog, setCancelBidDialog] = useState<ActiveBid | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const { accentColor, accentBgStyle } = useAccentColor();

  const { data, mutate, isLoading } = useSWR(
    `/api/carrier/bids`,
    fetcher,
    {
      refreshInterval: 10000,
      fallbackData: { ok: true, data: [] }
    }
  );

  const bids: ActiveBid[] = data?.data || [];

  // Separate bids by status
  const activeBids = bids.filter((bid: ActiveBid) => !bid.isExpired);
  const closedBids = bids.filter((bid: ActiveBid) => bid.isExpired);

  // Filter bids based on search term
  const filteredActiveBids = activeBids.filter((bid: ActiveBid) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      bid.bidNumber.toLowerCase().includes(searchLower) ||
      bid.tag?.toLowerCase().includes(searchLower) ||
      bid.sourceChannel?.toLowerCase().includes(searchLower) ||
      formatStops(bid.stops).toLowerCase().includes(searchLower)
    );
  });

  const filteredClosedBids = closedBids.filter((bid: ActiveBid) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      bid.bidNumber.toLowerCase().includes(searchLower) ||
      bid.tag?.toLowerCase().includes(searchLower) ||
      bid.sourceChannel?.toLowerCase().includes(searchLower) ||
      formatStops(bid.stops).toLowerCase().includes(searchLower)
    );
  });

  const getStatusIcon = (bid: ActiveBid) => {
    if (bid.isExpired) {
      if (bid.bidStatus === 'won') return <CheckCircle className="h-5 w-5 text-green-400" />;
      if (bid.bidStatus === 'lost') return <XCircle className="h-5 w-5 text-red-400" />;
      return <AlertCircle className="h-5 w-5 text-yellow-400" />;
    }
    if (bid.bidCount === 0) return <Target className="h-5 w-5 text-green-400" />;
    return <Activity className="h-5 w-5 text-blue-400" />;
  };

  const getStatusText = (bid: ActiveBid) => {
    if (bid.isExpired) {
      if (bid.bidStatus === 'won') return "Won";
      if (bid.bidStatus === 'lost') return "Lost";
      return "Expired";
    }
    if (bid.bidCount === 0) return "No Bids";
    return `${bid.bidCount} Bid${bid.bidCount === 1 ? '' : 's'}`;
  };

  const getStatusColor = (bid: ActiveBid) => {
    if (bid.isExpired) {
      if (bid.bidStatus === 'won') return "bg-green-500/20 text-green-400 border-green-500/30";
      if (bid.bidStatus === 'lost') return "bg-red-500/20 text-red-400 border-red-500/30";
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
    if (bid.bidCount === 0) return "bg-green-500/20 text-green-400 border-green-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  const getBidPosition = (bid: ActiveBid) => {
    if (bid.isExpired) return null;
    
    // This would need to be calculated based on actual bid ranking
    // For now, we'll simulate based on bid amount vs current bid
    if (bid.myBid < bid.currentBid) {
      return { position: "Leading", trend: "up", color: "text-green-400" };
    } else if (bid.myBid === bid.currentBid) {
      return { position: "Tied", trend: "equal", color: "text-yellow-400" };
    } else {
      return { position: "Outbid", trend: "down", color: "text-red-400" };
    }
  };

  const handleModifyBid = async () => {
    if (!modifyBidDialog || !bidAmount) return;

    setIsModifying(true);
    try {
      const response = await fetch("/api/carrier-bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bid_number: modifyBidDialog.bidNumber,
          amount: parseFloat(bidAmount),
          notes: bidNotes,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Bid updated successfully!");
        setModifyBidDialog(null);
        setBidAmount("");
        setBidNotes("");
        mutate();
      } else {
        toast.error(result.error || "Failed to update bid");
      }
    } catch (error) {
      toast.error("Failed to update bid");
    } finally {
      setIsModifying(false);
    }
  };

  const handleCancelBid = async () => {
    if (!cancelBidDialog) return;

    setIsCancelling(true);
    try {
      // This would need to be implemented in the API
      const response = await fetch(`/api/carrier/bids/${cancelBidDialog.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Bid cancelled successfully!");
        setCancelBidDialog(null);
        mutate();
      } else {
        toast.error(result.error || "Failed to cancel bid");
      }
    } catch (error) {
      toast.error("Failed to cancel bid");
    } finally {
      setIsCancelling(false);
    }
  };

  const openModifyDialog = (bid: ActiveBid) => {
    setModifyBidDialog(bid);
    setBidAmount(bid.myBid.toString());
    setBidNotes(bid.notes || "");
  };

  const openCancelDialog = (bid: ActiveBid) => {
    setCancelBidDialog(bid);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Gavel className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeBids.length}</div>
              <div className="text-sm text-muted-foreground">Active Bids</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                ${activeBids.reduce((sum, bid) => sum + bid.myBid, 0).toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Bid Value</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {closedBids.filter(b => b.bidStatus === 'won').length}
              </div>
              <div className="text-sm text-muted-foreground">Won Bids</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{closedBids.length}</div>
              <div className="text-sm text-muted-foreground">Closed Bids</div>
            </div>
          </div>
        </Glass>
      </div>

      {/* Search and Controls */}
      <Glass className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search bids..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gavel className="h-4 w-4" />
            <span>
              {activeTab === 'active' 
                ? `${filteredActiveBids.length} active bid${filteredActiveBids.length === 1 ? '' : 's'}`
                : `${filteredClosedBids.length} closed bid${filteredClosedBids.length === 1 ? '' : 's'}`
              }
            </span>
          </div>
        </div>
      </Glass>

      {/* Main Console with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'closed')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active Bids ({activeBids.length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Closed Bids ({closedBids.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Bids Tab */}
        <TabsContent value="active" className="space-y-6">
          {filteredActiveBids.length === 0 ? (
            <div className="text-center py-12">
              <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No active bids match your search" : "No active bids"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search terms" 
                  : "Start bidding on loads from the Live Auctions page"
                }
              </p>
              {!searchTerm && (
                <Link href="/bid-board">
                  <Button className={accentBgStyle}>
                    <Gavel className="h-4 w-4 mr-2" />
                    Browse Live Auctions
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredActiveBids.map((bid) => {
                const position = getBidPosition(bid);
                return (
                  <Glass key={bid.id} className="p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Main Content */}
                      <div className="flex-1 space-y-4">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-foreground">
                              {bid.bidNumber}
                            </h3>
                            <Badge className={getStatusColor(bid)}>
                              {getStatusText(bid)}
                            </Badge>
                            {getStatusIcon(bid)}
                            {position && (
                              <Badge variant="outline" className={position.color}>
                                {position.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
                                {position.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
                                {position.position}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Time Left</div>
                              <Countdown 
                                targetDate={new Date(bid.expiresAt)} 
                                className="text-lg font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Route</div>
                              <div className="font-medium">
                                {formatStops(bid.stops)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Navigation className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Distance</div>
                              <div className="font-medium">
                                {formatDistance(bid.distance)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Stops</div>
                              <div className="font-medium">
                                {formatStopCount(bid.stops)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Pickup</div>
                              <div className="font-medium">
                                {formatPickupDateTime(bid.pickupDate)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Delivery</div>
                              <div className="font-medium">
                                {formatPickupDateTime(bid.deliveryDate)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bidding Info */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Current:</span>
                              <span className="font-semibold">${bid.currentBid.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">My Bid:</span>
                              <span className="font-semibold text-blue-400">${bid.myBid.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {bid.tag && (
                              <Badge variant="secondary" className="text-xs">
                                {bid.tag}
                              </Badge>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewDetailsBid(bid)}
                            >
                              View Details
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModifyDialog(bid)}
                              className="hover:bg-blue-500/20 hover:text-blue-400"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Modify
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCancelDialog(bid)}
                              className="hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Glass>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Closed Bids Tab */}
        <TabsContent value="closed" className="space-y-6">
          {filteredClosedBids.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No closed bids match your search" : "No closed bids"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search terms" 
                  : "Your closed bids will appear here once auctions end"
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredClosedBids.map((bid) => (
                <Glass key={bid.id} className="p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Main Content */}
                    <div className="flex-1 space-y-4">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-foreground">
                            {bid.bidNumber}
                          </h3>
                          <Badge className={getStatusColor(bid)}>
                            {getStatusText(bid)}
                          </Badge>
                          {getStatusIcon(bid)}
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Closed</div>
                          <div className="font-medium">
                            {new Date(bid.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Route Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Route</div>
                            <div className="font-medium">
                              {formatStops(bid.stops)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Navigation className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Distance</div>
                            <div className="font-medium">
                              {formatDistance(bid.distance)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Truck className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Stops</div>
                            <div className="font-medium">
                              {formatStopCount(bid.stops)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bidding Results */}
                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Final Price:</span>
                            <span className="font-semibold">${bid.currentBid.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">My Bid:</span>
                            <span className={`font-semibold ${
                              bid.bidStatus === 'won' ? 'text-green-400' : 
                              bid.bidStatus === 'lost' ? 'text-red-400' : 'text-blue-400'
                            }`}>
                              ${bid.myBid.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {bid.tag && (
                            <Badge variant="secondary" className="text-xs">
                              {bid.tag}
                            </Badge>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewDetailsBid(bid)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Glass>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modify Bid Dialog */}
      <Dialog open={!!modifyBidDialog} onOpenChange={() => setModifyBidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Bid - #{modifyBidDialog?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {modifyBidDialog && (
            <div className="space-y-6">
              {/* Bid Details */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatStops(modifyBidDialog.stops)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatDistance(modifyBidDialog.distance)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Pickup: {formatPickupDateTime(modifyBidDialog.pickupDate)} | Delivery: {formatPickupDateTime(modifyBidDialog.deliveryDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Countdown 
                    targetDate={new Date(modifyBidDialog.expiresAt)}
                    variant={modifyBidDialog.isExpired ? "expired" : "default"}
                  />
                </div>
              </div>

              {/* Bid Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    New Bid Amount ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={modifyBidDialog.isExpired}
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
                    disabled={modifyBidDialog.isExpired}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setModifyBidDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleModifyBid}
                  disabled={!bidAmount || isModifying || modifyBidDialog.isExpired}
                  className={accentBgStyle}
                >
                  {isModifying ? "Updating Bid..." : "Update Bid"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Bid Dialog */}
      <Dialog open={!!cancelBidDialog} onOpenChange={() => setCancelBidDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Bid - #{cancelBidDialog?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {cancelBidDialog && (
            <div className="space-y-6">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Are you sure you want to cancel this bid?</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This action cannot be undone. You will need to place a new bid if you change your mind.
                </p>
              </div>

              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatStops(cancelBidDialog.stops)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Your Bid: ${cancelBidDialog.myBid.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCancelBidDialog(null)}
                >
                  Keep Bid
                </Button>
                <Button
                  onClick={handleCancelBid}
                  disabled={isCancelling}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Bid"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!viewDetailsBid} onOpenChange={() => setViewDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bid Details - {viewDetailsBid?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {viewDetailsBid && (
            <div className="space-y-6">
              {/* Route Map */}
              <div className="h-64 rounded-lg overflow-hidden">
                <MapboxMap
                  stops={viewDetailsBid.stops}
                  className="w-full h-full"
                />
              </div>
              
              {/* Detailed Stops */}
              <div>
                <h4 className="font-semibold mb-3">Detailed Route</h4>
                <div className="space-y-2">
                  {formatStopsDetailed(viewDetailsBid.stops).map((stop, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded bg-muted/20">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm">{stop}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <span className="ml-2 font-medium">{viewDetailsBid.sourceChannel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bid Placed:</span>
                  <span className="ml-2 font-medium">
                    {new Date(viewDetailsBid.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">My Bid:</span>
                  <span className="ml-2 font-medium">${viewDetailsBid.myBid.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Lowest:</span>
                  <span className="ml-2 font-medium">${viewDetailsBid.currentBid.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}