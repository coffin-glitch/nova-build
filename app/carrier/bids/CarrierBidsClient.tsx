"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeCarrierBids } from "@/hooks/useRealtimeCarrierBids";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { formatDistance, formatPickupDateTime, formatStopCount } from "@/lib/format";
import { originDestFromStops } from "@/lib/geo";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  Trophy,
  Truck,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Bid {
  id: string;
  bidNumber: string;
  distance: number;
  pickupDate: string;
  deliveryDate: string;
  stops: string;
  tag: string;
  sourceChannel: string;
  receivedAt: string;
  expiresAt: string;
  isExpired: boolean;
  timeLeftSeconds: number;
  currentBid: number;
  bidCount: number;
  myBid: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  bidStatus: 'active' | 'won' | 'lost' | 'expired' | 'pending';
  award?: {
    winner_user_id: string;
    winner_amount: number;
    awarded_at: string;
  } | null;
}

export function CarrierBidsClient() {
  const { user } = useUnifiedUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDetailsBid, setViewDetailsBid] = useState<Bid | null>(null);
  const [modifyBidDialog, setModifyBidDialog] = useState<Bid | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [bidFilter, setBidFilter] = useState<'all' | 'active' | 'expired' | 'won' | 'lost' | 'pending'>('all');
  const { accentColor } = useAccentColor();

  const { data, mutate, isLoading } = useSWR(
    `/api/carrier/bids`,
    fetcher,
    {
      refreshInterval: 60000, // Reduced from 10s - Realtime handles instant updates
      fallbackData: { ok: true, data: [] }
    }
  );

  // Realtime updates for carrier_bids
  useRealtimeCarrierBids({
    userId: user?.id,
    onInsert: () => {
      mutate();
    },
    onUpdate: () => {
      mutate();
    },
    onDelete: () => {
      mutate();
    },
    enabled: !!user,
  });

  const bids = data?.data || [];

  // Filter bids based on search term and status filter
  const filteredBids = bids.filter((bid: Bid) => {
    const matchesSearch = bid.bidNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.sourceChannel?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = bidFilter === 'all' || 
      (bidFilter === 'active' && bid.bidStatus === 'active') ||
      (bidFilter === 'expired' && (bid.bidStatus === 'pending' || bid.bidStatus === 'expired')) ||
      (bidFilter === 'won' && bid.bidStatus === 'won') ||
      (bidFilter === 'lost' && bid.bidStatus === 'lost') ||
      (bidFilter === 'pending' && bid.bidStatus === 'pending');
    
    return matchesSearch && matchesFilter;
  });

  // Separate bids by status for statistics using the new bidStatus field
  const activeBids = bids.filter((bid: Bid) => bid.bidStatus === 'active');
  const wonBids = bids.filter((bid: Bid) => bid.bidStatus === 'won');
  const lostBids = bids.filter((bid: Bid) => bid.bidStatus === 'lost');
  const expiredBids = bids.filter((bid: Bid) => bid.bidStatus === 'pending' || bid.bidStatus === 'expired');

  const getStatusIcon = (bid: Bid) => {
    switch (bid.bidStatus) {
      case 'won':
        return <Trophy className="h-4 w-4 text-green-500" />;
      case 'lost':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'active':
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (bid: Bid) => {
    switch (bid.bidStatus) {
      case 'won':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Won</Badge>;
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-gray-600">Expired</Badge>;
      case 'active':
      default:
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Active</Badge>;
    }
  };

  const handleRefresh = () => {
    mutate();
    toast.success("Bids refreshed");
  };

  const handleModifyBid = async () => {
    if (!modifyBidDialog) return;
    
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount");
      return;
    }

    setIsModifying(true);
    try {
      const response = await fetch('/api/carrier-bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bid_number: modifyBidDialog.bidNumber,
          amount: amount, // Send as dollars, API will convert to cents
          notes: bidNotes.trim() || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Bid updated successfully!");
        setModifyBidDialog(null);
        setBidAmount("");
        setBidNotes("");
        mutate(); // Refresh the data
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update bid");
      }
    } catch (error) {
      toast.error("Failed to update bid");
      console.error(error);
    } finally {
      setIsModifying(false);
    }
  };

  const handleCancelBid = async () => {
    if (!modifyBidDialog) return;
    
    setIsModifying(true);
    try {
      const response = await fetch(`/api/carrier-bids/${modifyBidDialog.bidNumber}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success("Bid cancelled successfully!");
        setModifyBidDialog(null);
        setBidAmount("");
        setBidNotes("");
        mutate(); // Refresh the data
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to cancel bid");
      }
    } catch (error) {
      toast.error("Failed to cancel bid");
      console.error(error);
    } finally {
      setIsModifying(false);
    }
  };

  const openModifyDialog = (bid: Bid) => {
    setModifyBidDialog(bid);
    setBidAmount(bid.myBid.toString());
    setBidNotes(bid.notes || "");
  };

  const BidCard = ({ bid }: { bid: Bid }) => {
    const { origin, dest } = originDestFromStops(Array.isArray(bid.stops) ? bid.stops : JSON.parse(bid.stops || '[]'));
    
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(bid)}
              <CardTitle className="text-lg">Bid #{bid.bidNumber}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(bid)}
              <Countdown 
                expiresAt={bid.expiresAt} 
                variant={bid.isExpired ? "expired" : bid.timeLeftSeconds <= 300 ? "urgent" : "default"}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Route Information */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{origin || 'Unknown'} → {dest || 'Unknown'}</span>
            <span className="text-xs">({bid.distance || 0} mi)</span>
          </div>

          {/* Load Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Route:</span>
              <div className="font-medium">{origin || 'Unknown'} → {dest || 'Unknown'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Stops:</span>
              <div className="font-medium">{formatStopCount(Array.isArray(bid.stops) ? bid.stops : JSON.parse(bid.stops || '[]'))}</div>
            </div>
          </div>

          {/* Pickup Information */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Pickup:</span>
            <span className="font-medium">{bid.pickupDate ? formatPickupDateTime(bid.pickupDate) : 'Unknown'}</span>
          </div>

          {/* Bid Information - Only show My Bid */}
          <div className="flex justify-center">
            <div>
              <span className="text-sm text-muted-foreground">My Bid:</span>
              <div className="text-2xl font-bold" style={{ color: accentColor }}>
                ${Number(bid.myBid).toFixed(2)}
              </div>
            </div>
          </div>

        {/* Bid Status Information */}
        {bid.bidStatus === 'won' && (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                🎉 Congratulations! You won this bid!
              </span>
            </div>
                        <div className="text-sm text-green-600">
                          Awarded: ${Number(bid.award?.winner_amount || bid.myBid).toFixed(2)}
                        </div>
          </div>
        )}
        
        {bid.bidStatus === 'lost' && (
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                This bid was awarded to another carrier
              </span>
            </div>
                        <div className="text-sm text-red-600">
                          Winner: ${bid.award?.winner_amount ? Number(bid.award.winner_amount).toFixed(2) : 'N/A'}
                        </div>
          </div>
        )}
        
        {bid.bidStatus === 'active' && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Current Bid Count: {bid.bidCount || 0}
              </span>
            </div>
            <div className="text-sm text-blue-600">
              Bidding Open
            </div>
          </div>
        )}
        
        {bid.bidStatus === 'pending' && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Auction expired waiting on award
              </span>
            </div>
            <div className="text-sm text-yellow-600">
              Pending
            </div>
          </div>
        )}
        
        {bid.bidStatus === 'expired' && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-800">
                Auction expired without award
              </span>
            </div>
            <div className="text-sm text-gray-600">
              No Winner
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => setViewDetailsBid(bid)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          {!bid.isExpired ? (
            <Button 
              size="sm" 
              className="flex-1" 
              style={{ backgroundColor: accentColor }}
              onClick={() => openModifyDialog(bid)}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Modify Bid
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1" disabled>
              <Clock className="h-4 w-4 mr-2" />
              Expired
            </Button>
          )}
        </div>

          {/* Submit Document Button */}
          <div className="pt-2">
            <Button variant="secondary" size="sm" className="w-full">
              <Truck className="h-4 w-4 mr-2" />
              Submit Document
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bids by number, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="text-2xl font-bold">{activeBids.length}</div>
                      <div className="text-sm text-muted-foreground">Active Bids</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="text-2xl font-bold">{wonBids.length}</div>
                      <div className="text-sm text-muted-foreground">Bids Won</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="text-2xl font-bold">{lostBids.length}</div>
                      <div className="text-sm text-muted-foreground">Bids Lost</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="text-2xl font-bold">{bids.length}</div>
                      <div className="text-sm text-muted-foreground">Total Bids</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          variant={bidFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('all')}
        >
          All Bids ({bids.length})
        </Button>
        <Button
          variant={bidFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('active')}
        >
          Active ({activeBids.length})
        </Button>
        <Button
          variant={bidFilter === 'won' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('won')}
        >
          Won ({wonBids.length})
        </Button>
        <Button
          variant={bidFilter === 'lost' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('lost')}
        >
          Lost ({lostBids.length})
        </Button>
        <Button
          variant={bidFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('pending')}
        >
          Pending ({bids.filter((bid: Bid) => bid.bidStatus === 'pending').length})
        </Button>
        <Button
          variant={bidFilter === 'expired' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBidFilter('expired')}
        >
          Expired ({expiredBids.length})
        </Button>
      </div>

      {/* Bids List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {bidFilter === 'all' ? 'All Bids' : 
           bidFilter === 'active' ? 'Active Bids' : 
           bidFilter === 'won' ? 'Won Bids' :
           bidFilter === 'lost' ? 'Lost Bids' :
           bidFilter === 'pending' ? 'Pending Bids' : 'Expired Bids'} ({filteredBids.length})
        </h3>
        
        {filteredBids.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Bids Found</h3>
              <p className="text-muted-foreground">
                You don't have any bids at the moment. Start bidding on loads to see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredBids.map((bid: Bid) => (
              <BidCard key={bid.id} bid={bid} />
            ))}
          </div>
        )}
      </div>

      {/* Bid Details Dialog */}
      <Dialog open={!!viewDetailsBid} onOpenChange={() => setViewDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Details - #{viewDetailsBid?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {viewDetailsBid && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bid Number</label>
                  <p className="text-lg font-semibold">#{viewDetailsBid.bidNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Route</label>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const { origin, dest } = originDestFromStops(Array.isArray(viewDetailsBid.stops) ? viewDetailsBid.stops : JSON.parse(viewDetailsBid.stops || '[]'));
                      return `${origin || 'Unknown'} → ${dest || 'Unknown'}`;
                    })()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Distance</label>
                  <p className="text-lg font-semibold">{formatDistance(viewDetailsBid.distance)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stops</label>
                  <p className="text-lg font-semibold">{formatStopCount(Array.isArray(viewDetailsBid.stops) ? viewDetailsBid.stops : JSON.parse(viewDetailsBid.stops || '[]'))}</p>
                </div>
              </div>

              {/* Pickup & Delivery Times */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                  <p className="text-lg font-semibold">{formatPickupDateTime(viewDetailsBid.pickupDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                  <p className="text-lg font-semibold">{formatPickupDateTime(viewDetailsBid.deliveryDate)}</p>
                </div>
              </div>

              {/* Auction Status */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Auction Status</label>
                    <p className="text-lg font-semibold">
                      {viewDetailsBid.isExpired ? "Expired" : "Active"}
                    </p>
                  </div>
                  <Countdown 
                    expiresAt={viewDetailsBid.expiresAt} 
                    variant={viewDetailsBid.isExpired ? "expired" : viewDetailsBid.timeLeftSeconds <= 300 ? "urgent" : "default"}
                  />
                </div>
              </div>

              {/* Bid Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">My Bid</label>
                  <p className="text-lg font-semibold" style={{ color: accentColor }}>
                    ${Number(viewDetailsBid.myBid).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Bids</label>
                  <p className="text-lg font-semibold">{viewDetailsBid.bidCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bid Placed</label>
                  <p className="text-lg font-semibold">{formatPickupDateTime(viewDetailsBid.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State Tag</label>
                  <p className="text-lg font-semibold">{viewDetailsBid.tag || 'N/A'}</p>
                </div>
              </div>

              {/* Notes */}
              {viewDetailsBid.notes && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium text-muted-foreground">My Notes</label>
                  <p className="text-lg font-semibold">{viewDetailsBid.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setViewDetailsBid(null)}
                  className="flex-1"
                >
                  Close
                </Button>
                {!viewDetailsBid.isExpired && (
                  <Button
                    onClick={() => {
                      setViewDetailsBid(null);
                      // TODO: Open modify bid dialog
                    }}
                    style={{ backgroundColor: accentColor }}
                    className="flex-1"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Modify Bid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modify Bid Dialog */}
      <Dialog open={!!modifyBidDialog} onOpenChange={() => setModifyBidDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modify Bid - #{modifyBidDialog?.bidNumber}</DialogTitle>
          </DialogHeader>
          
          {modifyBidDialog && (
            <div className="space-y-6">
              {/* Bid Details */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {(() => {
                      const { origin, dest } = originDestFromStops(Array.isArray(modifyBidDialog.stops) ? modifyBidDialog.stops : JSON.parse(modifyBidDialog.stops || '[]'));
                      return `${origin || 'Unknown'} → ${dest || 'Unknown'}`;
                    })()}
                  </span>
                  <span className="text-xs text-muted-foreground">({modifyBidDialog.distance || 0} mi)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Pickup: {modifyBidDialog.pickupDate ? formatPickupDateTime(modifyBidDialog.pickupDate) : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Countdown 
                    expiresAt={modifyBidDialog.expiresAt} 
                    variant={modifyBidDialog.isExpired ? "expired" : modifyBidDialog.timeLeftSeconds <= 300 ? "urgent" : "default"}
                  />
                </div>
              </div>

              {/* Auction Info */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <label className="text-sm font-medium text-muted-foreground">Total Bids in Auction</label>
                  <p className="text-lg font-semibold">{modifyBidDialog.bidCount}</p>
                </div>
              </div>

              {/* Bid Form */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="bidAmount" className="block text-sm font-medium mb-2">
                    Bid Amount ($)
                  </label>
                  <Input
                    id="bidAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Enter your bid amount"
                    className="text-lg"
                  />
                </div>
                
                <div>
                  <label htmlFor="bidNotes" className="block text-sm font-medium mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="bidNotes"
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    placeholder="Add any notes about your bid..."
                    className="w-full p-3 border border-input rounded-md resize-none"
                    rows={3}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setModifyBidDialog(null)}
                  className="flex-1"
                  disabled={isModifying}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelBid}
                  disabled={isModifying}
                  className="flex-1"
                >
                  {isModifying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Bid
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleModifyBid}
                  disabled={isModifying}
                  style={{ backgroundColor: accentColor }}
                  className="flex-1"
                >
                  {isModifying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Update Bid
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
