"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { formatMoney, formatPickupDateTime } from "@/lib/format";
import {
  Archive,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Truck,
  DollarSign,
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3
} from "lucide-react";
import { useEffect, useState } from "react";

interface BidHistoryData {
  archivedBid: any;
  carrierBids: any[];
  auctionAward: any;
  bidStats: any;
  timelineEvents: any[];
}

interface BidHistoryModalProps {
  bidNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BidHistoryModal({ bidNumber, isOpen, onClose }: BidHistoryModalProps) {
  const [data, setData] = useState<BidHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bidNumber && isOpen) {
      fetchBidHistory();
    }
  }, [bidNumber, isOpen]);

  const fetchBidHistory = async () => {
    if (!bidNumber) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/archive-bids/details?bidNumber=${bidNumber}`);
      const result = await response.json();
      
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch bid history");
      }
    } catch (err) {
      setError("Failed to fetch bid history");
    } finally {
      setLoading(false);
    }
  };

  const parseStops = (stops: string | string[] | null): string[] => {
    if (!stops) return [];
    if (Array.isArray(stops)) return stops;
    if (typeof stops === 'string') {
      try {
        return JSON.parse(stops);
      } catch {
        return [stops];
      }
    }
    return [];
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Bid History: #{bidNumber}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-center py-4">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Bid Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Load Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Route:</span>
                    <div className="font-medium">
                      {parseStops(data.archivedBid.stops).join(' → ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Distance:</span>
                    <div className="font-medium">{data.archivedBid.distance_miles} miles</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Pickup:</span>
                    <div className="font-medium">
                      {formatPickupDateTime(data.archivedBid.pickup_timestamp)}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Delivery:</span>
                    <div className="font-medium">
                      {formatPickupDateTime(data.archivedBid.delivery_timestamp)}
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Received:</span>
                      <div className="font-medium">
                        {new Date(data.archivedBid.received_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Archived:</span>
                      <div className="font-medium">
                        {new Date(data.archivedBid.archived_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bid Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Bid Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.bidStats.total_bids || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Bids</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.bidStats.unique_carriers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Unique Carriers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatMoney(data.bidStats.lowest_bid_cents || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Lowest Bid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {formatMoney(data.bidStats.highest_bid_cents || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Highest Bid</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Carrier Bids */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Carrier Bids ({data.carrierBids.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.carrierBids.map((bid, index) => (
                    <Glass key={bid.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {bid.carrier_name || 'Unknown Carrier'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              MC: {bid.mc_number || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatMoney(bid.amount_cents)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(bid.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {bid.notes && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <strong>Notes:</strong> {bid.notes}
                        </div>
                      )}
                    </Glass>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Auction Award */}
            {data.auctionAward && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    Auction Award
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Glass className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {data.auctionAward.winner_name || 'Unknown Winner'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          MC: {data.auctionAward.winner_mc_number || 'N/A'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatMoney(data.auctionAward.winner_amount_cents)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Awarded: {new Date(data.auctionAward.awarded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </Glass>
                </CardContent>
              </Card>
            )}

            {/* Timeline Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.timelineEvents.map((event, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium">{event.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(event.event_time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

