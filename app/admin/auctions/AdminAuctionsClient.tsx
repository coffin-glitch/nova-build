"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatMoney, formatStops, formatTimeOnly } from "@/lib/format";
import {
    Award,
    Clock,
    DollarSign,
    Gavel,
    MapPin,
    RefreshCw,
    Search,
    Truck,
    Users
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AdminAuctionsClientProps {
  // Remove initialBids prop since we're not using server-side data fetching
}

export default function AdminAuctionsClient({}: AdminAuctionsClientProps) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [bidDetails, setBidDetails] = useState<Array<{
    id: number;
    amount_cents: number;
    notes: string | null;
    created_at: string;
    clerk_user_id: string;
    carrier_legal_name?: string;
    carrier_mc_number?: string;
  }>>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=100&isAdmin=true`,
    fetcher,
    { 
      refreshInterval: 10000
    }
  );

  const bids = data?.data || [];

  const handleViewBids = async (bid: TelegramBid) => {
    setSelectedBid(bid);
    setLoadingDetails(true);
    
    try {
      const response = await fetch(`/api/bids/${bid.bid_number}`);
      if (response.ok) {
        const data = await response.json();
        setBidDetails(data.bids || []);
      }
    } catch (error) {
      toast.error("Failed to load bid details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAwardBid = async (bidNumber: string, winnerUserId: string) => {
    try {
      const response = await fetch(`/api/admin/bids/${bidNumber}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerUserId }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Auction awarded successfully!");
        setSelectedBid(null);
        mutate(); // Refresh data
      } else {
        toast.error(result.error || "Failed to award auction");
      }
    } catch (error) {
      toast.error("Failed to award auction");
    }
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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by Bid #..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              placeholder="State tag (e.g. GA)"
            />
          </div>
          <Button
            onClick={() => mutate()}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </Glass>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Gavel className="w-5 h-5 text-primary" />
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
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Bids</p>
              <p className="text-2xl font-bold text-foreground">
                {bids.reduce((sum: number, b: TelegramBid) => sum + (b.bids_count || 0), 0)}
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
                ${bids.reduce((sum: number, b: TelegramBid) => sum + (b.lowest_amount_cents || 0), 0) / 100}
              </p>
            </div>
          </div>
        </Glass>
      </div>

      {/* Auctions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Live Auctions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bid #</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Bids</TableHead>
                <TableHead>Lowest Bid</TableHead>
                <TableHead>Time Left</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBids.map((bid: TelegramBid) => (
                <TableRow key={bid.bid_number}>
                  <TableCell className="font-medium">#{bid.bid_number}</TableCell>
                  <TableCell>
                    {bid.tag && <Badge variant="secondary">{bid.tag}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatStops(bid.stops)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{formatDistance(bid.distance_miles)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{bid.bids_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {bid.lowest_amount_cents > 0 ? (
                      <span className="text-primary font-medium">
                        {formatMoney(bid.lowest_amount_cents)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No bids</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Countdown 
                      expiresAt={bid.expires_at_25} 
                      variant={bid.is_expired ? "expired" : bid.time_left_seconds <= 300 ? "urgent" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={bid.is_expired ? "destructive" : "default"}>
                      {bid.is_expired ? "Expired" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewBids(bid)}
                      >
                        View Bids
                      </Button>
                      {!bid.is_expired && bid.bids_count > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleViewBids(bid)}
                        >
                          <Award className="w-4 h-4 mr-1" />
                          Award
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bid Details Dialog */}
      <Dialog open={!!selectedBid} onOpenChange={() => setSelectedBid(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bid Details - #{selectedBid?.bid_number}</DialogTitle>
          </DialogHeader>
          
          {selectedBid && (
            <div className="space-y-6">
              {/* Auction Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
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
              </div>

              {/* Bids Table */}
              {loadingDetails ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading bid details...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">All Bids ({bidDetails.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carrier</TableHead>
                        <TableHead>MC/DOT</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Placed At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bidDetails
                        .sort((a, b) => a.amount_cents - b.amount_cents)
                        .map((bid, index: number) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            {bid.carrier_legal_name || "Unknown Carrier"}
                          </TableCell>
                          <TableCell>
                            {bid.carrier_mc_number || "N/A"}
                          </TableCell>
                          <TableCell>
                            <span className="text-primary font-medium">
                              {formatMoney(bid.amount_cents)}
                            </span>
                            {index === 0 && (
                              <Badge variant="secondary" className="ml-2">Lowest</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {bid.notes || "No notes"}
                          </TableCell>
                          <TableCell>
                            {new Date(bid.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleAwardBid(selectedBid.bid_number, bid.clerk_user_id)}
                            >
                              <Award className="w-4 h-4 mr-1" />
                              Award
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}