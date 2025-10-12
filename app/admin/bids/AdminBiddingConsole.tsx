"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { useAccentColor } from "@/hooks/useAccentColor";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatMoney, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
    Archive,
    BarChart3,
    Clock,
    Eye,
    MapPin,
    RefreshCw,
    Search,
    Trash2,
    Truck
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function AdminBiddingConsole() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [showBidDetails, setShowBidDetails] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { accentColor } = useAccentColor();

  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=true&isAdmin=true`,
    fetcher,
    {
      refreshInterval: 5000,
      fallbackData: { ok: true, data: [] }
    }
  );

  const bids = data?.data || [];

  // Filter bids
  const filteredBids = bids.filter((bid: TelegramBid) => {
    if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
    if (tag && !bid.tag?.toLowerCase().includes(tag.toLowerCase())) return false;
    if (statusFilter === 'active' && bid.is_expired) return false;
    if (statusFilter === 'expired' && !bid.is_expired) return false;
    return true;
  });

  // Analytics calculations
  const analytics = {
    totalBids: bids.length,
    activeBids: bids.filter((b: TelegramBid) => !b.is_expired).length,
    expiredBids: bids.filter((b: TelegramBid) => b.is_expired).length,
    totalCarrierBids: bids.reduce((sum: number, b: TelegramBid) => sum + (b.bids_count || 0), 0)
  };

  const handleArchiveBid = async (bidNumber: string) => {
    try {
      const response = await fetch('/api/archive-bids', { method: 'GET' });
      if (response.ok) {
        toast.success(`Bid ${bidNumber} archived successfully`);
        mutate();
      } else {
        toast.error('Failed to archive bid');
      }
    } catch (error) {
      toast.error('Failed to archive bid');
    }
  };

  const handleDeleteBid = async (bidNumber: string) => {
    if (!confirm(`Are you sure you want to delete bid ${bidNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/bids/${encodeURIComponent(bidNumber)}`, { 
        method: 'DELETE' 
      });
      if (response.ok) {
        toast.success(`Bid ${bidNumber} deleted successfully`);
        mutate();
      } else {
        toast.error('Failed to delete bid');
      }
    } catch (error) {
      toast.error('Failed to delete bid');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Bidding Console</h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive bid management and analytics dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Button>
              <Button
                onClick={() => mutate()}
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Analytics Dashboard */}
        {showAnalytics && (
          <Glass className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Auctions</p>
                      <p className="text-2xl font-bold">{analytics.totalBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-green-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold">{analytics.activeBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-purple-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bids</p>
                      <p className="text-2xl font-bold">{analytics.totalCarrierBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-red-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expired</p>
                      <p className="text-2xl font-bold">{analytics.expiredBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Glass>
        )}

        {/* Filters and Controls */}
        <Glass className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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

            {/* Tag Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">State/Tag</label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                placeholder="State tag (e.g. GA)"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              <select
                className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'expired')}
              >
                <option value="all">All Bids</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
              </select>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Stats</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {analytics.activeBids} Active
                </Badge>
                <Badge variant="outline">
                  {analytics.expiredBids} Expired
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredBids.length} of {bids.length} bids
            </div>
          </div>
        </Glass>

        {/* Bids Display */}
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
            <h3 className="text-xl font-semibold text-foreground mb-2">No Bids Found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or check back later.</p>
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
                    {bid.is_expired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="default" style={{ backgroundColor: accentColor }}>
                        Active
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
                    <span className="text-sm">{formatStops(JSON.parse(bid.stops || '[]'))}</span>
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
                    <div className="w-4 h-4 bg-muted-foreground rounded"></div>
                    <span className="text-sm">{formatStopCount(JSON.parse(bid.stops || '[]'))}</span>
                  </div>
                </div>

                {/* Bidding Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Carrier Bids:</span>
                    <span className="font-medium">{bid.bids_count || 0}</span>
                  </div>
                  {bid.lowest_amount_cents > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lowest Bid:</span>
                      <span className="font-medium text-green-600">{formatMoney(bid.lowest_amount_cents)}</span>
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
                        onClick={() => {
                          setSelectedBid(bid);
                          setShowBidDetails(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveBid(bid.bid_number)}
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archive
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBid(bid.bid_number)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Glass>
            ))}
          </div>
        )}

        {/* Bid Details Dialog */}
        <Dialog open={showBidDetails} onOpenChange={setShowBidDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Bid Details - #{selectedBid?.bid_number}
              </DialogTitle>
            </DialogHeader>

            {selectedBid && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Bid Number</label>
                    <p className="text-lg font-semibold">#{selectedBid.bid_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Equipment Type</label>
                    <p className="text-lg font-semibold">{selectedBid.tag || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Distance</label>
                    <p className="text-lg font-semibold">{formatDistance(selectedBid.distance_miles)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stops</label>
                    <p className="text-lg font-semibold">{formatStopCount(JSON.parse(selectedBid.stops || '[]'))}</p>
                  </div>
                </div>

                {/* Pickup & Delivery Times */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                    <p className="text-lg font-semibold">Pickup: {formatPickupDateTime(selectedBid.pickup_timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                    <p className="text-lg font-semibold">Delivery: {formatPickupDateTime(selectedBid.delivery_timestamp)}</p>
                  </div>
                </div>

                {/* Detailed Stops */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Route Details</h3>
                  <div className="space-y-2">
                    {formatStopsDetailed(JSON.parse(selectedBid.stops || '[]')).map((stop, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{stop}</p>
                          <p className="text-sm text-muted-foreground">
                            {index === 0 ? 'Pickup Location' :
                             index === formatStopsDetailed(JSON.parse(selectedBid.stops || '[]')).length - 1 ? 'Delivery Location' :
                             'Stop Location'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bidding Information */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Auction Information</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Current Bids</label>
                      <p className="text-lg font-semibold">{selectedBid.bids_count || 0}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-lg font-semibold">
                        {selectedBid.is_expired ? 'Auction Closed' : 'Bidding Open'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Time Remaining</label>
                      <div className="flex items-center gap-2">
                        <Countdown
                          expiresAt={selectedBid.expires_at_25}
                          variant={selectedBid.is_expired ? "expired" : selectedBid.time_left_seconds <= 300 ? "urgent" : "default"}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Lowest Bid</label>
                      <p className="text-lg font-semibold text-green-600">
                        {selectedBid.lowest_amount_cents > 0 ? formatMoney(selectedBid.lowest_amount_cents) : 'No bids yet'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Source Information */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Source Information</h3>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Received At</label>
                      <p className="text-lg font-semibold">{formatPickupDateTime(selectedBid.received_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowBidDetails(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleArchiveBid(selectedBid.bid_number)}
                    className="flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Bid
                  </Button>
                  <Button
                    onClick={() => handleDeleteBid(selectedBid.bid_number)}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Bid
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}