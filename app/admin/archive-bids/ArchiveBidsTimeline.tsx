"use client";

import { ArchiveBidCard } from "@/components/archive/ArchiveBidCard";
import { BidHistoryModal } from "@/components/archive/BidHistoryModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Archive,
    Calendar,
    Eye,
    Filter,
    Navigation,
    RefreshCw
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
}

interface ArchiveStats {
  total_bids: number;
  archive_days: number;
  earliest_date: string;
  latest_date: string;
  avg_distance: number;
  min_distance: number;
  max_distance: number;
  unique_states: number;
  unique_tags: number;
}

interface DailyActivity {
  archive_date: string;
  bids_archived: number;
  first_archive_time: string;
  last_archive_time: string;
}

export function ArchiveBidsTimeline() {
  const [bidNumber, setBidNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [city, setCity] = useState("");
  const [tag, setTag] = useState("");
  const [milesMin, setMilesMin] = useState("");
  const [milesMax, setMilesMax] = useState("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [sortBy, setSortBy] = useState("archived_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [limit, setLimit] = useState("100");
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"timeline" | "grid" | "analytics">("timeline");
  const [selectedBidNumber, setSelectedBidNumber] = useState<string | null>(null);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [selectedBid, setSelectedBid] = useState<ArchiveBid | null>(null);
  const [showBidDetails, setShowBidDetails] = useState(false);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (bidNumber) queryParams.set("bidNumber", bidNumber);
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (city) queryParams.set("city", city);
  if (tag) queryParams.set("tag", tag);
  if (milesMin) queryParams.set("milesMin", milesMin);
  if (milesMax) queryParams.set("milesMax", milesMax);
  if (sourceChannel) queryParams.set("sourceChannel", sourceChannel);
  queryParams.set("sortBy", sortBy);
  queryParams.set("sortOrder", sortOrder);
  queryParams.set("limit", limit);
  queryParams.set("offset", offset.toString());

  const { data, mutate, isLoading } = useSWR(
    `/api/archive-bids/history?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const archivedBids: ArchiveBid[] = data?.data || [];
  const pagination = data?.pagination || {};
  const statistics: ArchiveStats = data?.statistics || {};
  const dailyActivity: DailyActivity[] = data?.dailyActivity || [];

  const handleRefresh = () => {
    mutate();
    setOffset(0); // Reset pagination when refreshing
  };

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [autoArchivingEnabled, setAutoArchivingEnabled] = useState(false);

  const handleEndOfDayArchive = async () => {
    setShowArchiveDialog(true);
  };

  const handleArchiveForDate = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    
    try {
      const response = await fetch('/api/archive-bids/end-of-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate })
      });
      const result = await response.json();
      if (result.ok) {
        toast.success(`Archived ${result.updated} bids for ${selectedDate}`);
        mutate(); // Refresh data
        setShowArchiveDialog(false);
        setSelectedDate("");
      } else {
        toast.error('Failed to archive bids');
      }
    } catch (error) {
      toast.error('Failed to archive bids');
    }
  };

  const handleToggleAutoArchiving = async () => {
    try {
      const response = await fetch('/api/archive-bids/toggle-auto-archiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !autoArchivingEnabled })
      });
      const result = await response.json();
      if (result.ok) {
        setAutoArchivingEnabled(!autoArchivingEnabled);
        toast.success(`Auto-archiving ${!autoArchivingEnabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to toggle auto-archiving');
      }
    } catch (error) {
      toast.error('Failed to toggle auto-archiving');
    }
  };

  // Fetch auto-archiving status on mount
  useEffect(() => {
    const fetchAutoArchivingStatus = async () => {
      try {
        const response = await fetch('/api/archive-bids/auto-archiving-status');
        const result = await response.json();
        if (result.ok) {
          setAutoArchivingEnabled(result.enabled);
        }
      } catch (error) {
        console.error('Failed to fetch auto-archiving status:', error);
      }
    };
    fetchAutoArchivingStatus();
  }, []);

  const handleClearFilters = () => {
    setBidNumber("");
    setDateFrom("");
    setDateTo("");
    setCity("");
    setTag("");
    setMilesMin("");
    setMilesMax("");
    setSourceChannel("");
    setSortBy("archived_at");
    setSortOrder("desc");
    setOffset(0);
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + parseInt(limit));
  };

  const handleViewDetails = (bid: ArchiveBid) => {
    setSelectedBid(bid);
    setShowBidDetails(true);
  };

  const handleViewHistory = (bid: ArchiveBid) => {
    setSelectedBidNumber(bid.bid_number);
    setShowBidHistory(true);
  };

  const handleCloseModal = () => {
    setSelectedBidNumber(null);
    setShowBidHistory(false);
  };

  const handleCloseDetails = () => {
    setSelectedBid(null);
    setShowBidDetails(false);
  };

  // Helper functions
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

  const formatDistance = (miles: number) => {
    if (!miles) return "N/A";
    return `${miles.toLocaleString()} mi`;
  };

  const formatStopCount = (stops: string[]) => {
    if (!stops || stops.length === 0) return "No stops";
    if (stops.length === 1) return "Direct";
    return `${stops.length} stops`;
  };

  const formatDateTime = (timestamp: string) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const formatStopsDetailed = (stops: string[]) => {
    if (!stops || stops.length === 0) return [];
    return stops;
  };

  // Group bids by local date for timeline view (using archived_at or received_at)
  const bidsByDate = useMemo(() => {
    const grouped: { [key: string]: ArchiveBid[] } = {};
    archivedBids.forEach(bid => {
      // Use archived_at if available, otherwise received_at
      const dateToUse = bid.archived_at || bid.received_at;
      const date = new Date(dateToUse);
      
      // Get date in user's local timezone
      const localDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      if (!grouped[localDate]) {
        grouped[localDate] = [];
      }
      grouped[localDate].push(bid);
    });
    return grouped;
  }, [archivedBids]);

  return (
    <div className="space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Archive Bids Timeline</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive view of all archived bids with parsing history and analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeline">Timeline View</SelectItem>
              <SelectItem value="grid">Grid View</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleEndOfDayArchive} variant="default">
            <Archive className="w-4 h-4 mr-2" />
            Archive End of Day
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Archived</p>
                <p className="text-2xl font-bold">{statistics.total_bids?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Archive Days</p>
                <p className="text-2xl font-bold">{statistics.archive_days || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Distance</p>
                <p className="text-2xl font-bold">{Math.round(statistics.avg_distance || 0)} mi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Filters */}
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Advanced Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bid Number</label>
            <Input
              value={bidNumber}
              onChange={(e) => setBidNumber(e.target.value)}
              placeholder="Search by bid number"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Date From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Date To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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
            <label className="text-sm font-medium">State Tag</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Filter by state tag"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Miles</label>
            <Input
              type="number"
              value={milesMin}
              onChange={(e) => setMilesMin(e.target.value)}
              placeholder="Min"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Miles</label>
            <Input
              type="number"
              value={milesMax}
              onChange={(e) => setMilesMax(e.target.value)}
              placeholder="Max"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archived_at">Archive Date</SelectItem>
                <SelectItem value="received_at">Received Date</SelectItem>
                <SelectItem value="distance_miles">Distance</SelectItem>
                <SelectItem value="bids_count">Bid Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort Order</label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleClearFilters} variant="outline">
            Clear Filters
          </Button>
          <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </Glass>

      {/* Content based on view mode */}
      {viewMode === "timeline" && (
        <div className="space-y-6">
          {Object.entries(bidsByDate).map(([date, bids]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-semibold">
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                  })}
                </h3>
                <Badge variant="secondary">{bids.length} bids</Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {bids.map((bid) => (
                  <ArchiveBidCard
                    key={bid.bid_number}
                    bid={bid}
                    onViewDetails={handleViewDetails}
                    onViewHistory={handleViewHistory}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {archivedBids.map((bid) => (
            <ArchiveBidCard
              key={bid.bid_number}
              bid={bid}
              onViewDetails={handleViewDetails}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}

      {viewMode === "analytics" && (
        <div className="space-y-6">
          <Glass className="p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Archive Activity</h3>
            <div className="space-y-4">
              {dailyActivity.map((day) => (
                <div key={day.archive_date} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="font-medium">
                      {new Date(day.archive_date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {day.first_archive_time} - {day.last_archive_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{day.bids_archived} bids</p>
                    <p className="text-sm text-muted-foreground">
                      Avg: {Math.round(day.avg_hours_active)}h active
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      )}

      {/* Load More Button */}
      {pagination.hasMore && (
        <div className="text-center">
          <Button onClick={handleLoadMore} variant="outline" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Load More ({pagination.total - (offset + parseInt(limit))} remaining)
          </Button>
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
                  <p className="text-lg font-semibold">{formatStopCount(parseStops(selectedBid.stops))}</p>
                </div>
              </div>

              {/* Pickup & Delivery Times */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                  <p className="text-lg font-semibold">{formatDateTime(selectedBid.pickup_timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                  <p className="text-lg font-semibold">{formatDateTime(selectedBid.delivery_timestamp)}</p>
                </div>
              </div>

              {/* Detailed Stops */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Route Details</h3>
                <div className="space-y-2">
                  {formatStopsDetailed(parseStops(selectedBid.stops)).map((stop, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{stop}</p>
                        <p className="text-sm text-muted-foreground">
                          {index === 0 ? 'Pickup Location' :
                           index === formatStopsDetailed(parseStops(selectedBid.stops)).length - 1 ? 'Delivery Location' :
                           'Stop Location'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Archive Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Archive Information</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Received At</label>
                    <p className="text-lg font-semibold">{formatDateTime(selectedBid.received_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Archived At</label>
                    <p className="text-lg font-semibold">{formatDateTime(selectedBid.archived_at)}</p>
                  </div>
                </div>
              </div>

              {/* Bidding Information (if available) */}
              {selectedBid.bids_count !== undefined && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Auction Information</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Bids</label>
                      <p className="text-lg font-semibold">{selectedBid.bids_count || 0}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-lg font-semibold">Auction Closed</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Source Information</h3>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Source Channel</label>
                      <p className="text-lg font-semibold">{selectedBid.source_channel || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Forwarded To</label>
                      <p className="text-lg font-semibold">{selectedBid.forwarded_to || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCloseDetails}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handleCloseDetails();
                    handleViewHistory(selectedBid);
                  }}
                >
                  View Bid History
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bid History Modal */}
      <BidHistoryModal
        bidNumber={selectedBidNumber}
        isOpen={showBidHistory}
        onClose={handleCloseModal}
      />

      {/* Archive End of Day Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archive Bids for Date
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Date to Archive
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                placeholder="Select a date"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This will set archived_at to match received_at date for all bids from this date
              </p>
            </div>

            {/* Auto-Archiving Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div>
                <label className="text-sm font-medium">
                  Automatic End-of-Day Archiving
                </label>
                <p className="text-xs text-muted-foreground">
                  Runs automatically at 23:59:59 daily via cron job
                </p>
              </div>
              <Button
                variant={autoArchivingEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleToggleAutoArchiving}
              >
                {autoArchivingEnabled ? "ON" : "OFF"}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveDialog(false);
                  setSelectedDate("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleArchiveForDate}
                disabled={!selectedDate}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Bids
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}