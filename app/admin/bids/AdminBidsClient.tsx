"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { 
  FileText, 
  MapPin, 
  Clock, 
  Eye, 
  Users,
  Filter,
  Search,
  ToggleLeft,
  ToggleRight,
  Truck
} from "lucide-react";
import useSWR from "swr";
import { getActiveBids, getBidOffers } from "@/lib/actions";

interface TelegramBid {
  id: number;
  bid_number: string;
  distance_miles: number | null;
  pickup_timestamp: string | null;
  delivery_timestamp: string | null;
  stops: any;
  tag: string | null;
  source_channel: string;
  received_at: string;
  expires_at: string | null;
  raw_text?: string;
  forwarded_to?: string;
}

interface AdminBidsClientProps {
  initialBids: TelegramBid[];
  initialTags: string[];
}

export function AdminBidsClient({ initialBids, initialTags }: AdminBidsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [bidOffers, setBidOffers] = useState<any[]>([]);

  // Use SWR for real-time updates
  const { data: bids = initialBids } = useSWR(
    "admin-bids",
    getActiveBids,
    {
      refreshInterval: 10000, // 10 seconds
      fallbackData: initialBids,
    }
  );

  const filterBids = () => {
    let filtered = bids;

    // Filter by search term (bid number)
    if (searchTerm) {
      filtered = filtered.filter(bid =>
        bid.bid_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by tag (state)
    if (selectedTag !== "all") {
      filtered = filtered.filter(bid => bid.tag === selectedTag);
    }

    return filtered;
  };

  const filteredBids = filterBids();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatStops = (stops: any) => {
    if (!stops || typeof stops !== 'object') return "N/A";
    
    if (Array.isArray(stops)) {
      return stops.length;
    }
    
    return "N/A";
  };

  const formatStopsList = (stops: any) => {
    if (!stops || typeof stops !== 'object') return ["N/A"];
    
    if (Array.isArray(stops)) {
      return stops.map((stop: any) => 
        typeof stop === 'string' ? stop : 
        stop.city && stop.state ? `${stop.city}, ${stop.state}` :
        stop.address || "Unknown"
      );
    }
    
    return ["N/A"];
  };

  const getExpiresIn = (expiresAt: string | null) => {
    if (!expiresAt) return "N/A";
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffHours <= 0) return "Expired";
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.ceil(diffHours / 24);
    return `${diffDays}d`;
  };

  const handleViewDetails = async (bid: TelegramBid) => {
    setSelectedBid(bid);
    try {
      const offers = await getBidOffers(bid.id);
      setBidOffers(offers);
    } catch (error) {
      console.error("Error fetching bid offers:", error);
      setBidOffers([]);
    }
  };

  return (
    <>
      {/* Filter and Search */}
      <Card className="card-premium p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search bids by number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input-premium"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="input-premium">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {initialTags.filter(tag => tag && tag.trim() !== "").map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Bids Table */}
      <Card className="card-premium overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bid #</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Miles</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead>Offers</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Expires In</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-lg">No bids found</p>
                    <p className="text-muted-foreground text-sm">
                      {searchTerm || selectedTag !== "all" 
                        ? "Try adjusting your filters" 
                        : "Check back later for new bids"
                      }
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredBids.map((bid) => (
                <TableRow key={bid.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium">
                    <span className="text-primary">#{bid.bid_number}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>Route details</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {bid.tag && (
                      <Badge variant="secondary">{bid.tag}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {bid.distance_miles ? `${bid.distance_miles.toLocaleString()}` : "N/A"}
                  </TableCell>
                  <TableCell>
                    {formatDate(bid.pickup_timestamp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      {formatStops(bid.stops)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">0</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDate(bid.received_at)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getExpiresIn(bid.expires_at) === "Expired" ? "destructive" : "secondary"}
                    >
                      {getExpiresIn(bid.expires_at)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(bid)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Bid Details Drawer */}
      <Drawer open={!!selectedBid} onOpenChange={(open) => !open && setSelectedBid(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Bid #{selectedBid?.bid_number} Details</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 space-y-6">
            {selectedBid && (
              <>
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tag</label>
                    <p className="text-lg">{selectedBid.tag || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Miles</label>
                    <p className="text-lg">{selectedBid.distance_miles?.toLocaleString() || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Pickup</label>
                    <p className="text-lg">{formatDate(selectedBid.pickup_timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery</label>
                    <p className="text-lg">{formatDate(selectedBid.delivery_timestamp)}</p>
                  </div>
                </div>

                {/* Stops List */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stops ({formatStops(selectedBid.stops)})</label>
                  <div className="mt-2 space-y-2">
                    {formatStopsList(selectedBid.stops).map((stop, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{stop}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Info */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedBid.source_channel && selectedBid.source_channel !== '-1002560784901' && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Source Channel</label>
                      <p className="text-sm font-mono">{selectedBid.source_channel}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Forwarded To</label>
                    <p className="text-sm font-mono">{selectedBid.forwarded_to || "N/A"}</p>
                  </div>
                </div>

                {/* Carrier Offers */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Carrier Offers ({bidOffers.length})</label>
                  <div className="mt-2 space-y-2">
                    {bidOffers.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No offers yet</p>
                    ) : (
                      bidOffers.map((offer, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                          <div>
                            <span className="font-mono text-sm">{(offer.supabase_user_id || offer.user_id || '').slice(-8)}</span>
                            <span className="text-sm text-muted-foreground ml-2">${offer.amount_cents ? (offer.amount_cents / 100).toLocaleString() : '0'}</span>
                          </div>
                          <Badge variant="secondary">{offer.status || 'pending'}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Raw Text Preview */}
                {selectedBid.raw_text && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Raw Text Preview</label>
                    <div className="mt-2 p-4 bg-muted/30 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {selectedBid.raw_text.substring(0, 500)}
                        {selectedBid.raw_text.length > 500 && "..."}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}