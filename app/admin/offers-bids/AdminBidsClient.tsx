"use client";

import AdminBidLifecycleViewer from "@/components/admin/AdminBidLifecycleViewer";
import { DriverInfoDialog } from "@/components/admin/DriverInfoDialog";
import { BidMessageConsole } from "@/components/bid-message/BidMessageConsole";
import { MarginProfitAnalytics } from "@/components/admin/MarginProfitAnalytics";
import { DocumentViewerDialog } from "./DocumentViewerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    BarChart3,
    CheckCircle2,
    Clock,
    Crown,
    DollarSign,
    Filter,
    History,
    MessageSquare,
    RefreshCw,
    Search,
    Shield,
    TrendingUp,
    XCircle,
    Zap,
    File,
    Download,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";

interface AwardedBid {
  id: string;
  bid_number: string;
  carrier_id: string;
  carrier_name: string;
  carrier_email: string;
  carrier_phone: string;
  equipment_type?: string;
  stops?: any;
  miles?: number;
  bid_amount: number;
  status: string;
  lifecycle_notes?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  truck_number?: string;
  trailer_number?: string;
  driver_info_submitted_at?: string;
  pickup_timestamp?: string;
  delivery_timestamp?: string;
  created_at: string;
  updated_at: string;
}

interface BidStats {
  total: number;
  active: number;
  completed: number;
  revenue: number;
}

export default function AdminBidsClient() {
  const { user } = useUnifiedUser();
  const [bids, setBids] = useState<AwardedBid[]>([]);
  const [stats, setStats] = useState<BidStats>({ total: 0, active: 0, completed: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<AwardedBid | null>(null);
  const [showDriverInfoDialog, setShowDriverInfoDialog] = useState(false);
  const [showLifecycleDialog, setShowLifecycleDialog] = useState(false);
  const [messageBidNumber, setMessageBidNumber] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [amountRangeFilter, setAmountRangeFilter] = useState("all");
  const [documentViewerBid, setDocumentViewerBid] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateBids, setSelectedDateBids] = useState<AwardedBid[]>([]);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const { theme } = useTheme();
  const { accentColor } = useAccentColor();

  const fetchBids = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/awarded-bids');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch bids:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to fetch bids');
      }
      const data = await response.json();
      // Handle new API format with pagination
      if (data.bids && Array.isArray(data.bids)) {
        setBids(data.bids);
      } else if (Array.isArray(data)) {
        // Fallback for old format
        setBids(data);
      } else {
        throw new Error('Invalid data format');
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
      toast.error('Failed to load bids data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/bid-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchBids();
    fetchStats();
  }, []);

  const filteredBids = bids.filter(bid => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!bid.bid_number.toLowerCase().includes(searchLower) &&
          !bid.carrier_name.toLowerCase().includes(searchLower) &&
          !bid.carrier_id.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== "all" && bid.status !== statusFilter) {
      return false;
    }

    // Equipment filter
    if (equipmentFilter !== "all" && bid.equipment_type !== equipmentFilter) {
      return false;
    }

    // Date range filter
    if (dateRangeFilter !== "all") {
      const bidDate = new Date(bid.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - bidDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateRangeFilter) {
        case "today":
          if (daysDiff > 0) return false;
          break;
        case "week":
          if (daysDiff > 7) return false;
          break;
        case "month":
          if (daysDiff > 30) return false;
          break;
        case "quarter":
          if (daysDiff > 90) return false;
          break;
      }
    }

    // Amount range filter
    if (amountRangeFilter !== "all") {
      const amount = bid.bid_amount / 100;
      switch (amountRangeFilter) {
        case "low":
          if (amount >= 1000) return false;
          break;
        case "medium":
          if (amount < 1000 || amount > 5000) return false;
          break;
        case "high":
          if (amount <= 5000) return false;
          break;
      }
    }

    return true;
  });

  const sortedBids = [...filteredBids].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "highest":
        return b.bid_amount - a.bid_amount;
      case "lowest":
        return a.bid_amount - b.bid_amount;
      default:
        return 0;
    }
  });

  // Awarded bids are ALL bids (they're all awarded, just different lifecycle stages)
  const awardedBids = sortedBids;
  // Active bids are those in progress but not completed
  const activeBids = sortedBids.filter(bid => 
    bid.status !== 'completed' && bid.status !== 'delivered' && bid.status !== 'cancelled'
  );
  // Completed bids are those marked as completed or delivered
  const completedBids = sortedBids.filter(bid => 
    bid.status === 'completed' || bid.status === 'delivered'
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setEquipmentFilter("all");
    setSortBy("newest");
    setDateRangeFilter("all");
    setAmountRangeFilter("all");
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  // Group bids by date
  const groupBidsByDate = (bids: AwardedBid[]) => {
    const grouped: Record<string, AwardedBid[]> = {};
    bids.forEach(bid => {
      const dateKey = formatDateOnly(bid.created_at);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bid);
    });
    return grouped;
  };

  // Get all unique dates from bids, sorted
  const getSortedDates = (bids: AwardedBid[]) => {
    const dates = new Set<string>();
    bids.forEach(bid => {
      dates.add(formatDateOnly(bid.created_at));
    });
    return Array.from(dates).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime(); // Newest first
    });
  };

  const handleDateClick = (date: string, bids: AwardedBid[]) => {
    setSelectedDate(date);
    setSelectedDateBids(bids);
    setShowDateDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'bid_awarded': { label: 'Bid Awarded', variant: 'default' as const, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'load_assigned': { label: 'Load Assigned', variant: 'default' as const, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      'driver_info_update': { label: 'Driver Info Updated', variant: 'default' as const, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      'checked_in_origin': { label: 'Checked In - Origin', variant: 'default' as const, className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
      'picked_up': { label: 'Picked Up', variant: 'default' as const, className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
      'departed_origin': { label: 'Departed - Origin', variant: 'default' as const, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      'in_transit': { label: 'In Transit', variant: 'default' as const, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      'checked_in_destination': { label: 'Checked In - Destination', variant: 'default' as const, className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
      'delivered': { label: 'Delivered', variant: 'default' as const, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      'completed': { label: 'Completed', variant: 'default' as const, className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
      'awarded': { label: 'Awarded', variant: 'default' as const, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'active': { label: 'Active', variant: 'default' as const, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), 
      variant: 'secondary' as const, 
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' 
    };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleViewDriverInfo = (bid: AwardedBid) => {
    setSelectedBid(bid);
    setShowDriverInfoDialog(true);
  };

  const handleViewLifecycle = (bid: AwardedBid) => {
    setSelectedBid(bid);
    setShowLifecycleDialog(true);
  };

  const handleOpenMessage = (bid: AwardedBid) => {
    setMessageBidNumber(bid.bid_number);
  };

  const handleCloseMessage = () => {
    setMessageBidNumber(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p>Loading bids...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Awarded Bids</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{awardedBids.length}</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Awaiting action</p>
              </div>
              <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800">
                <Clock className="h-6 w-6 text-blue-800 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Active</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{activeBids.length}</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">In progress</p>
              </div>
              <div className="p-3 rounded-full bg-green-200 dark:bg-green-800">
                <CheckCircle2 className="h-6 w-6 text-green-800 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Completed</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{completedBids.length}</p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">Finished</p>
              </div>
              <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800">
                <Shield className="h-6 w-6 text-purple-800 dark:text-purple-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Total Revenue</p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{formatPrice(stats.revenue)}</p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">All time</p>
              </div>
              <div className="p-3 rounded-full bg-orange-200 dark:bg-orange-800">
                <DollarSign className="h-6 w-6 text-orange-800 dark:text-orange-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50 border-indigo-200 dark:border-indigo-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Total Bids</p>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{stats.total}</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">All time</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-200 dark:bg-indigo-800">
                <Crown className="h-6 w-6 text-indigo-800 dark:text-indigo-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Basic Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bids..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Status Filter */}
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-border rounded-md bg-background text-foreground min-w-[140px]"
                >
                  <option value="all">All Status</option>
                  <option value="awarded">Awarded</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Sort */}
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-border rounded-md bg-background text-foreground min-w-[140px]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchBids(); fetchStats(); }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedBid(null); // Clear any previously selected bid
                setShowLifecycleDialog(true);
              }}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              View All Lifecycles
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date Range</Label>
                  <select
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 90 Days</option>
                  </select>
                </div>

                {/* Amount Range Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Bid Amount</Label>
                  <select
                    value={amountRangeFilter}
                    onChange={(e) => setAmountRangeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="all">All Amounts</option>
                    <option value="low">Under $1,000</option>
                    <option value="medium">$1,000 - $5,000</option>
                    <option value="high">Over $5,000</option>
                  </select>
                </div>

                {/* Equipment Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Equipment Type</Label>
                  <select
                    value={equipmentFilter}
                    onChange={(e) => setEquipmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="all">All Equipment</option>
                    <option value="AL">AL</option>
                    <option value="CA">CA</option>
                    <option value="LA">LA</option>
                    <option value="MI">MI</option>
                    <option value="NY">NY</option>
                  </select>
                </div>

                {/* Results Count */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Results</Label>
                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                    {filteredBids.length} bids found
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* Bids Tabs */}
      <Tabs defaultValue="awarded" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="awarded" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Awarded ({awardedBids.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Active ({activeBids.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedBids.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="awarded" className="space-y-4">
          {awardedBids.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No awarded bids</h3>
                <p className="text-muted-foreground">
                  No bids have been awarded yet. Check back later for new auction results.
                </p>
              </div>
            </Card>
          ) : (
            <BidCalendarView 
              bids={awardedBids}
              onDateClick={handleDateClick}
              accentColor={accentColor}
            />
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeBids.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No active bids</h3>
                <p className="text-muted-foreground">
                  No bids are currently active. Check the awarded bids tab for bids that need action.
                </p>
              </div>
            </Card>
          ) : (
            <BidCalendarView 
              bids={activeBids}
              onDateClick={handleDateClick}
              accentColor={accentColor}
            />
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedBids.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-900/50 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No completed bids</h3>
                <p className="text-muted-foreground">
                  No bids have been completed yet. Check back later for finished deliveries.
                </p>
              </div>
            </Card>
          ) : (
            <BidCalendarView 
              bids={completedBids}
              onDateClick={handleDateClick}
              accentColor={accentColor}
            />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <MarginProfitAnalytics accentColor={accentColor} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="p-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-900/50 rounded-full flex items-center justify-center">
                <History className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">History Coming Soon</h3>
              <p className="text-muted-foreground">
                Bid history and audit trail features will be available soon.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Driver Info Dialog */}
      {selectedBid && (
        <DriverInfoDialog
          open={showDriverInfoDialog}
          onOpenChange={setShowDriverInfoDialog}
          offer={selectedBid}
          isBid={true}
        />
      )}

      {/* Lifecycle Dialog */}
      <Dialog open={showLifecycleDialog} onOpenChange={setShowLifecycleDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBid ? `Bid Lifecycle - #${selectedBid.bid_number}` : 'Bid Lifecycle Management'}
            </DialogTitle>
          </DialogHeader>
          <AdminBidLifecycleViewer 
            bidId={selectedBid?.bid_number} 
            onBidSelect={(bid) => setSelectedBid(bid)}
          />
        </DialogContent>
      </Dialog>

      {/* Bid Message Console */}
      {messageBidNumber && user?.id && (
        <BidMessageConsole
          bidNumber={messageBidNumber}
          userRole="admin"
          userId={user.id}
          onClose={handleCloseMessage}
        />
      )}

      {/* Document Viewer Dialog */}
      {documentViewerBid && (
        <DocumentViewerDialog
          bidNumber={documentViewerBid}
          isOpen={!!documentViewerBid}
          onClose={() => setDocumentViewerBid(null)}
        />
      )}

      {/* Date Detail Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Bids for {selectedDate ? new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDateBids.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No bids found for this date.</p>
              </Card>
            ) : (
              selectedDateBids.map((bid, index) => (
                <Card key={`${bid.bid_number}-${bid.id}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">Bid #{bid.bid_number}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(bid.status)}
                            <span className="text-sm text-muted-foreground">
                              {formatDate(bid.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMessage(bid)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewLifecycle(bid)}
                        >
                          View Lifecycle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDriverInfo(bid)}
                        >
                          Driver Info
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDocumentViewerBid(bid.bid_number)}
                        >
                          <File className="h-4 w-4 mr-2" />
                          Documents
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Carrier</Label>
                        <div className="mt-1">
                          <div className="font-medium">{bid.carrier_name}</div>
                          <div className="text-xs text-muted-foreground">ID: {bid.carrier_id}</div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Route</Label>
                        <div className="mt-1">
                          {bid.stops && Array.isArray(bid.stops) && bid.stops.length >= 2 ? (
                            <>
                              <div>{bid.stops[0]}</div>
                              <div className="text-sm text-muted-foreground">→ {bid.stops[bid.stops.length - 1]}</div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">Route not available</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Bid Details</Label>
                        <div className="mt-1">
                          <div className="font-semibold text-lg">{formatPrice(bid.bid_amount)}</div>
                          <div className="text-sm text-muted-foreground">
                            {bid.equipment_type} • {bid.miles ? `${bid.miles.toLocaleString()} mi` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Calendar View Component
function BidCalendarView({ 
  bids, 
  onDateClick, 
  accentColor 
}: { 
  bids: AwardedBid[]; 
  onDateClick: (date: string, bids: AwardedBid[]) => void;
  accentColor: string;
}) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Initialize to the month of the most recent bid, or current month
    if (bids.length > 0) {
      const dates = bids.map(bid => new Date(bid.created_at));
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
      return new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const groupBidsByDate = (bids: AwardedBid[]) => {
    const grouped: Record<string, AwardedBid[]> = {};
    bids.forEach(bid => {
      const dateKey = formatDateOnly(bid.created_at);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bid);
    });
    return grouped;
  };

  const getSortedDates = (bids: AwardedBid[], monthFilter?: Date) => {
    const dates = new Set<string>();
    bids.forEach(bid => {
      const bidDate = new Date(bid.created_at);
      if (!monthFilter || 
          (bidDate.getFullYear() === monthFilter.getFullYear() && 
           bidDate.getMonth() === monthFilter.getMonth())) {
        dates.add(formatDateOnly(bid.created_at));
      }
    });
    return Array.from(dates).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime(); // Newest first
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const bidsByDate = groupBidsByDate(bids);
  const sortedDates = getSortedDates(bids, currentMonth);
  
  // Get all available months from bids
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    bids.forEach(bid => {
      const date = new Date(bid.created_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      months.add(monthKey);
    });
    return Array.from(months)
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        return new Date(year, month, 1);
      })
      .sort((a, b) => b.getTime() - a.getTime());
  }, [bids]);

  const currentMonthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      year: date.getFullYear(),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      full: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    };
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <div className="space-y-4">
      {/* Month/Year Navigation Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-4">
            <select
              value={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-').map(Number);
                setCurrentMonth(new Date(year, month, 1));
              }}
              className="px-4 py-2 border border-border rounded-md bg-background text-foreground font-semibold text-lg cursor-pointer hover:bg-accent transition-colors"
              style={{ color: accentColor }}
            >
              {availableMonths.map(month => {
                const key = `${month.getFullYear()}-${month.getMonth()}`;
                const label = month.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric"
                });
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="flex items-center gap-2"
            disabled={currentMonth.getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {sortedDates.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">No bids for {currentMonthLabel}</h3>
            <p className="text-muted-foreground">
              Select a different month to view bids.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedDates.map((dateStr) => {
          const dateBids = bidsByDate[dateStr] || [];
          const dateInfo = formatDateDisplay(dateStr);
          const bidCount = dateBids.length;
          const totalRevenue = dateBids.reduce((sum, bid) => sum + bid.bid_amount, 0) / 100;

          return (
            <Card
              key={dateStr}
              className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-opacity-50"
              style={{ 
                borderColor: accentColor,
                borderOpacity: 0.3
              }}
              onClick={() => onDateClick(dateStr, dateBids)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {dateInfo.weekday}
                    </span>
                    <span className="text-2xl font-bold" style={{ color: accentColor }}>
                      {dateInfo.day}
                    </span>
                  </div>
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">{dateInfo.month} {dateInfo.year}</div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Bids:</span>
                    <span className="text-sm font-semibold">{bidCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Revenue:</span>
                    <span className="text-sm font-semibold text-green-600">
                      ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}