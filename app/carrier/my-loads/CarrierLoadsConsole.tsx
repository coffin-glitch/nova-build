"use client";

import { EnhancedLoadLifecycleManager } from "@/components/load/EnhancedLoadLifecycleManager";
import { OfferMessageConsole } from "@/components/offer/OfferMessageConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDistance, formatMoney } from "@/lib/format";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    DollarSign,
    MapPin,
    MessageSquare,
    Package,
    RefreshCw,
    TrendingUp,
    Truck,
    XCircle
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { AdvancedFilters } from "./AdvancedFilters";
import { LoadAnalytics } from "./LoadAnalytics";
import { LoadDetailsDialog } from "./LoadDetailsDialog";
import { NotificationSystem } from "./NotificationSystem";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LoadOffer {
  id: string;
  load_rr_number: string;
  offer_amount: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';
  counter_amount?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
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
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_date: string;
  delivery_date: string;
  revenue: number;
  total_miles: number;
  equipment: string;
  customer_name: string;
  tm_number: string;
}

interface BookedLoad {
  id: string;
  rr_number: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  pickup_date: string;
  pickup_time: string;
  delivery_date: string;
  delivery_time: string;
  revenue: number;
  miles: number;
  equipment: string;
  customer_name: string;
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'completed';
  assigned_at: string;
  picked_up_at?: string;
  delivered_at?: string;
  notes?: string;
}

interface LoadStats {
  totalOffers: number;
  pendingOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  totalBooked: number;
  activeLoads: number;
  completedLoads: number;
  totalRevenue: number;
  averageOfferAmount: number;
}

interface FilterState {
  searchTerm: string;
  status: string[];
  dateRange: { start: string; end: string };
  revenueRange: [number, number];
  distanceRange: [number, number];
  equipment: string[];
  originStates: string[];
  destinationStates: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function CarrierLoadsConsole() {
  const { user, isLoaded } = useUnifiedUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    searchTerm: '',
    status: [],
    dateRange: { start: '', end: '' },
    revenueRange: [0, 10000],
    distanceRange: [0, 3000],
    equipment: [],
    originStates: [],
    destinationStates: [],
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  // Modify/Withdraw offer state
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<LoadOffer | null>(null);
  const [modifyAmount, setModifyAmount] = useState("");
  const [modifyNotes, setModifyNotes] = useState("");
  const [isModifying, setIsModifying] = useState(false);

  // Expand/Collapse state for lifecycle loads
  const [expandedLoads, setExpandedLoads] = useState<Set<string>>(new Set());

  // Toggle expand/collapse for lifecycle loads
  const toggleLoadExpansion = (loadId: string) => {
    const newExpanded = new Set(expandedLoads);
    if (newExpanded.has(loadId)) {
      newExpanded.delete(loadId);
    } else {
      newExpanded.add(loadId);
    }
    setExpandedLoads(newExpanded);
  };

  // Message console state
  const [messageConsoleOpen, setMessageConsoleOpen] = useState(false);
  const [selectedOfferForMessage, setSelectedOfferForMessage] = useState<string | null>(null);

  // Fetch load offers
  const { data: offersData, mutate: mutateOffers } = useSWR(
    user ? "/api/carrier/load-offers" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch booked loads
  const { data: bookedData, mutate: mutateBooked } = useSWR(
    user ? "/api/carrier/booked-loads" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch load statistics
  const { data: statsData } = useSWR(
    user ? "/api/carrier/load-stats" : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const offers: LoadOffer[] = offersData?.data || [];
  const bookedLoads: BookedLoad[] = bookedData?.data || [];
  const stats: LoadStats = statsData?.data || {
    totalOffers: 0,
    pendingOffers: 0,
    acceptedOffers: 0,
    rejectedOffers: 0,
    totalBooked: 0,
    activeLoads: 0,
    completedLoads: 0,
    totalRevenue: 0,
    averageOfferAmount: 0
  };

  // Filter offers based on search and filters
  const filteredOffers = offers.filter(offer => {
    const matchesSearch = !searchTerm || 
      offer.load?.tm_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.load_rr_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.load?.origin_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.load?.destination_city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || offer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filter booked loads based on search and filters
  const filteredBookedLoads = bookedLoads.filter(load => {
    const matchesSearch = !searchTerm || 
      load.rr_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.origin_city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.destination_city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || load.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle offer modification
  const handleModifyOffer = (offer: LoadOffer) => {
    setSelectedOffer(offer);
    setModifyAmount((offer.offer_amount / 100).toString());
    setModifyNotes(offer.notes || "");
    setModifyDialogOpen(true);
  };

  // Handle offer withdrawal
  const handleWithdrawOffer = async (offerId: string) => {
    if (!confirm("Are you sure you want to withdraw this offer? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/carrier/offers/${offerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to withdraw offer');

      // Refresh offers data
      mutateOffers();
      alert("Offer withdrawn successfully");
    } catch (error: any) {
      alert(`Error withdrawing offer: ${error.message}`);
    }
  };

  // Handle counter-offer acceptance
  const handleAcceptCounterOffer = async (offer: LoadOffer) => {
    if (!confirm(`Are you sure you want to accept the counter-offer of ${formatMoney(offer.counter_amount || 0)}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/carrier/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_counter' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to accept counter-offer');

      mutateOffers();
      alert("Counter-offer accepted successfully!");
    } catch (error: any) {
      alert(`Error accepting counter-offer: ${error.message}`);
    }
  };

  // Handle counter-offer rejection
  const handleRejectCounterOffer = async (offer: LoadOffer) => {
    if (!confirm("Are you sure you want to reject the counter-offer? This will decline the load.")) {
      return;
    }

    try {
      const response = await fetch(`/api/carrier/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject_counter' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reject counter-offer');

      mutateOffers();
      alert("Counter-offer rejected successfully!");
    } catch (error: any) {
      alert(`Error rejecting counter-offer: ${error.message}`);
    }
  };

  // Handle counter-offer counter (counter back)
  const handleCounterCounterOffer = (offer: LoadOffer) => {
    setSelectedOffer(offer);
    setModifyAmount(((offer.counter_amount || 0) / 100).toString());
    setModifyNotes(offer.notes || "");
    setModifyDialogOpen(true);
  };

  // Handle offer deletion
  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm("Are you sure you want to delete this offer? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/carrier/offers/${offerId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete offer');

      // Refresh offers data
      mutateOffers();
      alert("Offer deleted successfully");
    } catch (error: any) {
      alert(`Error deleting offer: ${error.message}`);
    }
  };

  // Submit offer modification
  const handleSubmitModification = async () => {
    if (!selectedOffer || !modifyAmount) return;

    setIsModifying(true);
    try {
      const response = await fetch(`/api/carrier/offers/${selectedOffer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          offerAmount: modifyAmount,
          notes: modifyNotes
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to modify offer');

      // Refresh offers data
      mutateOffers();
      setModifyDialogOpen(false);
      setSelectedOffer(null);
      setModifyAmount("");
      setModifyNotes("");
      alert("Offer updated successfully");
    } catch (error: any) {
      alert(`Error updating offer: ${error.message}`);
    } finally {
      setIsModifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-400",
      accepted: "bg-green-500/20 text-green-300 border-green-400",
      rejected: "bg-red-500/20 text-red-300 border-red-400",
      countered: "bg-blue-500/20 text-blue-300 border-blue-400",
      withdrawn: "bg-gray-500/20 text-gray-300 border-gray-400",
      assigned: "bg-purple-500/20 text-purple-300 border-purple-400",
      picked_up: "bg-blue-500/20 text-blue-300 border-blue-400",
      in_transit: "bg-orange-500/20 text-orange-300 border-orange-400",
      delivered: "bg-green-500/20 text-green-300 border-green-400",
      completed: "bg-gray-500/20 text-gray-300 border-gray-400"
    };
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.pending}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: AlertCircle,
      accepted: CheckCircle,
      rejected: XCircle,
      countered: AlertCircle,
      assigned: Package,
      picked_up: Truck,
      in_transit: Truck,
      delivered: CheckCircle,
      completed: CheckCircle
    };
    
    const Icon = icons[status as keyof typeof icons] || AlertCircle;
    return <Icon className="w-4 h-4" />;
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">Please sign in to view your loads</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Loads Console</h2>
          <p className="text-muted-foreground">Manage your offers and booked loads</p>
        </div>
        <NotificationSystem />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Offers</p>
                <p className="text-2xl font-bold">{stats.totalOffers}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Avg: {formatMoney(stats.averageOfferAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Loads</p>
                <p className="text-2xl font-bold">{stats.activeLoads}</p>
              </div>
              <Truck className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.completedLoads} completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Offers</p>
                <p className="text-2xl font-bold">{stats.pendingOffers}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {stats.acceptedOffers} accepted
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                From {stats.activeLoads} loads
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters 
        onFiltersChange={setAdvancedFilters}
        initialFilters={advancedFilters}
      />

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            mutateOffers();
            mutateBooked();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="offers">My Offers</TabsTrigger>
          <TabsTrigger value="booked">Booked Loads</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Offers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Recent Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {offers.slice(0, 5).map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(offer.status)}
                        <div>
                          <p className="font-medium">#{offer.load?.tm_number || offer.load_rr_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {offer.load?.origin_city || 'N/A'}, {offer.load?.origin_state || 'N/A'} → {offer.load?.destination_city || 'N/A'}, {offer.load?.destination_state || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(offer.offer_amount)}</p>
                        {getStatusBadge(offer.status)}
                      </div>
                    </div>
                  ))}
                  {offers.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No offers yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Loads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Active Loads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bookedLoads.filter(load => ['assigned', 'picked_up', 'in_transit'].includes(load.status)).slice(0, 5).map((load) => (
                    <div key={load.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(load.status)}
                        <div>
                          <p className="font-medium">#{load.rr_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(load.revenue)}</p>
                        {getStatusBadge(load.status)}
                      </div>
                    </div>
                  ))}
                  {bookedLoads.filter(load => ['assigned', 'picked_up', 'in_transit'].includes(load.status)).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No active loads</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <div className="grid gap-4">
            {filteredOffers.map((offer) => (
              <Card key={offer.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">#{offer.load?.tm_number || offer.load_rr_number}</h3>
                        {getStatusBadge(offer.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Route</p>
                          <p className="font-medium">
                            {offer.load?.origin_city || 'N/A'}, {offer.load?.origin_state || 'N/A'} → {offer.load?.destination_city || 'N/A'}, {offer.load?.destination_state || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pickup</p>
                          <p className="font-medium">
                            {offer.load?.pickup_date || 'N/A'} {offer.load?.pickup_time || ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery</p>
                          <p className="font-medium">
                            {offer.load?.delivery_date || 'N/A'} {offer.load?.delivery_time || ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Equipment</p>
                          <p className="font-medium">{offer.load?.equipment || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-semibold text-lg">{formatMoney(offer.offer_amount)}</span>
                        </div>
                        {offer.counter_amount && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                            <span className="font-semibold text-lg text-blue-600">Counter: {formatMoney(offer.counter_amount)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span>{formatDistance(offer.total_miles)}</span>
                        </div>
                      </div>

                      {offer.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground">Notes</p>
                          <p className="text-sm">{offer.notes}</p>
                        </div>
                      )}

                      {offer.admin_notes && (
                        <div className="mb-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Admin Notes</p>
                          <p className="text-sm">{offer.admin_notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Submitted: {new Date(offer.created_at).toLocaleDateString()}</span>
                        {offer.updated_at !== offer.created_at && (
                          <>
                            <span>•</span>
                            <span>Updated: {new Date(offer.updated_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <LoadDetailsDialog load={offer.load} offer={offer} />
                      {offer.status === 'pending' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleModifyOffer(offer)}
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Modify
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleWithdrawOffer(offer.id)}
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Withdraw
                          </Button>
                        </>
                      )}
                      {offer.status === 'countered' && (
                        <>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleAcceptCounterOffer(offer)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Accept Counter
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRejectCounterOffer(offer)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject Counter
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCounterCounterOffer(offer)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Counter Back
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedOfferForMessage(offer.id);
                          setMessageConsoleOpen(true);
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredOffers.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Offers Found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search criteria"
                      : "Start by submitting offers on available loads"
                    }
                  </p>
                  <Button asChild>
                    <a href="/book-loads">Find Loads</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="booked" className="space-y-4">
          <div className="grid gap-4">
            {filteredBookedLoads.map((load) => (
              <Card key={load.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">#{load.rr_number}</h3>
                        {getStatusBadge(load.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Route</p>
                          <p className="font-medium">
                            {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pickup</p>
                          <p className="font-medium">
                            {load.pickup_date} {load.pickup_time}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery</p>
                          <p className="font-medium">
                            {load.delivery_date} {load.delivery_time}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Customer</p>
                          <p className="font-medium">{load.customer_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-semibold text-lg">{formatMoney(load.revenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span>{formatDistance(load.miles)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-500" />
                          <span>{load.equipment}</span>
                        </div>
                      </div>

                      {load.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground">Notes</p>
                          <p className="text-sm">{load.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Assigned: {new Date(load.assigned_at).toLocaleDateString()}</span>
                        </div>
                        {load.picked_up_at && (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <span>Picked up: {new Date(load.picked_up_at).toLocaleDateString()}</span>
                          </div>
                        )}
                        {load.delivered_at && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span>Delivered: {new Date(load.delivered_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <LoadDetailsDialog load={load} />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // TODO: Connect to offer message console
                          console.log('Open message console');
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      {load.status === 'assigned' && (
                        <Button size="sm">
                          <Truck className="w-4 h-4 mr-2" />
                          Start Load
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredBookedLoads.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Booked Loads</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search criteria"
                      : "Your booked loads will appear here once offers are accepted"
                    }
                  </p>
                  <Button asChild>
                    <a href="/book-loads">Find Loads</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-4">
          {bookedLoads.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Active Loads</h3>
                <p className="text-muted-foreground">
                  You don't have any active loads to track yet. Submit offers to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {bookedLoads.map((load) => {
                const isExpanded = expandedLoads.has(load.id);
                return (
                  <Card key={load.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5" />
                          Load {load.rr_number}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {load.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLoadExpansion(load.id)}
                            className="h-8 w-8 p-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        <EnhancedLoadLifecycleManager 
                          loadId={load.id} 
                          loadData={load}
                        />
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <LoadAnalytics stats={stats} offers={offers} bookedLoads={bookedLoads} />
        </TabsContent>
      </Tabs>

      {/* Modify Offer Dialog */}
      <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Offer</DialogTitle>
            <DialogDescription>
              Update your offer amount and notes for load #{selectedOffer?.tm_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modify-amount">Offer Amount ($)</Label>
              <Input
                id="modify-amount"
                type="number"
                step="0.01"
                min="0"
                value={modifyAmount}
                onChange={(e) => setModifyAmount(e.target.value)}
                placeholder="Enter offer amount"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="modify-notes">Notes (Optional)</Label>
              <Textarea
                id="modify-notes"
                value={modifyNotes}
                onChange={(e) => setModifyNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setModifyDialogOpen(false)}
                disabled={isModifying}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitModification}
                disabled={isModifying || !modifyAmount}
              >
                {isModifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Update Offer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Message Console */}
      <OfferMessageConsole
        offerId={selectedOfferForMessage || ''}
        isOpen={messageConsoleOpen}
        onClose={() => {
          setMessageConsoleOpen(false);
          setSelectedOfferForMessage(null);
        }}
      />
    </div>
  );
}
