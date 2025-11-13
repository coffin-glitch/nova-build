"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatPickupDateTime, formatStopCount } from "@/lib/format";
import {
  Archive,
  Calendar,
  Clock,
  Filter,
  MapPin,
  Navigation,
  RefreshCw,
  Truck
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ArchiveBid {
  id: number;
  bid_number: string;
  distance_miles: number;
  pickup_timestamp: string;
  delivery_timestamp: string;
  stops: string[];
  tag: string;
  source_channel: string;
  forwarded_to: string;
  received_at: string;
  archived_at: string;
  original_id: number;
  state_tag: string;
  bids_count: number;
  lowest_bid_amount: number;
  highest_bid_amount: number;
  avg_bid_amount: number;
  hours_active?: number;
}

// Helper function to safely parse stops data
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

export function AdminArchiveBidsClient() {
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [milesMin, setMilesMin] = useState("");
  const [milesMax, setMilesMax] = useState("");
  const [sortBy, setSortBy] = useState("archived_at");
  const [limit] = useState("100");
  const [offset, setOffset] = useState(0);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (date) queryParams.set("date", date);
  if (city) queryParams.set("city", city);
  if (state) queryParams.set("state", state);
  if (milesMin) queryParams.set("milesMin", milesMin);
  if (milesMax) queryParams.set("milesMax", milesMax);
  queryParams.set("sortBy", sortBy);
  queryParams.set("limit", limit);
  queryParams.set("offset", offset.toString());

  const { data, mutate, isLoading } = useSWR(
    `/api/archive-bids?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const archivedBids = data?.data || [];
  const pagination = data?.pagination || {};
  const dateRange = data?.dateRange || {};

  const handleRefresh = () => {
    mutate();
  };

  const handleClearFilters = () => {
    setDate("");
    setCity("");
    setState("");
    setMilesMin("");
    setMilesMax("");
    setSortBy("archived_at");
    setOffset(0);
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + parseInt(limit));
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="Filter by date"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Filter by city"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <Input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Filter by state"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Miles</label>
            <Input
              type="number"
              value={milesMin}
              onChange={(e) => setMilesMin(e.target.value)}
              placeholder="Min miles"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Miles</label>
            <Input
              type="number"
              value={milesMax}
              onChange={(e) => setMilesMax(e.target.value)}
              placeholder="Max miles"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archived_at">Archived Date</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="pickup">Pickup Time</SelectItem>
                <SelectItem value="state">State</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleClearFilters} variant="outline">
            Clear Filters
          </Button>
        </div>
      </Glass>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Archived</p>
                <p className="text-2xl font-bold">{pagination.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Date Range</p>
                <p className="text-sm font-medium">
                  {dateRange.earliest_date ? new Date(dateRange.earliest_date).toLocaleDateString() : 'N/A'} - 
                  {dateRange.latest_date ? new Date(dateRange.latest_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Showing</p>
                <p className="text-sm font-medium">
                  {archivedBids.length} of {pagination.total || 0} bids
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archived Bids List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading archived bids...</p>
          </div>
        ) : archivedBids.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Archived Bids Found</h3>
              <p className="text-muted-foreground">
                {Object.values({ date, city, state, milesMin, milesMax }).some(v => v) 
                  ? "Try adjusting your filters to see more results."
                  : "No bids have been archived yet."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {archivedBids.map((bid: ArchiveBid) => (
              <Glass key={bid.bid_number} className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {bid.bid_number}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {bid.state_tag || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(bid.archived_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Distance and Stops */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{bid.distance_miles || 0} miles</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span>{formatStopCount(parseStops(bid.stops))} stops</span>
                    </div>
                  </div>

                  {/* Stops Details */}
                  {parseStops(bid.stops).length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium mb-1">Route:</div>
                      <div className="space-y-1">
                        {parseStops(bid.stops).map((stop: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>{stop}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pickup and Delivery */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span>Pickup: {formatPickupDateTime(bid.pickup_timestamp)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="w-4 h-4 text-purple-500" />
                      <span>Delivery: {formatPickupDateTime(bid.delivery_timestamp)}</span>
                    </div>
                  </div>

                  {/* Bidding Info */}
                  <div className="pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Carrier Bids:</span>
                      <span className="font-medium">{bid.bids_count || 0}</span>
                    </div>
                    {bid.lowest_bid_amount && bid.lowest_bid_amount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Lowest Bid:</span>
                        <span className="font-medium text-green-600">{formatMoney(bid.lowest_bid_amount * 100)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Hours Active:</span>
                      <span className="font-medium">{bid.hours_active ? Math.round(bid.hours_active) : 0}h</span>
                    </div>
                  </div>
                </div>
              </Glass>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {pagination.hasMore && (
          <div className="text-center">
            <Button onClick={handleLoadMore} variant="outline" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
