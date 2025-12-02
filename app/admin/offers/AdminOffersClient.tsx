"use client";

import { AdminLoadLifecycleViewer } from "@/components/admin/AdminLoadLifecycleViewer";
import { DriverInfoDialog } from "@/components/admin/DriverInfoDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeLoadOffers } from "@/hooks/useRealtimeLoadOffers";
import useSWR from "swr";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import {
    ArrowUpDown,
    BarChart3,
    Calendar,
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
    Truck,
    XCircle,
    Zap
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import OfferAnalytics from "./OfferAnalytics";
import OfferComments from "./OfferComments";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface OfferHistory {
  id: string;
  offer_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  old_amount?: number;
  new_amount?: number;
  admin_notes?: string;
  carrier_notes?: string;
  performed_by: string;
  performed_by_email?: string;
  performed_by_role?: string;
  performed_at: string;
}

interface Offer {
  id: number;
  load_rr_number: string;
  carrier_user_id: string;
  offer_amount: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  counter_amount?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  is_expired?: boolean;
  effective_status?: string;
  // Driver information fields
  driver_info_required?: boolean;
  driver_info_submitted_at?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  truck_number?: string;
  trailer_number?: string;
  // Load details (joined from loads table)
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  pickup_date?: string;
  delivery_date?: string;
  equipment?: string;
  weight?: number;
  carrier_email?: string;
}

export default function AdminOffersClient() {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [offerHistory, setOfferHistory] = useState<OfferHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'reject' | 'counter'>('accept');
  const [counterAmount, setCounterAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount">("newest");
  const [selectedOffers, setSelectedOffers] = useState<number[]>([]);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'accept' | 'reject'>('accept');
  const [bulkAdminNotes, setBulkAdminNotes] = useState("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [driverInfoDialogOpen, setDriverInfoDialogOpen] = useState(false);
  const [lifecycleViewerOpen, setLifecycleViewerOpen] = useState(false);
  
  // Advanced filter states
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [amountRangeFilter, setAmountRangeFilter] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { accentColor } = useAccentColor();
  const { theme } = useTheme();

  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

  // Fetch offers using SWR with Realtime
  const { data: offersData, mutate: mutateOffers, isLoading: loading } = useSWR(
    '/api/admin/offers',
    fetcher,
    { 
      refreshInterval: 60000, // Reduced from 30s - Realtime handles instant updates
      onSuccess: (data) => {
        // Check for expired offers when data loads
        expireOffers();
      }
    }
  );

  const offers: Offer[] = offersData?.offers || [];

  // Realtime updates for load_offers (admin sees all offers)
  useRealtimeLoadOffers({
    onInsert: () => {
      mutateOffers();
    },
    onUpdate: () => {
      mutateOffers();
    },
    onDelete: () => {
      mutateOffers();
    },
    enabled: true,
  });

  useEffect(() => {
    expireOffers(); // Check for expired offers on load
  }, []);

  const expireOffers = async () => {
    try {
      const response = await fetch('/api/offers/expire', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.expiredCount > 0) {
          toast.info(`${data.expiredCount} offers expired`);
        }
      }
    } catch (error) {
      console.error('Error expiring offers:', error);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateRangeFilter("all");
    setAmountRangeFilter("all");
    setEquipmentFilter("all");
    setCarrierFilter("");
    setSortBy("newest");
  };

  const fetchOfferHistory = async (offerId: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/history`);
      if (!response.ok) throw new Error('Failed to fetch offer history');
      
      const data = await response.json();
      setOfferHistory(data.history || []);
    } catch (error) {
      toast.error('Failed to load offer history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOfferAction = async () => {
    if (!selectedOffer) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/offers/${selectedOffer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: selectedOffer.id,
          action: actionType,
          counterAmount: actionType === 'counter' ? Math.round(Number(counterAmount) * 100) : undefined,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process offer');

      toast.success(`Offer ${actionType}ed successfully!`);
      setActionDialogOpen(false);
      setSelectedOffer(null);
      setCounterAmount("");
      setAdminNotes("");
      mutateOffers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process offer');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDriverInfo = (offer: Offer) => {
    setSelectedOffer(offer);
    setDriverInfoDialogOpen(true);
  };

  const handleBulkSelection = (offerId: number, checked: boolean) => {
    if (checked) {
      setSelectedOffers(prev => [...prev, offerId]);
    } else {
      setSelectedOffers(prev => prev.filter(id => id !== offerId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingOfferIds = pendingOffers.map(offer => offer.id);
      setSelectedOffers(pendingOfferIds);
    } else {
      setSelectedOffers([]);
    }
  };

  const handleBulkAction = async () => {
    if (selectedOffers.length === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/offers/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerIds: selectedOffers,
          action: bulkActionType,
          adminNotes: bulkAdminNotes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process bulk action');

      toast.success(`${selectedOffers.length} offers ${bulkActionType}ed successfully!`);
      setBulkActionDialogOpen(false);
      setSelectedOffers([]);
      setBulkAdminNotes("");
      mutateOffers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process bulk action');
    } finally {
      setIsProcessing(false);
    }
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

  const formatRoute = (offer: Offer) => {
    const origin = offer.origin_city && offer.origin_state 
      ? `${offer.origin_city}, ${offer.origin_state}` 
      : "Origin TBD";
    const destination = offer.destination_city && offer.destination_state 
      ? `${offer.destination_city}, ${offer.destination_state}` 
      : "Destination TBD";
    return `${origin} → ${destination}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'countered': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'expired': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'countered': return <TrendingUp className="h-4 w-4" />;
      case 'expired': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Filter and sort offers
  const filteredOffers = offers.filter(offer => {
    const matchesSearch = searchTerm === "" || 
      formatRoute(offer).toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.load_rr_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.carrier_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || offer.status === statusFilter;
    
    // Advanced filters
    const matchesDateRange = (() => {
      if (dateRangeFilter === "all") return true;
      const offerDate = new Date(offer.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - offerDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateRangeFilter) {
        case "today": return daysDiff === 0;
        case "week": return daysDiff <= 7;
        case "month": return daysDiff <= 30;
        case "quarter": return daysDiff <= 90;
        default: return true;
      }
    })();
    
    const matchesAmountRange = (() => {
      if (amountRangeFilter === "all") return true;
      const amount = offer.offer_amount / 100; // Convert from cents to dollars
      
      switch (amountRangeFilter) {
        case "low": return amount < 1000;
        case "medium": return amount >= 1000 && amount < 5000;
        case "high": return amount >= 5000;
        default: return true;
      }
    })();
    
    const matchesEquipment = equipmentFilter === "all" || 
      (offer.equipment && offer.equipment.toLowerCase().includes(equipmentFilter.toLowerCase()));
    
    const matchesCarrier = carrierFilter === "" || 
      (offer.carrier_email && offer.carrier_email.toLowerCase().includes(carrierFilter.toLowerCase()));
    
    return matchesSearch && matchesStatus && matchesDateRange && matchesAmountRange && matchesEquipment && matchesCarrier;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "amount": return b.offer_amount - a.offer_amount;
      default: return 0;
    }
  });

  const pendingOffers = filteredOffers.filter(o => o.status === 'pending');
  const processedOffers = filteredOffers.filter(o => o.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading offers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/50 border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending Offers</p>
                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{pendingOffers.length}</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Awaiting review</p>
              </div>
              <div className="p-3 rounded-full bg-yellow-200 dark:bg-yellow-800">
                <Clock className="h-6 w-6 text-yellow-800 dark:text-yellow-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Accepted</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                  {offers.filter(o => o.status === 'accepted').length}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">Confirmed loads</p>
              </div>
              <div className="p-3 rounded-full bg-green-200 dark:bg-green-800">
                <CheckCircle2 className="h-6 w-6 text-green-800 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Countered</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {offers.filter(o => o.status === 'countered').length}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Negotiations</p>
              </div>
              <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800">
                <TrendingUp className="h-6 w-6 text-blue-800 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/50 dark:to-gray-900/50 border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Expired</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {offers.filter(o => o.status === 'expired' || o.is_expired).length}
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">No longer active</p>
              </div>
              <div className="p-3 rounded-full bg-gray-200 dark:bg-gray-800">
                <XCircle className="h-6 w-6 text-gray-800 dark:text-gray-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Total Offers</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{offers.length}</p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">All time</p>
              </div>
              <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800">
                <Crown className="h-6 w-6 text-purple-800 dark:text-purple-200" />
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
                  placeholder="Search offers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="countered">Countered</option>
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "amount")}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount">Highest Amount</option>
                </select>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutateOffers()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
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
                  <Label className="text-sm font-medium">Offer Amount</Label>
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
                  <Input
                    placeholder="Filter by equipment..."
                    value={equipmentFilter}
                    onChange={(e) => setEquipmentFilter(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Carrier Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Carrier Email</Label>
                  <Input
                    placeholder="Filter by carrier..."
                    value={carrierFilter}
                    onChange={(e) => setCarrierFilter(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* Offers Tabs */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pending ({pendingOffers.length})
          </TabsTrigger>
          <TabsTrigger value="processed" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Processed ({processedOffers.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Expired ({offers.filter(o => o.status === 'expired' || o.is_expired).length})
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

        <TabsContent value="pending" className="space-y-4">
          {pendingOffers.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
                  <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No pending offers</h3>
                <p className="text-muted-foreground">
                  All offers have been processed. Check back later for new carrier submissions.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bulk Selection Controls */}
              {pendingOffers.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedOffers.length === pendingOffers.length && pendingOffers.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label className="text-sm font-medium">
                          Select All ({pendingOffers.length})
                        </label>
                      </div>
                      {selectedOffers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {selectedOffers.length} selected
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBulkActionDialogOpen(true)}
                            className="h-8"
                          >
                            Bulk Actions
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {pendingOffers.map((offer) => (
                <Card key={offer.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOffers.includes(offer.id)}
                          onChange={(e) => handleBulkSelection(offer.id, e.target.checked)}
                          className="mt-1 rounded border-gray-300"
                        />
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{formatRoute(offer)}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(offer.status)}>
                              {getStatusIcon(offer.status)}
                              <span className="ml-1 capitalize">{offer.status}</span>
                            </Badge>
                            <span className="text-sm text-muted-foreground">RR: {offer.load_rr_number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{formatPrice(offer.offer_amount)}</div>
                        <div className="text-sm text-muted-foreground">Carrier Offer</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{offer.equipment || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(offer.created_at)}</span>
                      </div>
                    </div>

                    {offer.expires_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Expires: {formatDate(offer.expires_at)}
                          {offer.is_expired && (
                            <span className="ml-2 text-red-600 font-medium">(EXPIRED)</span>
                          )}
                        </span>
                      </div>
                    )}

                    {offer.notes && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Carrier Notes</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{offer.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setActionType('accept');
                          setActionDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setActionType('counter');
                          setActionDialogOpen(true);
                        }}
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Counter
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setActionType('reject');
                          setActionDialogOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      {offer.status === 'accepted' && offer.driver_info_submitted_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleViewDriverInfo(offer)}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Driver Info
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          {processedOffers.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No processed offers</h3>
                <p className="text-muted-foreground">
                  Processed offers will appear here once you take action on pending offers.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {processedOffers.map((offer) => (
                <Card key={offer.id} className="group hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{formatRoute(offer)}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(offer.status)}>
                            {getStatusIcon(offer.status)}
                            <span className="ml-1 capitalize">{offer.status}</span>
                          </Badge>
                          <span className="text-sm text-muted-foreground">RR: {offer.load_rr_number}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{formatPrice(offer.offer_amount)}</div>
                        <div className="text-sm text-muted-foreground">Carrier Offer</div>
                        {offer.counter_amount && (
                          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {formatPrice(offer.counter_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{offer.equipment || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(offer.updated_at)}</span>
                      </div>
                    </div>

                    {offer.notes && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Carrier Notes</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{offer.notes}</p>
                      </div>
                    )}

                    {offer.admin_notes && (
                      <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Admin Notes</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{offer.admin_notes}</p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          {offers.filter(o => o.status === 'expired' || o.is_expired).length === 0 ? (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">No expired offers</h3>
                  <p className="text-muted-foreground">All offers are currently active or have been processed.</p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {offers.filter(o => o.status === 'expired' || o.is_expired).map((offer) => (
                <Card key={offer.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                          <Truck className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{formatRoute(offer)}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusColor(offer.status)}>
                              {getStatusIcon(offer.status)}
                              <span className="ml-1 capitalize">{offer.status}</span>
                            </Badge>
                            <span className="text-sm text-muted-foreground">RR: {offer.load_rr_number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{formatPrice(offer.offer_amount)}</div>
                        <div className="text-sm text-muted-foreground">Carrier Offer</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{offer.equipment || "TBD"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(offer.created_at)}</span>
                      </div>
                    </div>

                    {offer.expires_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Expired: {formatDate(offer.expires_at)}
                          <span className="ml-2 text-red-600 font-medium">(EXPIRED)</span>
                        </span>
                      </div>
                    )}

                    {offer.notes && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Carrier Notes</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{offer.notes}</p>
                      </div>
                    )}

                    {offer.admin_notes && (
                      <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Admin Notes</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{offer.admin_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <OfferAnalytics />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Offer History</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedOffer?.id || ""}
                    onChange={(e) => {
                      const offer = offers.find(o => o.id.toString() === e.target.value);
                      setSelectedOffer(offer || null);
                      if (offer) {
                        fetchOfferHistory(offer.id.toString());
                      }
                    }}
                    className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Select an offer to view history</option>
                    {offers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {formatRoute(offer)} - {formatPrice(offer.offer_amount)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedOffer && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{formatRoute(selectedOffer)}</h4>
                      <p className="text-sm text-muted-foreground">
                        RR: {selectedOffer.load_rr_number} • {formatPrice(selectedOffer.offer_amount)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(selectedOffer.status)}>
                      {getStatusIcon(selectedOffer.status)}
                      <span className="ml-1 capitalize">{selectedOffer.status}</span>
                    </Badge>
                  </div>
                </div>
              )}

              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : offerHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {selectedOffer ? "No history available for this offer" : "Select an offer to view its history"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {offerHistory.map((entry, index) => (
                    <div key={entry.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {entry.action === 'accepted' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {entry.action === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                          {entry.action === 'countered' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                          {entry.action === 'created' && <Clock className="h-4 w-4 text-yellow-600" />}
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{entry.action}</span>
                            {entry.old_status && entry.new_status && (
                              <span className="text-sm text-muted-foreground">
                                {entry.old_status} → {entry.new_status}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(entry.performed_at)}
                          </span>
                        </div>
                        
                        {entry.old_amount && entry.new_amount && entry.old_amount !== entry.new_amount && (
                          <div className="text-sm text-muted-foreground">
                            Amount: {formatPrice(entry.old_amount)} → {formatPrice(entry.new_amount)}
                          </div>
                        )}
                        
                        {entry.admin_notes && (
                          <div className="bg-blue-50 dark:bg-blue-950/50 rounded p-2">
                            <p className="text-sm text-blue-800 dark:text-blue-200">{entry.admin_notes}</p>
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground">
                          Performed by: {entry.performed_by_email || entry.performed_by}
                          {entry.performed_by_role && ` (${entry.performed_by_role})`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'accept' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-red-500" />}
              {actionType === 'counter' && <TrendingUp className="h-5 w-5 text-blue-500" />}
              {actionType === 'accept' && 'Accept Offer'}
              {actionType === 'reject' && 'Reject Offer'}
              {actionType === 'counter' && 'Counter Offer'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedOffer && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium text-foreground mb-1">
                  {formatRoute(selectedOffer)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Carrier Offer: {formatPrice(selectedOffer.offer_amount)}
                </div>
              </div>
            )}

            {actionType === 'counter' && (
              <div className="space-y-2">
                <Label htmlFor="counterAmount">Counter Offer Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="counterAmount"
                    type="number"
                    placeholder="Enter counter offer"
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)}
                    className="pl-10"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="adminNotes"
                placeholder="Add any notes about this decision..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setActionDialogOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleOfferAction}
                disabled={isProcessing || (actionType === 'counter' && !counterAmount)}
                className="transition-colors"
                style={{ 
                  backgroundColor: actionType === 'accept' ? '#16a34a' : actionType === 'reject' ? '#dc2626' : accentColor,
                  color: '#ffffff'
                }}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {actionType === 'accept' && <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {actionType === 'reject' && <XCircle className="h-4 w-4 mr-2" />}
                    {actionType === 'counter' && <TrendingUp className="h-4 w-4 mr-2" />}
                    {actionType === 'accept' && 'Accept Offer'}
                    {actionType === 'reject' && 'Reject Offer'}
                    {actionType === 'counter' && 'Send Counter'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkActionType === 'accept' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {bulkActionType === 'reject' && <XCircle className="h-5 w-5 text-red-500" />}
              {bulkActionType === 'accept' && 'Accept Selected Offers'}
              {bulkActionType === 'reject' && 'Reject Selected Offers'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium text-foreground mb-1">
                {selectedOffers.length} offers selected
              </div>
              <div className="text-xs text-muted-foreground">
                This action will be applied to all selected offers
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-action-type">Action</Label>
              <select
                id="bulk-action-type"
                value={bulkActionType}
                onChange={(e) => setBulkActionType(e.target.value as 'accept' | 'reject')}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="accept">Accept Offers</option>
                <option value="reject">Reject Offers</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-admin-notes">Admin Notes (Optional)</Label>
              <Textarea
                id="bulk-admin-notes"
                placeholder="Add notes for all selected offers..."
                value={bulkAdminNotes}
                onChange={(e) => setBulkAdminNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setBulkActionDialogOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAction}
                disabled={isProcessing || selectedOffers.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                style={{ backgroundColor: accentColor, color: getButtonTextColor() }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {bulkActionType === 'accept' && <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {bulkActionType === 'reject' && <XCircle className="h-4 w-4 mr-2" />}
                    {bulkActionType === 'accept' ? 'Accept All' : 'Reject All'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Offer Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedOffer && (
            <div className="space-y-6">
              {/* Offer Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{formatRoute(selectedOffer)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Carrier Offer</div>
                      <div className="text-2xl font-bold">{formatPrice(selectedOffer.offer_amount)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Status</div>
                      <Badge className={getStatusColor(selectedOffer.status)}>
                        {getStatusIcon(selectedOffer.status)}
                        <span className="ml-1 capitalize">{selectedOffer.status}</span>
                      </Badge>
                    </div>
                  </div>
                  
                  {selectedOffer.counter_amount && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Counter Offer</div>
                      <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                        {formatPrice(selectedOffer.counter_amount)}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedOffer.equipment || "TBD"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Created: {formatDate(selectedOffer.created_at)}</span>
                    </div>
                  </div>

                  {selectedOffer.notes && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Carrier Notes</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedOffer.notes}</p>
                    </div>
                  )}

                  {selectedOffer.admin_notes && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Admin Notes</span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{selectedOffer.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comments Section */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Communication & Tracking</h3>
                <Button
                  variant="outline"
                  onClick={() => setLifecycleViewerOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  View Lifecycle Tracking
                </Button>
              </div>
              <OfferComments offerId={selectedOffer.id.toString()} userRole="admin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Driver Info Dialog */}
      <DriverInfoDialog
        open={driverInfoDialogOpen}
        onOpenChange={setDriverInfoDialogOpen}
        offer={selectedOffer}
      />

      {/* Load Lifecycle Viewer */}
      {selectedOffer && (
        <AdminLoadLifecycleViewer
          offerId={selectedOffer.id.toString()}
          loadData={selectedOffer}
          isOpen={lifecycleViewerOpen}
          onClose={() => setLifecycleViewerOpen(false)}
        />
      )}
    </div>
  );
}