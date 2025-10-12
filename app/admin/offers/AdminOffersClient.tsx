"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
    ArrowUpDown,
    Calendar,
    CheckCircle2,
    Clock,
    Crown,
    DollarSign,
    Filter,
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

interface Offer {
  id: number;
  load_rr_number: string;
  carrier_user_id: string;
  offer_amount: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  counter_amount?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'reject' | 'counter'>('accept');
  const [counterAmount, setCounterAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount">("newest");

  const { accentColor } = useAccentColor();
  const { theme } = useTheme();

  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };

  useEffect(() => {
    fetchOffers();
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchOffers, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await fetch('/api/offers');
      if (!response.ok) throw new Error('Failed to fetch offers');
      
      const data = await response.json();
      setOffers(data.offers || []);
    } catch (error) {
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
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
      fetchOffers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process offer');
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
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'countered': return <TrendingUp className="h-4 w-4" />;
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
    
    return matchesSearch && matchesStatus;
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            onClick={fetchOffers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Offers Tabs */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Pending ({pendingOffers.length})
          </TabsTrigger>
          <TabsTrigger value="processed" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Processed ({processedOffers.length})
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingOffers.map((offer) => (
                <Card key={offer.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-yellow-500">
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
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
    </div>
  );
}