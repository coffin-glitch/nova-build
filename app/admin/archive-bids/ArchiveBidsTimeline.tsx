"use client";

import { ArchiveBidCard } from "@/components/archive/ArchiveBidCard";
import { ArchiveBidCompactCard } from "@/components/archive/ArchiveBidCompactCard";
import { ArchiveDateRangeCalendar } from "@/components/archive/ArchiveDateRangeCalendar";
import { BidHistoryModal } from "@/components/archive/BidHistoryModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import { formatStopsDetailed, ParsedAddress, formatStopCount } from "@/lib/format";
import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
  Grid3x3,
  Navigation,
  RefreshCw
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  avg_hours_active?: number;
}

export function ArchiveBidsTimeline() {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
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
  // Load limit from localStorage or default to 50
  const [limit, setLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('archive_bids_limit');
      return saved || "50";
    }
    return "50";
  });
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"timeline" | "grid" | "analytics">("grid");
  const [selectedBidNumber, setSelectedBidNumber] = useState<string | null>(null);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [selectedBid, setSelectedBid] = useState<ArchiveBid | null>(null);
  const [showBidDetails, setShowBidDetails] = useState(false);
  
  // Accumulate bids for infinite scroll
  const [allBids, setAllBids] = useState<ArchiveBid[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Grid layout controls
  const [gridColumns, setGridColumns] = useState(3);
  
  // Smart color handling for button text based on background color
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

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

  // Debug: Log when data changes
  useEffect(() => {
    console.log('ArchiveBidsTimeline - Data loaded:', {
      archivedBidsCount: archivedBids.length,
      allBidsCount: allBids.length,
      pagination,
      isLoading,
      isLoadingMore
    });
  }, [archivedBids.length, allBids.length, pagination, isLoading, isLoadingMore]);

  // Track if we've reached the end (got 0 bids in last response)
  const [reachedEnd, setReachedEnd] = useState(false);

  // Accumulate bids when new data arrives
  useEffect(() => {
    // Only process if we're not in the middle of a filter change
    if (isLoading && offset === 0) {
      // Initial load in progress, don't process yet
      return;
    }

    if (archivedBids.length > 0) {
      setReachedEnd(false); // Reset end flag when we get data
      if (offset === 0) {
        // Reset when filters change or initial load
        setAllBids(archivedBids);
        console.log('Reset allBids with', archivedBids.length, 'bids (limit:', limit, ')');
      } else {
        // Append new bids, avoiding duplicates
        setAllBids(prev => {
          const existingIds = new Set(prev.map(b => b.bid_number));
          const newBids = archivedBids.filter(b => !existingIds.has(b.bid_number));
          const updated = [...prev, ...newBids];
          console.log('Appended', newBids.length, 'new bids. Total:', updated.length, '(limit:', limit, ')');
          return updated;
        });
      }
      setIsLoadingMore(false);
    } else if (!isLoading) {
      // No more data - reached the end
      setIsLoadingMore(false);
      if (offset === 0 && allBids.length === 0) {
        console.log('No archived bids found for current filters');
      } else if (offset > 0) {
        console.log('Reached end of archived bids - no more data (limit:', limit, ')');
        setReachedEnd(true);
      }
    }
  }, [archivedBids, offset, isLoading, limit]);

  // Reset accumulated bids when filters or limit change
  useEffect(() => {
    console.log('Filters or limit changed, resetting bids. New limit:', limit);
    setAllBids([]);
    setOffset(0);
    setReachedEnd(false); // Reset end flag when filters change
    setIsLoadingMore(false); // Reset loading state
    // Note: SWR will automatically refetch when queryParams change (which includes limit)
  }, [bidNumber, dateFrom, dateTo, city, tag, milesMin, milesMax, sourceChannel, sortBy, sortOrder, limit]);

  const handleRefresh = () => {
    console.log('Refreshing archive bids view...');
    // Reset all state
    setAllBids([]);
    setOffset(0);
    setReachedEnd(false);
    setIsLoadingMore(false);
    
    // Force a fresh fetch by invalidating cache and revalidating
    mutate(undefined, {
      revalidate: true,
      rollbackOnError: false
    });
    
    toast.success('Refreshing archived bids...');
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
    } catch {
      toast.error('Failed to archive bids');
    }
  };

  const handleResetArchivedAt = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    
    try {
      const response = await fetch('/api/archive-bids/reset-archived-at', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate })
      });
      const result = await response.json();
      if (result.ok) {
        toast.success(`Reset archived_at and is_archived for ${result.updated} bids from ${selectedDate}`);
        mutate(); // Refresh data
        setSelectedDate(""); // Clear date picker
      } else {
        toast.error('Failed to reset archived_at');
      }
    } catch {
      toast.error('Failed to reset archived_at');
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
    } catch {
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

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) {
      console.log('Already loading more, skipping (limit:', limit, ')');
      return;
    }
    
    if (isLoading) {
      console.log('Initial load in progress, skipping (limit:', limit, ')');
      return;
    }
    
    const hasDateFilters = dateFrom || dateTo;
    const limitNum = parseInt(limit);
    
    // If we have date filters, only load if pagination says there's more
    if (hasDateFilters) {
      if (pagination.hasMore) {
        console.log('Loading more with date filters, offset:', offset, 'limit:', limitNum);
        setIsLoadingMore(true);
        setOffset(prev => prev + limitNum);
      } else {
        console.log('No more data available (date filters set, limit:', limitNum, ')');
      }
      return;
    }
    
    // If no date filters, continue loading (endless scroll)
    // Only stop if we've reached the end (got 0 bids in last response)
    if (reachedEnd) {
      console.log('Reached end of all archived bids (limit:', limitNum, ')');
      return;
    }
    
    console.log('Loading more (endless scroll), offset:', offset, 'limit:', limitNum);
    setIsLoadingMore(true);
    setOffset(prev => prev + limitNum);
  }, [isLoadingMore, isLoading, pagination.hasMore, limit, dateFrom, dateTo, offset, reachedEnd]);

  // Use custom infinite scroll hook - works for all views
  const { sentinelRef, setContainerRef } = useInfiniteScroll({
    hasMore: pagination.hasMore || (!dateFrom && !dateTo && !reachedEnd),
    isLoading,
    isLoadingMore,
    onLoadMore: handleLoadMore,
    threshold: 0.1,
    rootMargin: '200px', // Start loading 200px before reaching the sentinel
    enabled: true, // Enable for all views (timeline, grid, analytics)
  });
  
  // Set container ref when scroll container is available
  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerRef(scrollContainerRef.current);
    }
  }, [setContainerRef, viewMode]);

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

  // Use formatStopsDetailed from lib/format (returns ParsedAddress[])

  // Create a map of date to total bids count from dailyActivity
  // Format dates exactly the same way as bidsByDate for perfect matching
  const dateTotalCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    
    if (dailyActivity && dailyActivity.length > 0) {
      dailyActivity.forEach(day => {
        try {
          // archive_date comes as YYYY-MM-DD string from database (DATE type)
          const archiveDate = String(day.archive_date);
          
          // Parse the date - ensure we're in CDT timezone
          // Use noon to avoid timezone boundary issues
          const dateObj = new Date(archiveDate + 'T12:00:00');
          
          // Format to MM/DD/YYYY in CDT timezone - MUST match bidsByDate format exactly
          const dateStr = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'America/Chicago'
          });
          
          counts[dateStr] = day.bids_archived || 0;
        } catch (error) {
          console.error('Error parsing archive_date:', day.archive_date, error);
        }
      });
      
      // Debug: Log the counts for troubleshooting
      console.log('dateTotalCounts created:', counts);
    } else {
      console.warn('dailyActivity is empty or undefined');
    }
    
    return counts;
  }, [dailyActivity]);

  // Group bids by CDT date for timeline view (using archived_at)
  // Also count total archived bids per day from database
  const bidsByDate = useMemo(() => {
    const grouped: { [key: string]: ArchiveBid[] } = {};
    const dateTotals: { [key: string]: number } = {};
    
    allBids.forEach(bid => {
      // Use archived_at (required for archived bids)
      if (!bid.archived_at) return;
      
      const date = new Date(bid.archived_at);
      
      // Get date in CDT timezone - format as MM/DD/YYYY
      const localDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Chicago'
      });
      
      if (!grouped[localDate]) {
        grouped[localDate] = [];
      }
      grouped[localDate].push(bid);
    });
    
    // For each date, get the total from dateTotalCounts only
    // Don't use pagination.total as it's the total across all days
    Object.keys(grouped).forEach(date => {
      const total = dateTotalCounts[date];
      if (total !== undefined && total !== null) {
        dateTotals[date] = total;
      } else {
        // If not found in dateTotalCounts, just use the loaded count for that day
        dateTotals[date] = grouped[date].length;
        console.log(`Date "${date}" not found in dateTotalCounts. Using loaded count: ${grouped[date].length}`);
        console.log('Available dateTotalCounts keys:', Object.keys(dateTotalCounts));
      }
    });
    
    return { grouped, dateTotals };
  }, [allBids, dateTotalCounts]);

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
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Bids per load:</label>
            <Select 
              value={limit} 
              onValueChange={(value) => {
                setLimit(value);
                // Save to localStorage
                if (typeof window !== 'undefined') {
                  localStorage.setItem('archive_bids_limit', value);
                }
                // Reset and refresh
                setAllBids([]);
                setOffset(0);
                setReachedEnd(false);
                setIsLoadingMore(false);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000].map(num => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={viewMode} onValueChange={(value: "timeline" | "grid" | "analytics") => setViewMode(value)}>
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
          <Button 
            onClick={handleEndOfDayArchive} 
            variant="default"
            style={{ backgroundColor: accentColor, color: getButtonTextColor() }}
          >
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

      {/* Calendar Date Range Picker */}
      <ArchiveDateRangeCalendar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(date) => {
          setDateFrom(date);
          setAllBids([]);
          setOffset(0);
        }}
        onDateToChange={(date) => {
          setDateTo(date);
          setAllBids([]);
          setOffset(0);
        }}
        onClear={() => {
          setDateFrom("");
          setDateTo("");
          setAllBids([]);
          setOffset(0);
        }}
        accentColor={accentColor}
      />

      {/* Filters */}
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Advanced Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bid Number</label>
            <Input
              value={bidNumber}
              onChange={(e) => setBidNumber(e.target.value)}
              placeholder="Search by bid number"
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
        <div className="relative">
          <div
            ref={scrollContainerRef}
            className="h-[calc(100vh-300px)] min-h-[400px] md:min-h-[600px] lg:min-h-[800px] overflow-y-auto overflow-x-hidden pr-6"
            style={{
              scrollbarWidth: 'thin',
            }}
          >
            {isLoading && allBids.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading archived bids...</p>
              </div>
            ) : Object.keys(bidsByDate.grouped).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Archived Bids Found</h3>
                  <p className="text-muted-foreground">
                    {Object.values({ bidNumber, dateFrom, dateTo, city, tag, milesMin, milesMax }).some(v => v) 
                      ? "Try adjusting your filters to see more results."
                      : "No bids have been archived yet."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="relative pb-8 pr-4">
                {/* Timeline line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/20 via-primary/30 to-primary/20" />
                
                <div className="space-y-12 pl-4">
                  {Object.entries(bidsByDate.grouped).map(([date, bids], dateIndex) => {
                    // Parse the date key (MM/DD/YYYY format) to create a proper date object
                    const [month, day, year] = date.split('/');
                    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
                    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
                    const yearStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Chicago' });
                    
                    // Get total count for this date from the computed totals
                    const totalForDate = bidsByDate.dateTotals[date] ?? bids.length;
                    
                    return (
                      <div 
                        key={date} 
                        className="relative animate-in fade-in slide-in-from-bottom-4 duration-700"
                        style={{
                          animationDelay: `${dateIndex * 100}ms`,
                          animationFillMode: 'both',
                        }}
                      >
                        {/* Timeline dot */}
                        <div 
                          className="absolute left-0 top-6 w-4 h-4 rounded-full border-4 border-background shadow-lg z-20"
                          style={{
                            backgroundColor: accentColor,
                            transform: 'translateX(-50%)',
                            left: '32px',
                          }}
                        />
                        
                        {/* Date Header - Premium Design */}
                        <div 
                          className="sticky top-4 z-10 mb-6 ml-12"
                        >
                          <Glass className="p-6 border-2 shadow-xl hover:shadow-2xl transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div 
                                  className="p-3 rounded-xl shadow-lg"
                                  style={{
                                    backgroundColor: `${accentColor}15`,
                                  }}
                                >
                                  <Calendar 
                                    className="w-6 h-6" 
                                    style={{ color: accentColor }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-2xl font-bold tracking-tight">
                                      {dayName}
                </h3>
                                    <div 
                                      className="px-3 py-1 rounded-full text-xs font-semibold border-2"
                                      style={{
                                        backgroundColor: `${accentColor}10`,
                                        color: accentColor,
                                        borderColor: `${accentColor}30`,
                                      }}
                                    >
                                      {bids.length} of {totalForDate ?? '?'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-medium">{monthDay}</span>
                                    <span>•</span>
                                    <span>{yearStr}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Glass>
              </div>
              
                        {/* Bids Grid */}
                        <div className="ml-12 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {bids.map((bid, bidIndex) => (
                            <div
                    key={bid.bid_number}
                              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                              style={{
                                animationDelay: `${bidIndex * 30}ms`,
                                animationFillMode: 'both',
                              }}
                            >
                              <ArchiveBidCard
                    bid={bid}
                    onViewDetails={handleViewDetails}
                    onViewHistory={handleViewHistory}
                    accentColor={accentColor}
                  />
                            </div>
                ))}
              </div>
            </div>
                    );
                  })}
                  
                  {/* Loading indicator and intersection observer trigger for timeline */}
                  <div ref={sentinelRef} className="h-40 flex items-center justify-center ml-12">
                    {isLoadingMore && (
                      <Glass className="px-8 py-6 animate-in fade-in duration-300">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
                          <p className="text-sm font-medium">Loading more bids...</p>
                        </div>
                      </Glass>
                    )}
                    {!pagination.hasMore && allBids.length > 0 && (dateFrom || dateTo) && (
                      <div className="text-center py-8 animate-in fade-in duration-500">
                        <Glass className="px-6 py-4 inline-block">
                          <p className="text-sm font-medium text-muted-foreground">
                            All {allBids.length.toLocaleString()} bids loaded for selected date range
                          </p>
                        </Glass>
                      </div>
                    )}
                    {!pagination.hasMore && allBids.length > 0 && !dateFrom && !dateTo && (
                      <div className="text-center py-8 animate-in fade-in duration-500">
                        <Glass className="px-6 py-4 inline-block">
                          <p className="text-sm font-medium text-muted-foreground">
                            Reached the earliest archived bid ({allBids.length.toLocaleString()} total)
                          </p>
                        </Glass>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "grid" && (
        <div className="space-y-4">
          {/* Grid Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                Columns:
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGridColumns(Math.max(1, gridColumns - 1))}
                  disabled={gridColumns <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium w-8 text-center">{gridColumns}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGridColumns(Math.min(6, gridColumns + 1))}
                  disabled={gridColumns >= 6}
                  className="h-8 w-8 p-0"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable Container */}
          <div className="relative">
            <div
              ref={scrollContainerRef}
              className="h-[calc(100vh-300px)] min-h-[400px] md:min-h-[600px] lg:min-h-[800px] overflow-y-auto overflow-x-hidden"
              style={{
                scrollbarWidth: 'thin',
              }}
            >
              {isLoading && allBids.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading archived bids...</p>
                </div>
              ) : allBids.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Archived Bids Found</h3>
                    <p className="text-muted-foreground">
                      {Object.values({ bidNumber, dateFrom, dateTo, city, tag, milesMin, milesMax }).some(v => v) 
                        ? "Try adjusting your filters to see more results."
                        : "No bids have been archived yet."
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div 
                    className="grid gap-4 pb-4 pr-4"
                    style={{
                      gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    }}
                  >
                    {allBids.map((bid, index) => (
                      <div
              key={bid.bid_number}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                        style={{
                          animationDelay: `${Math.min(index * 20, 600)}ms`,
                          animationFillMode: 'both',
                        }}
                      >
                        <ArchiveBidCompactCard
              bid={bid}
                          onClick={() => handleViewDetails(bid)}
              accentColor={accentColor}
            />
                      </div>
          ))}
                  </div>
                  
                  {/* Loading indicator and intersection observer trigger */}
                  <div ref={sentinelRef} className="h-32 flex items-center justify-center">
                    {isLoadingMore && (
                      <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading more bids...</p>
                      </div>
                    )}
                    {!pagination.hasMore && allBids.length > 0 && (
                      <div className="text-center py-8 animate-in fade-in duration-500">
                        <p className="text-sm text-muted-foreground">
                          All {allBids.length.toLocaleString()} bids loaded
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
          </div>
        </div>
      )}

      {viewMode === "analytics" && (
        <div className="space-y-6">
          <div
            ref={scrollContainerRef}
            className="h-[calc(100vh-300px)] min-h-[400px] md:min-h-[600px] lg:min-h-[800px] overflow-y-auto overflow-x-hidden pr-6"
            style={{
              scrollbarWidth: 'thin',
            }}
          >
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
                      Avg: {day.avg_hours_active ? Math.round(day.avg_hours_active) : 0}h active
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
            
            {/* Sentinel for infinite scroll in analytics view */}
            <div ref={sentinelRef} className="h-32 flex items-center justify-center">
              {isLoadingMore && (
                <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading more...</p>
        </div>
      )}
            </div>
          </div>
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
                  {formatStopsDetailed(parseStops(selectedBid.stops)).map((address: ParsedAddress, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{address.fullAddress}</p>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {address.streetNumber && address.streetName && (
                            <p>Street: {address.streetNumber} {address.streetName}</p>
                          )}
                          <p>City: {address.city}</p>
                          <p>State: {address.state}</p>
                          {address.zipcode && <p>ZIP: {address.zipcode}</p>}
                          <p className="text-xs mt-1">
                            {index === 0 ? 'Pickup Location' :
                             index === formatStopsDetailed(parseStops(selectedBid.stops)).length - 1 ? 'Delivery Location' :
                             'Stop Location'}
                          </p>
                        </div>
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
                  style={{ backgroundColor: accentColor, color: getButtonTextColor() }}
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
                style={autoArchivingEnabled ? { backgroundColor: accentColor, color: getButtonTextColor() } : undefined}
              >
                {autoArchivingEnabled ? "ON" : "OFF"}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3">
              <Button
                variant="destructive"
                onClick={handleResetArchivedAt}
                disabled={!selectedDate}
              >
                Reset
              </Button>
              <div className="flex gap-3">
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
                  style={{ backgroundColor: accentColor, color: getButtonTextColor() }}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Bids
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}