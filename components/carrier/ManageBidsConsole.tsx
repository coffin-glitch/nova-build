"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatDistance, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Gavel,
  LayoutGrid,
  MapPin,
  Navigation,
  Search,
  Table as TableIcon,
  Target,
  Truck,
  X,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ActiveBid {
  id: string;
  bidNumber: string;
  myBid: number | null;
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
  currentBid: number | null;
  bidCount: number;
  bidStatus?: 'active' | 'won' | 'lost' | 'expired' | 'pending';
  timeLeftSeconds?: number;
  award?: any;
}


interface ManageBidsConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManageBidsConsole({ isOpen, onClose }: ManageBidsConsoleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDetailsBid, setViewDetailsBid] = useState<ActiveBid | null>(null);
  const [modifyBidDialog, setModifyBidDialog] = useState<ActiveBid | null>(null);
  const [cancelBidDialog, setCancelBidDialog] = useState<ActiveBid | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const { accentColor, accentBgStyle } = useAccentColor();

  const { data, mutate, isLoading } = useSWR(
    isOpen ? `/api/carrier/bids` : null,
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

  // Removed getBidPosition - blind bid system, no position information shown

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
    setBidAmount((bid.myBid || 0).toString());
    setBidNotes(bid.notes || "");
  };

  const openCancelDialog = (bid: ActiveBid) => {
    setCancelBidDialog(bid);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Manage Your Bids
          </DialogTitle>
          <DialogDescription>
            View and manage your active and closed bids
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[80vh] space-y-6">
          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Gavel className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{activeBids.length}</div>
                  <div className="text-xs text-muted-foreground">Active Bids</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    ${activeBids.reduce((sum, bid) => sum + Number(bid.myBid || 0), 0).toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Value</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {closedBids.filter(b => b.bidStatus === 'won').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Won Bids</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{closedBids.length}</div>
                  <div className="text-xs text-muted-foreground">Closed Bids</div>
                </div>
              </div>
            </Glass>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search bids..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'closed')}>
            <div className="flex items-center justify-between">
              <TabsList className="grid w-auto grid-cols-2">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Active ({activeBids.length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Closed ({closedBids.length})
                </TabsTrigger>
              </TabsList>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border border-border rounded p-0.5">
                <Button
                  variant={viewMode === 'card' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className={`text-xs px-2 py-1 h-7 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : ''}`}
                  title="Card View"
                >
                  <LayoutGrid className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`text-xs px-2 py-1 h-7 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
                  title="List View"
                >
                  <TableIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Active Bids Tab */}
            <TabsContent value="active" className="space-y-4">
              {filteredActiveBids.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="text-sm font-semibold mb-1">No active bids</h3>
                  <p className="text-xs text-muted-foreground">Start bidding on loads from the Live Auctions</p>
                </div>
              ) : viewMode === 'card' ? (
                <div className="space-y-3">
                  {filteredActiveBids.map((bid) => (
                    <Glass key={bid.id} className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{bid.bidNumber}</h4>
                            <Badge className={getStatusColor(bid)}>
                              {getStatusText(bid)}
                            </Badge>
                            {getStatusIcon(bid)}
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Time Left</div>
                            <Countdown 
                              expiresAt={bid.expiresAt} 
                              className="text-sm font-mono"
                            />
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{formatStops(bid.stops)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDistance(bid.distance)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span>{formatStopCount(bid.stops)}</span>
                          </div>
                        </div>

                        {/* Bidding Info */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span>My Bid: <span className="font-semibold text-blue-400">${Number(bid.myBid || 0).toFixed(2)}</span></span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewDetailsBid(bid)}
                              className="text-xs px-2 py-1"
                            >
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModifyDialog(bid)}
                              className="text-xs px-2 py-1 hover:bg-blue-500/20 hover:text-blue-400"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Modify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCancelDialog(bid)}
                              className="text-xs px-2 py-1 hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Glass>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium">Bid #</th>
                        <th className="text-left p-2 font-medium">Route</th>
                        <th className="text-left p-2 font-medium">Distance</th>
                        <th className="text-left p-2 font-medium">My Bid</th>
                        <th className="text-left p-2 font-medium">Time Left</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-right p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveBids.map((bid) => (
                        <tr key={bid.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="p-2 font-semibold">{bid.bidNumber}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">{formatStops(bid.stops)}</span>
                            </div>
                          </td>
                          <td className="p-2 text-xs">{formatDistance(bid.distance)}</td>
                          <td className="p-2">
                            <span className="font-semibold text-blue-400">${Number(bid.myBid || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-2">
                            <Countdown expiresAt={bid.expiresAt} className="text-xs font-mono" />
                          </td>
                          <td className="p-2">
                            <Badge className={getStatusColor(bid)} variant="outline">
                              {getStatusText(bid)}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewDetailsBid(bid)}
                                className="text-xs px-2 py-1 h-7"
                              >
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openModifyDialog(bid)}
                                className="text-xs px-2 py-1 h-7 hover:bg-blue-500/20 hover:text-blue-400"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCancelDialog(bid)}
                                className="text-xs px-2 py-1 h-7 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Closed Bids Tab */}
            <TabsContent value="closed" className="space-y-4">
              {filteredClosedBids.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="text-sm font-semibold mb-1">No closed bids</h3>
                  <p className="text-xs text-muted-foreground">Your closed bids will appear here</p>
                </div>
              ) : viewMode === 'card' ? (
                <div className="space-y-3">
                  {filteredClosedBids.map((bid) => (
                    <Glass key={bid.id} className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{bid.bidNumber}</h4>
                            <Badge className={getStatusColor(bid)}>
                              {getStatusText(bid)}
                            </Badge>
                            {getStatusIcon(bid)}
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Closed</div>
                            <div className="text-xs font-medium">
                              {new Date(bid.expiresAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{formatStops(bid.stops)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDistance(bid.distance)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span>{formatStopCount(bid.stops)}</span>
                          </div>
                        </div>

                        {/* Results */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span>My Bid: <span className={`font-semibold ${
                                bid.bidStatus === 'won' ? 'text-green-400' : 
                                bid.bidStatus === 'lost' ? 'text-red-400' : 'text-blue-400'
                              }`}>${Number(bid.myBid || 0).toFixed(2)}</span></span>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewDetailsBid(bid)}
                            className="text-xs px-2 py-1"
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </Glass>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium">Bid #</th>
                        <th className="text-left p-2 font-medium">Route</th>
                        <th className="text-left p-2 font-medium">Distance</th>
                        <th className="text-left p-2 font-medium">My Bid</th>
                        <th className="text-left p-2 font-medium">Closed Date</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-right p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClosedBids.map((bid) => (
                        <tr key={bid.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="p-2 font-semibold">{bid.bidNumber}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">{formatStops(bid.stops)}</span>
                            </div>
                          </td>
                          <td className="p-2 text-xs">{formatDistance(bid.distance)}</td>
                          <td className="p-2">
                            <span className={`font-semibold ${
                              bid.bidStatus === 'won' ? 'text-green-400' : 
                              bid.bidStatus === 'lost' ? 'text-red-400' : 'text-blue-400'
                            }`}>${Number(bid.myBid || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-2 text-xs">
                            {new Date(bid.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            <Badge className={getStatusColor(bid)} variant="outline">
                              {getStatusText(bid)}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewDetailsBid(bid)}
                                className="text-xs px-2 py-1 h-7"
                              >
                                Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>

        {/* Modify Bid Dialog */}
        <Dialog open={!!modifyBidDialog} onOpenChange={() => setModifyBidDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modify Bid - #{modifyBidDialog?.bidNumber}</DialogTitle>
              <DialogDescription>
                Update your bid amount and notes for this load
              </DialogDescription>
            </DialogHeader>
            
            {modifyBidDialog && (
              <div className="space-y-4">
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{formatStops(modifyBidDialog.stops)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span>{formatDistance(modifyBidDialog.distance)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">New Bid Amount ($)</label>
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
                    <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                    <Input
                      value={bidNotes}
                      onChange={(e) => setBidNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      disabled={modifyBidDialog.isExpired}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setModifyBidDialog(null)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleModifyBid}
                    disabled={!bidAmount || isModifying || modifyBidDialog.isExpired}
                    style={accentBgStyle}
                    size="sm"
                  >
                    {isModifying ? "Updating..." : "Update Bid"}
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
              <DialogDescription>
                Confirm cancellation of your bid for this load
              </DialogDescription>
            </DialogHeader>
            
            {cancelBidDialog && (
              <div className="space-y-4">
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Are you sure you want to cancel this bid?</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    This action cannot be undone. You will need to place a new bid if you change your mind.
                  </p>
                </div>

                <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{formatStops(cancelBidDialog.stops)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>Your Bid: ${Number(cancelBidDialog.myBid || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCancelBidDialog(null)}
                    size="sm"
                  >
                    Keep Bid
                  </Button>
                  <Button
                    onClick={handleCancelBid}
                    disabled={isCancelling}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
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
              <DialogDescription>
                View detailed information about this bid and load
              </DialogDescription>
            </DialogHeader>
            
            {viewDetailsBid && (
              <div className="space-y-4">
                <div className="h-48 rounded-lg overflow-hidden">
                  <MapboxMap
                    stops={viewDetailsBid.stops}
                    className="w-full h-full"
                  />
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Detailed Route</h4>
                  <div className="space-y-1">
                    {formatStopsDetailed(viewDetailsBid.stops).map((stop, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded bg-muted/20 text-sm">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span>{stop}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {viewDetailsBid.sourceChannel && viewDetailsBid.sourceChannel !== '-1002560784901' && (
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <span className="ml-2 font-medium">{viewDetailsBid.sourceChannel}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Bid Placed:</span>
                    <span className="ml-2 font-medium">
                      {new Date(viewDetailsBid.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">My Bid:</span>
                    <span className="ml-2 font-medium">${Number(viewDetailsBid.myBid || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
