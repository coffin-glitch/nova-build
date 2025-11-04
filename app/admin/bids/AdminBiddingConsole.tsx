"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatMoney, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Gavel,
  LayoutGrid,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Send,
  Star,
  Table as TableIcon,
  Target,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Helper function to safely parse stops data
const parseStops = (stops: string | string[] | null): string[] => {
  if (!stops) return [];
  if (Array.isArray(stops)) return stops;
  if (typeof stops === 'string') {
    try {
      const parsed = JSON.parse(stops);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      // If it's not valid JSON, treat it as a single location
      return [stops];
    }
  }
  return [];
};

// Bid Adjudication Console Component
function BidAdjudicationConsole({ bid, accentColor, onClose, onAwarded }: { 
  bid: TelegramBid | null; 
  accentColor: string; 
  onClose: () => void;
  onAwarded: () => void;
}) {
  const [bidDetails, setBidDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [bidsPerPage] = useState(5); // Show 5 bids per page

  const { data: bidData, error: bidDataError, mutate: mutateBidData } = useSWR(
    bid ? `/api/admin/bids/${bid.bid_number}/award` : null,
    fetcher,
    { refreshInterval: 30000 } // Reduced from 5s to 30s to prevent rate limiting
  );

  React.useEffect(() => {
    if (bidDataError) {
      console.error('[BidAdjudicationConsole] Error fetching bid data:', bidDataError);
    }
  }, [bidDataError]);

  React.useEffect(() => {
    if (bidData?.data) {
      console.log('[BidAdjudicationConsole] Bid data received:', {
        success: bidData.success,
        totalBids: bidData.data.bids?.length || 0,
        bids: bidData.data.bids,
        auction: bidData.data.auction?.bid_number,
        award: bidData.data.award
      });
      setBidDetails(bidData.data);
    } else if (bidData) {
      console.log('[BidAdjudicationConsole] Bid data (no data field):', bidData);
    }
  }, [bidData]);

  const handleAwardBid = async () => {
    if (!selectedWinner || !bid) return;

    setAwarding(true);
    try {
      const response = await fetch(`/api/admin/bids/${bid.bid_number}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          winnerUserId: selectedWinner,
          adminNotes: adminNotes.trim() || null
        })
      });

      const result = await response.json();

      console.log('[BidAdjudicationConsole] Award response:', result);

      if (result.success || result.ok) {
        // Show detailed success toast
        toast.success(`🎉 Bid #${bid.bid_number} awarded successfully!`, {
          description: `Winner: ${result.winnerName} - $${result.winnerAmount}`,
          duration: 5000,
        });
        
        // Create notifications for all carriers who bid on this auction
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bidNumber: bid.bid_number,
              winnerUserId: selectedWinner,
              winnerAmount: result.winnerAmount,
              winnerName: result.winnerName
            })
          });
        } catch (notificationError) {
          console.error('Failed to create notifications:', notificationError);
        }
        
        // Refresh the bid data to show the award summary
        mutateBidData();
        onAwarded();
        // Don't close immediately - let user see the award summary
      } else {
        toast.error(result.error || 'Failed to award bid');
      }
    } catch (error) {
      toast.error('Failed to award bid');
    } finally {
      setAwarding(false);
    }
  };

  const getBidStatus = (bid: any) => {
    if (bidDetails?.award) return 'awarded';
    if (bidDetails?.auction?.is_expired) return 'expired';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awarded': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'expired': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'active': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'awarded': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      case 'active': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Pagination logic for bids
  const totalBids = bidDetails?.bids?.length || 0;
  const totalPages = Math.ceil(totalBids / bidsPerPage);
  const startIndex = (currentPage - 1) * bidsPerPage;
  const endIndex = startIndex + bidsPerPage;
  const currentBids = bidDetails?.bids?.slice(startIndex, endIndex) || [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedWinner(null); // Clear selection when changing pages
  };

  if (!bid) return null;

  return (
    <Dialog open={!!bid} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 border-violet-500/30 backdrop-blur-xl flex flex-col">
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-violet-500/20 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-lg border border-violet-500/30">
              <Gavel className="w-5 h-5 text-violet-300" />
            </div>
            <span className="bg-gradient-to-r from-violet-200 to-purple-200 bg-clip-text text-transparent">
              Bid Adjudication Console
            </span>
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 px-2 py-1 text-xs">
              #{bid.bid_number}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
          {/* Auction Overview */}
          <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-600/30 backdrop-blur-sm hover:border-slate-500/50 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-lg border border-blue-500/30">
                  <Award className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-white">Auction Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                  <MapPin className="w-4 h-4 text-violet-300" />
                  <div>
                    <p className="text-xs text-slate-400">Route</p>
                    <p className="text-sm font-semibold text-white">{formatStops(parseStops(bid.stops))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                  <Navigation className="w-4 h-4 text-blue-300" />
                  <div>
                    <p className="text-xs text-slate-400">Distance</p>
                    <p className="text-sm font-semibold text-white">{formatDistance(bid.distance_miles)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                  {getStatusIcon(getBidStatus(bid))}
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <Badge className={`${getStatusColor(getBidStatus(bid))} font-medium text-xs`}>
                      {getBidStatus(bid).toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carrier Bids */}
          <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-600/30 backdrop-blur-sm hover:border-slate-500/50 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500/20 to-green-600/20 rounded-lg border border-emerald-500/30">
                  <Users className="w-4 h-4 text-emerald-300" />
                </div>
                <span className="text-white">Carrier Bids</span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-2 py-1 text-xs">
                  {totalBids} {totalBids === 1 ? 'Bid' : 'Bids'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!bidDetails ? (
                <div className="text-center py-8">
                  <div className="p-3 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">Loading...</h3>
                  <p className="text-slate-400 text-sm">Fetching carrier bids...</p>
                </div>
              ) : !bidDetails?.bids || bidDetails?.bids?.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-3 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">No Bids Yet</h3>
                  <p className="text-slate-400 text-sm">No carriers have placed bids on this auction.</p>
                  {bidDataError && (
                    <p className="text-red-400 text-xs mt-2">Error: {bidDataError.message || 'Failed to load bids'}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {currentBids.map((carrierBid: any, index: number) => (
                    <div
                      key={carrierBid.id}
                      className={`p-4 rounded-lg border transition-all duration-300 hover:scale-[1.01] ${
                        selectedWinner === carrierBid.supabase_user_id
                          ? 'border-violet-500/60 bg-gradient-to-r from-violet-500/10 to-purple-500/10 shadow-lg shadow-violet-500/10'
                          : bidDetails?.award?.supabase_winner_user_id === carrierBid.supabase_user_id
                          ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-500/10 to-green-500/10 shadow-lg shadow-emerald-500/10'
                          : 'border-slate-600/40 bg-gradient-to-r from-slate-700/30 to-slate-800/30 hover:border-slate-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              selectedWinner === carrierBid.supabase_user_id || bidDetails?.award?.supabase_winner_user_id === carrierBid.supabase_user_id
                                ? 'border-violet-400 bg-violet-500/20'
                                : 'border-slate-500 hover:border-violet-400'
                            }`}>
                              <input
                                type="radio"
                                id={`winner-${carrierBid.id}`}
                                name="winner"
                                value={carrierBid.supabase_user_id}
                                checked={selectedWinner === carrierBid.supabase_user_id}
                                onChange={(e) => setSelectedWinner(e.target.value)}
                                disabled={!!bidDetails?.award}
                                className="w-3 h-3 text-violet-500 focus:ring-violet-500/20"
                              />
                            </div>
                            <label htmlFor={`winner-${carrierBid.id}`} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <div>
                                  <h3 className="font-bold text-white text-base">
                                    {carrierBid.carrier_legal_name || carrierBid.carrier_company_name || 'Unknown Carrier'}
                                  </h3>
                                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                    <span>MC: {carrierBid.carrier_mc_number || 'N/A'}</span>
                                    <span>DOT: {carrierBid.carrier_dot_number || 'N/A'}</span>
                                    <span>Phone: {carrierBid.carrier_phone || 'N/A'}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1.5">
                                  {carrierBid.carrier_is_verified && (
                                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-1.5 py-0.5 text-xs">
                                      <Star className="w-2.5 h-2.5 mr-1" />
                                      Verified
                                    </Badge>
                                  )}
                                  {bidDetails?.award?.supabase_winner_user_id === carrierBid.supabase_user_id && (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 text-xs">
                                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                                      Winner
                                    </Badge>
                                  )}
                                  {startIndex + index === 0 && !bidDetails?.award && (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 text-xs">
                                      Lowest Bid
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white mb-0.5">{formatMoney(carrierBid.amount_cents)}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(carrierBid.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {carrierBid.notes && (
                        <div className="mt-3 p-2 bg-slate-700/30 rounded-lg border border-slate-600/30">
                          <p className="text-xs text-slate-300">
                            <strong className="text-white">Notes:</strong> {carrierBid.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-600/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all duration-300"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className={`w-8 h-8 p-0 text-xs ${
                              page === currentPage
                                ? 'bg-violet-500 hover:bg-violet-600 text-white'
                                : 'border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50'
                            } transition-all duration-300`}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all duration-300"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          {!bidDetails?.award && (
            <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-600/30 backdrop-blur-sm hover:border-slate-500/50 transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-lg border border-amber-500/30">
                    <Send className="w-4 h-4 text-amber-300" />
                  </div>
                  <span className="text-white">Admin Notes</span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-300 text-xs">Optional</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add any notes about this award decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[80px] bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all duration-300"
                />
              </CardContent>
            </Card>
          )}

          {/* Award Summary */}
          {bidDetails?.award && (
            <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-emerald-300">
                  <div className="p-1.5 bg-gradient-to-br from-emerald-500/20 to-green-600/20 rounded-lg border border-emerald-500/30">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  Award Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                      <p className="text-xs text-slate-400">Winner</p>
                      <p className="font-semibold text-white text-sm">{bidDetails.award.winner_legal_name || 'Unknown Carrier'}</p>
                      <p className="text-xs text-slate-400">MC: {bidDetails.award.winner_mc_number || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                      <p className="text-xs text-slate-400">Awarded Amount</p>
                      <p className="text-xl font-bold text-emerald-300">{formatMoney(bidDetails.award.winner_amount_cents)}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                      <p className="text-xs text-slate-400">Awarded At</p>
                      <p className="font-semibold text-white text-sm">{new Date(bidDetails.award.awarded_at).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                      <p className="text-xs text-slate-400">Awarded By</p>
                      <p className="font-semibold text-white text-sm">Admin - {bidDetails.award.awarded_by_name || 'System'}</p>
                    </div>
                  </div>
                  {bidDetails.award.admin_notes && (
                    <div className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-600/30">
                      <p className="text-xs text-slate-400 mb-1">Admin Notes</p>
                      <p className="text-white text-sm">{bidDetails.award.admin_notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all duration-300 px-4"
            >
              Close
            </Button>
            {!bidDetails?.award && bidDetails?.bids?.length > 0 && (
              <Button
                onClick={handleAwardBid}
                disabled={!selectedWinner || awarding}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg hover:shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed px-4"
              >
                {awarding ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Awarding...
                  </>
                ) : (
                  <>
                    <Award className="w-3 h-3 drop-shadow-sm" />
                    Award Bid
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Advanced Analytics Component
function AdvancedAnalytics({ accentColor }: { accentColor: string }) {
  const [timeframe, setTimeframe] = useState("30");
  const [analyticsType, setAnalyticsType] = useState("overview");

  const { data: analyticsData, mutate: mutateAnalytics, isLoading: analyticsLoading } = useSWR(
    `/api/admin/bid-analytics?timeframe=${timeframe}&action=${analyticsType}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const data = analyticsData?.data || {};
  const timeframeDays = analyticsData?.data?.timeframe?.days || 30;

  const renderOverview = () => {
    const overview = data.overview || {};
    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Auctions</p>
                  <p className="text-2xl font-bold">{overview.total_auctions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Bids</p>
                  <p className="text-2xl font-bold">{overview.total_carrier_bids || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Unique Carriers</p>
                  <p className="text-2xl font-bold">{overview.unique_carriers_bid || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bid</p>
                  <p className="text-2xl font-bold">{formatMoney(overview.avg_bid_amount || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Competition Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Bids per Auction:</span>
                <span className="font-semibold">{overview.avg_bids_per_auction_calc || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Single Bid Auctions:</span>
                <span className="font-semibold">{overview.single_bid_auctions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Competitive Auctions:</span>
                <span className="font-semibold">{overview.competitive_auctions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Bids per Auction:</span>
                <span className="font-semibold">{overview.max_bids_per_auction || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Financial Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Winnings:</span>
                <span className="font-semibold">{formatMoney(overview.total_winnings_value || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Winning Bid:</span>
                <span className="font-semibold">{formatMoney(overview.avg_winning_bid || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Bid:</span>
                <span className="font-semibold">{formatMoney(overview.min_bid_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Bid:</span>
                <span className="font-semibold">{formatMoney(overview.max_bid_amount || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderTrends = () => {
    const dailyTrends = data.dailyTrends || [];
    const hourlyTrends = data.hourlyTrends || [];
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Daily Trends (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dailyTrends.slice(0, 10).map((trend: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{new Date(trend.date).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">{trend.unique_carriers} carriers active</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{trend.auctions_created} auctions</p>
                    <p className="text-sm text-muted-foreground">{trend.bids_placed} bids</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Hourly Activity (Today)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {hourlyTrends.map((trend: any, index: number) => (
                <div key={index} className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="font-semibold">{trend.hour}:00</p>
                  <p className="text-sm text-muted-foreground">{trend.auctions_created} auctions</p>
                  <p className="text-sm text-muted-foreground">{trend.bids_placed} bids</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPerformance = () => {
    const distancePerformance = data.distancePerformance || [];
    const tagPerformance = data.tagPerformance || [];
    const timePerformance = data.timePerformance || [];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Performance by Distance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {distancePerformance.map((perf: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <span className="font-medium">{perf.distance_category}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{perf.auction_count} auctions</p>
                    <p className="text-xs text-muted-foreground">{perf.bid_count} bids</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Performance by Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timePerformance.map((perf: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <span className="font-medium">{perf.time_category}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{perf.auction_count} auctions</p>
                    <p className="text-xs text-muted-foreground">{perf.bid_count} bids</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Performance by Tag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tagPerformance.slice(0, 9).map((perf: any, index: number) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{perf.tag}</span>
                    <Badge variant="outline">{perf.auction_count}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>{perf.bid_count} bids • {perf.unique_carriers} carriers</p>
                    <p>Avg: {formatMoney(perf.avg_bid_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCarrierActivity = () => {
    const activityPatterns = data.activityPatterns || [];
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Active Carriers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityPatterns.slice(0, 15).map((carrier: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{carrier.company_name || carrier.legal_name}</p>
                      <p className="text-sm text-muted-foreground">MC: {carrier.mc_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{carrier.recent_bids} recent bids</p>
                    <p className="text-sm text-muted-foreground">{carrier.winning_bids} wins</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAuctionInsights = () => {
    const auctionInsights = data.auctionInsights || {};
    const topCompetitiveAuctions = data.topCompetitiveAuctions || [];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">No Bid Auctions</p>
                  <p className="text-2xl font-bold">{auctionInsights.no_bid_auctions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">High Competition</p>
                  <p className="text-2xl font-bold">{auctionInsights.high_competition_auctions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bid Spread</p>
                  <p className="text-2xl font-bold">{formatMoney(auctionInsights.avg_bid_spread || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Max Bids</p>
                  <p className="text-2xl font-bold">{auctionInsights.max_bids_per_auction || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Most Competitive Auctions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCompetitiveAuctions.slice(0, 10).map((auction: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">#{auction.bid_number}</p>
                      <p className="text-sm text-muted-foreground">{auction.tag} • {formatDistance(auction.distance_miles)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{auction.bid_count} bids</p>
                    <p className="text-sm text-muted-foreground">{auction.unique_carriers} carriers</p>
                    <p className="text-xs text-muted-foreground">Spread: {formatMoney(auction.highest_bid_amount - auction.winning_bid_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Analytics Controls */}
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className="text-xl font-semibold">Advanced Analytics</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Timeframe</label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Analytics Type</label>
            <Select value={analyticsType} onValueChange={setAnalyticsType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="trends">Trends</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="carrier_activity">Carrier Activity</SelectItem>
                <SelectItem value="auction_insights">Auction Insights</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Actions</label>
            <Button
              variant="outline"
              onClick={() => mutateAnalytics()}
              disabled={analyticsLoading}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Glass>

      {/* Analytics Content */}
      {analyticsLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Glass key={i} className="p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-6 bg-muted rounded w-1/2"></div>
              <div className="h-3 bg-muted rounded w-1/3"></div>
            </Glass>
          ))}
        </div>
      ) : (
        <>
          {analyticsType === "overview" && renderOverview()}
          {analyticsType === "trends" && renderTrends()}
          {analyticsType === "performance" && renderPerformance()}
          {analyticsType === "carrier_activity" && renderCarrierActivity()}
          {analyticsType === "auction_insights" && renderAuctionInsights()}
        </>
      )}
    </div>
  );
}

// Leaderboard Component
function CarrierLeaderboard({ accentColor }: { accentColor: string }) {
  const [timeframe, setTimeframe] = useState("30");
  const [sortBy, setSortBy] = useState("total_bids");
  const [limit, setLimit] = useState("20");
  const [viewMode, setViewMode] = useState<'individual' | 'grouped'>('individual');
  const [groupBy, setGroupBy] = useState<'mc' | 'dot'>('mc');
  const [displayMode, setDisplayMode] = useState<'card' | 'table'>('card');
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [showCarrierConsole, setShowCarrierConsole] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [showGroupConsole, setShowGroupConsole] = useState(false);
  
  // Fetch grouped data when viewMode is 'grouped'
  const { data: groupedData, mutate: mutateGrouped, isLoading: groupedLoading, isValidating: groupedValidating } = useSWR(
    viewMode === 'grouped' ? `/api/admin/carrier-leaderboard-grouped?timeframe=${timeframe}&sortBy=${sortBy}&limit=${limit}&groupBy=${groupBy}` : null,
    fetcher,
    {
      refreshInterval: 31500,
      keepPreviousData: true,
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      dedupingInterval: 15000,
      onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 5) return;
        const status = (error as any)?.status || 0;
        if (status === 404) return;
        const delay = Math.min(16000, 1000 * Math.pow(2, retryCount));
        setTimeout(() => revalidate({ retryCount }), delay);
      }
    }
  );

  const { data: leaderboardData, mutate: mutateLeaderboard, isLoading: leaderboardLoading, isValidating: leaderboardValidating } = useSWR(
    `/api/admin/carrier-leaderboard?timeframe=${timeframe}&sortBy=${sortBy}&limit=${limit}`,
    fetcher,
    {
      refreshInterval: 30000,
      keepPreviousData: true,
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      dedupingInterval: 15000,
      onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 5) return;
        const status = (error as any)?.status || 0;
        if (status === 404) return;
        const delay = Math.min(16000, 1000 * Math.pow(2, retryCount));
        setTimeout(() => revalidate({ retryCount }), delay);
      }
    }
  );

  const leaderboard = leaderboardData?.data?.leaderboard || [];
  const summary = leaderboardData?.data?.summary || {};
  const topPerformers = leaderboardData?.data?.topPerformers || [];
  const groups = groupedData?.data?.groups || [];

  // Helpers for Top Performers section
  const humanizeMetric = (metric: string) => {
    if (!metric) return '';
    const pretty = metric.replace(/_/g, ' ').trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  const iconForMetric = (metric: string) => {
    switch (metric) {
      case 'most_bids':
        return <Activity className="w-4 h-4 text-blue-500" />;
      case 'highest_win_rate':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'highest_avg_bid':
        return <ArrowUpRight className="w-4 h-4 text-fuchsia-500" />;
      case 'highest_revenue':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'best_avg_bid':
        return <ArrowDownRight className="w-4 h-4 text-purple-500" />;
      case 'most_wins':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      default:
        return <Star className="w-4 h-4 text-yellow-500" />;
    }
  };

  // Build standardized Individual Top Performers (match grouped count/metrics)
  const topPerformersIndividual: any[] = (() => {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) return [];
    const mostBids = [...leaderboard].sort((a: any, b: any) => (Number(b.total_bids) || 0) - (Number(a.total_bids) || 0))[0];
    const highestWin = [...leaderboard]
      .filter((c: any) => (Number(c.total_bids) || 0) > 0)
      .sort((a: any, b: any) => (Number(b.win_rate_percentage) || 0) - (Number(a.win_rate_percentage) || 0))[0];
    const mostRevenue = [...leaderboard]
      .sort((a: any, b: any) => (Number(b.total_revenue_cents) || 0) - (Number(a.total_revenue_cents) || 0))[0];
    const lowestAvgBid = [...leaderboard]
      .sort((a: any, b: any) => (Number(a.avg_bid_amount_cents) || Number.POSITIVE_INFINITY) - (Number(b.avg_bid_amount_cents) || Number.POSITIVE_INFINITY))[0];
    const highestAvgBid = [...leaderboard]
      .sort((a: any, b: any) => (Number(b.avg_bid_amount_cents) || Number.NEGATIVE_INFINITY) - (Number(a.avg_bid_amount_cents) || Number.NEGATIVE_INFINITY))[0];

    const out: any[] = [];
    if (mostBids) out.push({ metric: 'most_bids', company_name: mostBids.company_name || mostBids.legal_name, user_name: mostBids.user_name, contact_name: mostBids.contact_name, legal_name: mostBids.legal_name, full_name: mostBids.full_name, value: mostBids.total_bids || 0, unit: 'bids' });
    if (highestWin) out.push({ metric: 'highest_win_rate', company_name: highestWin.company_name || highestWin.legal_name, user_name: highestWin.user_name, contact_name: highestWin.contact_name, legal_name: highestWin.legal_name, full_name: highestWin.full_name, value: highestWin.win_rate_percentage || 0, unit: '%' });
    if (mostRevenue) out.push({ metric: 'highest_revenue', company_name: mostRevenue.company_name || mostRevenue.legal_name, user_name: mostRevenue.user_name, contact_name: mostRevenue.contact_name, legal_name: mostRevenue.legal_name, full_name: mostRevenue.full_name, value: mostRevenue.total_revenue_cents || 0, unit: 'cents' });
    if (lowestAvgBid) out.push({ metric: 'lowest_avg_bid', company_name: lowestAvgBid.company_name || lowestAvgBid.legal_name, user_name: lowestAvgBid.user_name, contact_name: lowestAvgBid.contact_name, legal_name: lowestAvgBid.legal_name, full_name: lowestAvgBid.full_name, value: lowestAvgBid.avg_bid_amount_cents || 0, unit: 'cents' });
    if (highestAvgBid) out.push({ metric: 'highest_avg_bid', company_name: highestAvgBid.company_name || highestAvgBid.legal_name, user_name: highestAvgBid.user_name, contact_name: highestAvgBid.contact_name, legal_name: highestAvgBid.legal_name, full_name: highestAvgBid.full_name, value: highestAvgBid.avg_bid_amount_cents || 0, unit: 'cents' });
    return out;
  })();

  // Build grouped top performers from grouped dataset
  const topPerformersGrouped: any[] = (() => {
    if (!Array.isArray(groups) || groups.length === 0) return [];
    const byMostBids = [...groups].sort((a: any, b: any) => (b.total_bids || 0) - (a.total_bids || 0))[0];
    const byHighestWin = [...groups].sort((a: any, b: any) => (b.win_rate_percentage || 0) - (a.win_rate_percentage || 0))[0];
    const byRevenue = [...groups].sort((a: any, b: any) => (b.total_revenue_cents || 0) - (a.total_revenue_cents || 0))[0];
    const byLowestAvgBid = [...groups]
      .filter((g: any) => typeof g.avg_bid_amount_cents === 'number')
      .sort((a: any, b: any) => (a.avg_bid_amount_cents || Infinity) - (b.avg_bid_amount_cents || Infinity))[0];
    const byHighestAvgBid = [...groups]
      .filter((g: any) => typeof g.avg_bid_amount_cents === 'number')
      .sort((a: any, b: any) => (b.avg_bid_amount_cents || -Infinity) - (a.avg_bid_amount_cents || -Infinity))[0];
    const results: any[] = [];
    if (byMostBids) results.push({ metric: 'most_bids', company_name: byMostBids.company_name || byMostBids.top_carrier_name || byMostBids.group_identifier, value: byMostBids.total_bids || 0, unit: 'bids' });
    if (byHighestWin) results.push({ metric: 'highest_win_rate', company_name: byHighestWin.company_name || byHighestWin.top_carrier_name || byHighestWin.group_identifier, value: byHighestWin.win_rate_percentage || 0, unit: '%' });
    if (byRevenue) results.push({ metric: 'highest_revenue', company_name: byRevenue.company_name || byRevenue.top_carrier_name || byRevenue.group_identifier, value: byRevenue.total_revenue_cents || 0, unit: 'cents' });
    if (byLowestAvgBid) results.push({ metric: 'lowest_avg_bid', company_name: byLowestAvgBid.company_name || byLowestAvgBid.top_carrier_name || byLowestAvgBid.group_identifier, value: byLowestAvgBid.avg_bid_amount_cents || 0, unit: 'cents' });
    if (byHighestAvgBid) results.push({ metric: 'highest_avg_bid', company_name: byHighestAvgBid.company_name || byHighestAvgBid.top_carrier_name || byHighestAvgBid.group_identifier, value: byHighestAvgBid.avg_bid_amount_cents || 0, unit: 'cents' });
    return results;
  })();

  const labelForMetric = (metric: string) => {
    switch (metric) {
      case 'most_bids': return 'Most bids';
      case 'highest_win_rate': return 'Highest win rate';
      case 'highest_revenue': return 'Most revenue';
      case 'highest_avg_bid': return 'Highest avg bid';
      case 'lowest_avg_bid': return 'Lowest avg bid';
      case 'best_avg_bid': return 'Best avg bid';
      default: return humanizeMetric(metric);
    }
  };

  const performerDisplayName = (p: any, context: 'individual' | 'grouped') => {
    if (context === 'individual') {
      return p.user_name || p.contact_name || p.full_name || p.legal_name || p.company_name || 'Unknown';
    }
    return p.company_name || p.legal_name || p.top_carrier_name || p.group_identifier || 'Unknown';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Award className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  const getSortLabel = (sort: string) => {
    switch (sort) {
      case 'total_bids': return 'Total Bids';
      case 'win_rate': return 'Win Rate';
      case 'avg_bid': return 'Avg Bid';
      case 'total_value': return 'Total Value';
      case 'recent_activity': return 'Recent Activity';
      case 'wins': return 'Total Wins';
      case 'revenue': return 'Total Revenue';
      case 'competitiveness': return 'Competitiveness';
      default: return 'Total Bids';
    }
  };

  // Activity helpers (individual cards)
  const getLastSeenDate = (carrier: any) => {
    const ts = carrier.last_bid_at || carrier.last_activity_at || null;
    return ts ? new Date(ts) : null;
  };

  const getDaysSince = (date: Date | null) => {
    if (!date) return Infinity;
    const ms = Date.now() - date.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
    };

  const isActiveNow = (carrier: any) => {
    const last = getLastSeenDate(carrier);
    return getDaysSince(last) <= 1; // active if within last day
  };

  const getConsecutiveDaysApprox = (carrier: any) => {
    const seven = Number(carrier.bids_last_7_days) || 0;
    if (seven >= 7) return 7;
    return isActiveNow(carrier) && seven > 0 ? 1 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Leaderboard Controls */}
      <Glass className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" style={{ color: accentColor }} />
            <h2 className="text-xl font-semibold">Carrier Leaderboard</h2>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === 'individual' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('individual')}
                className="h-8 px-3 text-xs"
              >
                <Users className="w-3 h-3 mr-1" />
                Individual
              </Button>
              <Button
                variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grouped')}
                className="h-8 px-3 text-xs"
              >
                <Building2 className="w-3 h-3 mr-1" />
                Grouped
              </Button>
            </div>
            
            {viewMode === 'grouped' && (
              <Select value={groupBy} onValueChange={(val: 'mc' | 'dot') => setGroupBy(val)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mc">By MC #</SelectItem>
                  <SelectItem value="dot">By DOT #</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            {/* Display Mode Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={displayMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('card')}
                className="h-8 w-8 p-0"
              >
                <LayoutGrid className="w-3 h-3" />
              </Button>
              <Button
                variant={displayMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('table')}
                className="h-8 w-8 p-0"
              >
                <TableIcon className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Timeframe</label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_bids">Total Bids</SelectItem>
                <SelectItem value="win_rate">Win Rate</SelectItem>
                <SelectItem value="avg_bid">Average Bid</SelectItem>
                <SelectItem value="total_value">Total Value</SelectItem>
                <SelectItem value="recent_activity">Recent Activity</SelectItem>
                <SelectItem value="wins">Total Wins</SelectItem>
                <SelectItem value="revenue">Total Revenue</SelectItem>
                <SelectItem value="competitiveness">Competitiveness</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Show Top</label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Actions</label>
            <Button
              variant="outline"
              onClick={() => {
                if (viewMode === 'individual') {
                  mutateLeaderboard();
                } else {
                  mutateGrouped();
                }
              }}
              disabled={leaderboardLoading || groupedLoading}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(leaderboardLoading || groupedLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Glass>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Glass className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Carriers</p>
                <p className="text-2xl font-bold">{summary.total_carriers || 0}</p>
              </div>
            </div>
        </Glass>
        
        <Glass className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Carriers</p>
                <p className="text-2xl font-bold">{summary.active_carriers || 0}</p>
              </div>
            </div>
        </Glass>
        
        <Glass className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Bids</p>
                <p className="text-2xl font-bold">{summary.total_bids_placed || 0}</p>
                {summary.recent_bids_placed !== undefined && summary.recent_bids_placed !== summary.total_bids_placed && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.recent_bids_placed} in timeframe
                  </p>
                )}
              </div>
            </div>
        </Glass>
        
        <Glass className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Bid</p>
                <p className="text-2xl font-bold">{formatMoney(summary.platform_avg_bid_cents || 0)}</p>
              </div>
            </div>
        </Glass>
      </div>

      {/* Top Performers */}
      {viewMode === 'individual' ? (
        topPerformersIndividual.length > 0 && (
          <Glass className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPerformersIndividual.map((performer: any, index: number) => (
                <Glass key={index} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {iconForMetric(performer.metric)}
                      <span className="text-sm font-medium">{labelForMetric(performer.metric)}</span>
                    </div>
                    <p className="font-semibold">{performerDisplayName(performer, 'individual')}</p>
                    <p className="text-2xl font-bold" style={{ color: accentColor }}>
                      {performer.unit === 'cents' ? formatMoney(performer.value) : 
                       performer.unit === '%' ? `${performer.value}%` :
                       `${performer.value} ${performer.unit}`}
                    </p>
                </Glass>
              ))}
            </div>
          </Glass>
        )
      ) : (
        topPerformersGrouped.length > 0 && (
          <Glass className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Performers (Groups)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPerformersGrouped.map((performer: any, index: number) => (
                <Glass key={index} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {iconForMetric(performer.metric)}
                      <span className="text-sm font-medium">{labelForMetric(performer.metric)}</span>
                    </div>
                    <p className="font-semibold">{performerDisplayName(performer, 'grouped')}</p>
                    <p className="text-2xl font-bold" style={{ color: accentColor }}>
                      {performer.unit === 'cents' ? formatMoney(performer.value) : 
                       performer.unit === '%' ? `${performer.value}%` :
                       `${performer.value} ${performer.unit}`}
                    </p>
                </Glass>
              ))}
            </div>
          </Glass>
        )
      )}

      {/* Leaderboard Table */}
      <Glass className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {viewMode === 'grouped' ? `Grouped by ${groupBy === 'mc' ? 'MC' : 'DOT'} - ` : ''}Leaderboard - {getSortLabel(sortBy)} ({timeframe} days)
          </h3>
        </div>
        
        {leaderboardLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        ) : (viewMode === 'individual' ? leaderboard.length === 0 : (groupedData?.data?.groups?.length || 0) === 0) ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Carrier Data</h3>
            <p className="text-muted-foreground">No carriers have placed bids in the selected timeframe.</p>
          </div>
        ) : viewMode === 'grouped' ? (
          // Grouped View
          displayMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold">Rank</th>
                    <th className="text-left p-4 text-sm font-semibold">{groupBy === 'mc' ? 'MC Number' : 'DOT Number'}</th>
                    <th className="text-left p-4 text-sm font-semibold">Carriers</th>
                    <th className="text-center p-4 text-sm font-semibold">Total Bids</th>
                    <th className="text-center p-4 text-sm font-semibold">Win Rate</th>
                    <th className="text-center p-4 text-sm font-semibold">Revenue</th>
                    <th className="text-center p-4 text-sm font-semibold">Top Carrier</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group: any, index: number) => (
                    <tr key={group.group_identifier} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="p-4">{getRankIcon(index)}</td>
                      <td className="p-4"><span className="font-semibold">{group.group_identifier}</span></td>
                      <td className="p-4"><Badge variant="secondary">{group.carriers_count} carriers</Badge></td>
                      <td className="p-4 text-center font-semibold">{group.total_bids}</td>
                      <td className="p-4 text-center font-semibold" style={{ color: accentColor }}>{group.win_rate_percentage}%</td>
                      <td className="p-4 text-center font-semibold text-green-600">{formatMoney(group.total_revenue_cents || 0)}</td>
                      <td className="p-4 text-center text-sm">{group.top_carrier_name || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group: any, index: number) => (
                <Glass key={group.group_identifier} className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">{getRankIcon(index)}</div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-lg truncate">{group.company_name || group.top_carrier_name || group.carriers?.[0]?.company_name || group.group_identifier}</h4>
                        <p className="text-xs text-muted-foreground truncate">{groupBy === 'mc' ? 'MC' : 'DOT'}: {group.group_identifier}</p>
                        <Badge variant="secondary" className="text-xs mt-1">{group.carriers_count} carriers</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground mb-1">Total Bids</p><p className="text-xl font-bold">{group.total_bids}</p></div>
                    <div className="p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground mb-1">Win Rate</p><p className="text-xl font-bold" style={{ color: accentColor }}>{group.win_rate_percentage}%</p></div>
                    <div className="p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground mb-1">Avg Bid</p><p className="text-xl font-bold">{formatMoney(group.avg_bid_amount_cents)}</p></div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"><p className="text-xs text-muted-foreground mb-1">Revenue</p><p className="text-xl font-bold text-green-600">{formatMoney(group.total_revenue_cents || 0)}</p></div>
                  </div>
                  {(() => {
                    const carriersInGroup = (Array.isArray(group.carriers) && group.carriers.length > 0)
                      ? group.carriers
                      : leaderboard.filter((c: any) => {
                          const id = groupBy === 'mc' ? (c.mc_number || '') : (c.dot_number || '');
                          return String(id) === String(group.group_identifier);
                        });
                    if (!carriersInGroup || carriersInGroup.length === 0) return null;

                    const getFromLeaderboard = (c: any) => {
                      if (!c?.supabase_user_id) return null;
                      return leaderboard.find((lc: any) => lc.supabase_user_id === c.supabase_user_id) || null;
                    };
                    const getName = (c: any) => {
                      const lc = getFromLeaderboard(c) || c;
                      return lc.contact_name || lc.legal_name || lc.full_name || lc.user_name || 'Unknown';
                    };
                    const getBids = (c: any) => {
                      const lc = getFromLeaderboard(c) || c;
                      return (lc.total_bids ?? lc.bids_count ?? 0) as number;
                    };
                    const getWinRate = (c: any) => {
                      const lc = getFromLeaderboard(c) || c;
                      return (lc.win_rate_percentage ?? lc.win_rate ?? 0) as number;
                    };

                    let mostBids = carriersInGroup[0];
                    let highestWin = carriersInGroup[0];
                    for (const c of carriersInGroup) {
                      if (getBids(c) > getBids(mostBids)) mostBids = c;
                      if (getWinRate(c) > getWinRate(highestWin)) highestWin = c;
                    }

                    return (
                      <div className="border-t border-border/30 pt-3">
                        <p className="text-xs text-muted-foreground mb-2">Top Carriers:</p>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></span>
                            <span className="text-muted-foreground">Most Bids:</span>
                            <span className="font-semibold">{getName(mostBids)}</span>
                            <span className="text-xs font-medium" style={{ color: accentColor }}>({getBids(mostBids)} bids)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></span>
                            <span className="text-muted-foreground">Highest Win Rate:</span>
                            <span className="font-semibold">{getName(highestWin)}</span>
                            <span className="text-xs font-medium" style={{ color: accentColor }}>({getWinRate(highestWin)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-end mt-3">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedGroup(group); setShowGroupConsole(true); }}>
                      <Eye className="w-4 h-4 mr-1" /> Details
                    </Button>
                  </div>
                </Glass>
              ))}
            </div>
          )
        ) : displayMode === 'table' ? (
          // Individual Table View
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold">Rank</th>
                  <th className="text-left p-4 text-sm font-semibold">Carrier</th>
                  <th className="text-center p-4 text-sm font-semibold">Total Bids</th>
                  <th className="text-center p-4 text-sm font-semibold">Win Rate</th>
                  <th className="text-center p-4 text-sm font-semibold">Avg Bid</th>
                  <th className="text-center p-4 text-sm font-semibold">Revenue</th>
                  <th className="text-center p-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((carrier: any, index: number) => (
                  <tr key={carrier.supabase_user_id} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="p-4"><div className="flex items-center justify-start w-8">{getRankIcon(index)}</div></td>
                    <td className="p-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{carrier.company_name || carrier.legal_name}</span>
                          {carrier.is_verified && <Badge variant="secondary" className="text-xs"><Star className="w-3 h-3 mr-1" />Verified</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">MC: {carrier.mc_number || 'N/A'} • Days Active: {Math.round(carrier.days_active || 0)}</div>
                      </div>
                    </td>
                    <td className="p-4 text-center"><span className="font-semibold">{carrier.total_bids}</span></td>
                    <td className="p-4 text-center"><span className="font-semibold" style={{ color: accentColor }}>{carrier.win_rate_percentage}%</span></td>
                    <td className="p-4 text-center"><span className="font-semibold">{formatMoney(carrier.avg_bid_amount_cents)}</span></td>
                    <td className="p-4 text-center"><span className="font-semibold text-green-600">{formatMoney(carrier.total_revenue_cents || 0)}</span></td>
                    <td className="p-4 text-center">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedCarrier(carrier.supabase_user_id); setShowCarrierConsole(true); }}>
                        <Eye className="w-4 h-4 mr-1" />Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Individual Card View - Enhanced
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaderboard.map((carrier: any, index: number) => (
              <Glass key={carrier.supabase_user_id} className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50 group">
                <div className="flex flex-col gap-4 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                        {getRankIcon(index)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 min-w-0">
                          <h4 className="font-semibold truncate">
                            {carrier.contact_name || carrier.company_name || carrier.legal_name}
                          </h4>
                          {carrier.is_verified && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              <Star className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {carrier.company_name || carrier.legal_name || 'Unknown Company'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-muted/40 border border-border/50">MC: {carrier.mc_number || 'N/A'}</span>
                          <span className="px-2 py-0.5 rounded bg-muted/40 border border-border/50">Fleet: {carrier.fleet_size || 1}</span>
                          {(() => {
                            const active = isActiveNow(carrier);
                            const last = getLastSeenDate(carrier);
                            const days = getDaysSince(last);
                            const streak = getConsecutiveDaysApprox(carrier);
                            if (active) {
                              return (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                                  Active · Streak: {streak}d
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600">
                                Inactive · {Number.isFinite(days) ? `${days}d` : 'Unknown'}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Highlight metric (based on sort) */}
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-muted-foreground">{getSortLabel(sortBy)}</p>
                      <p className="text-sm font-semibold" style={{ color: accentColor }}>
                        {sortBy === 'total_bids' && carrier.total_bids}
                        {sortBy === 'win_rate' && `${carrier.win_rate_percentage}%`}
                        {sortBy === 'avg_bid' && formatMoney(carrier.avg_bid_amount_cents)}
                        {sortBy === 'total_value' && formatMoney(carrier.total_bid_value_cents)}
                        {sortBy === 'recent_activity' && carrier.bids_last_7_days}
                        {sortBy === 'wins' && carrier.total_wins}
                        {sortBy === 'revenue' && formatMoney(carrier.total_revenue_cents || 0)}
                        {sortBy === 'competitiveness' && `${carrier.competitiveness_score || 0}%`}
                      </p>
                      {!isActiveNow(carrier) && (
                        <p className="text-[11px] text-muted-foreground mt-1">Last Seen: {(() => {
                          const d = getLastSeenDate(carrier);
                          return d ? d.toLocaleDateString() : 'N/A';
                        })()}</p>
                      )}
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div className="rounded-md bg-muted/30 p-2.5 text-center min-w-0">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Win Rate</p>
                      <p className="text-sm font-semibold whitespace-nowrap" style={{ color: accentColor }}>{carrier.win_rate_percentage}%</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2.5 text-center min-w-0">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Avg Bid</p>
                      <p className="font-semibold text-sm md:text-base leading-none whitespace-nowrap overflow-hidden text-ellipsis">{formatMoney(carrier.avg_bid_amount_cents)}</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2.5 text-center min-w-0">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Total Bids</p>
                      <p className="text-sm md:text-base font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{carrier.total_bids}</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2.5 text-center min-w-0">
                      <p className="text-[11px] text-muted-foreground mb-0.5">Bids (7d)</p>
                      <p className="text-sm md:text-base font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{carrier.bids_last_7_days || 0}</p>
                    </div>
                  </div>

                  {/* Secondary metrics row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-green-500/10 p-3 text-center border border-green-500/20">
                      <p className="text-[11px] text-muted-foreground mb-1">Revenue</p>
                      <p className="text-sm font-semibold text-green-600 whitespace-nowrap overflow-hidden text-ellipsis">{formatMoney(carrier.total_revenue_cents || 0)}</p>
                    </div>
                    <div className="rounded-md bg-muted/20 p-3 text-center">
                      <p className="text-[11px] text-muted-foreground mb-1">Competitiveness</p>
                      <p className="text-sm font-medium">{carrier.competitiveness_score || 0}%</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCarrier(carrier.supabase_user_id);
                        setShowCarrierConsole(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </Glass>
            ))}
          </div>
        )}
      </Glass>

      {/* Carrier Detail Console Dialog */}
      <Dialog open={showCarrierConsole} onOpenChange={setShowCarrierConsole}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Carrier Details</DialogTitle>
          </DialogHeader>
          <CarrierDetailConsole 
            carrierId={selectedCarrier} 
            accentColor={accentColor}
            onClose={() => {
              setShowCarrierConsole(false);
              setSelectedCarrier(null);
            }}
          />
        </DialogContent>
      </Dialog>
      {/* Group Detail Console Dialog */}
      <Dialog open={showGroupConsole} onOpenChange={setShowGroupConsole}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Group Details</DialogTitle>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-6 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Building2 className="w-5 h-5" style={{ color: accentColor }} />
                    {selectedGroup.company_name || selectedGroup.top_carrier_name || selectedGroup.carriers?.[0]?.company_name || selectedGroup.group_identifier}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {groupBy === 'mc' ? 'MC' : 'DOT'}: {selectedGroup.group_identifier}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowGroupConsole(false); setSelectedGroup(null); }}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Glass className="p-4"><p className="text-xs text-muted-foreground">Total Bids</p><p className="text-2xl font-bold">{selectedGroup.total_bids || 0}</p></Glass>
                <Glass className="p-4"><p className="text-xs text-muted-foreground">Win Rate</p><p className="text-2xl font-bold" style={{ color: accentColor }}>{selectedGroup.win_rate_percentage || 0}%</p></Glass>
                <Glass className="p-4"><p className="text-xs text-muted-foreground">Avg Bid</p><p className="text-2xl font-bold">{formatMoney(selectedGroup.avg_bid_amount_cents || 0)}</p></Glass>
                <Glass className="p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-green-600">{formatMoney(selectedGroup.total_revenue_cents || 0)}</p></Glass>
              </div>

              <GroupCarriersTable 
                selectedGroup={selectedGroup}
                groupBy={groupBy}
                accentColor={accentColor}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Carrier Detail Console Component
function CarrierDetailConsole({ 
  carrierId, 
  accentColor, 
  onClose 
}: { 
  carrierId: string | null; 
  accentColor: string;
  onClose: () => void;
}) {
  const { data: carrierData, isLoading } = useSWR(
    carrierId ? `/api/admin/carrier-leaderboard?carrierId=${carrierId}` : null,
    fetcher
  );

  const carrier = carrierData?.data?.leaderboard?.[0] || null;

  if (!carrierId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentColor }}></div>
      </div>
    );
  }

  if (!carrier) {
    return (
      <DialogHeader>
        <DialogTitle>Carrier Not Found</DialogTitle>
      </DialogHeader>
    );
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: accentColor }} />
            {carrier.company_name || carrier.legal_name}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </DialogHeader>

      <div className="space-y-6 mt-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Glass className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total Bids</span>
            </div>
            <p className="text-2xl font-bold">{carrier.total_bids || 0}</p>
            {carrier.bids_in_timeframe !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">{carrier.bids_in_timeframe} recent</p>
            )}
          </Glass>

          <Glass className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Win Rate</span>
            </div>
            <p className="text-2xl font-bold">{carrier.win_rate_percentage || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">{carrier.total_wins || 0} wins</p>
          </Glass>

          <Glass className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Avg Bid</span>
            </div>
            <p className="text-2xl font-bold">{formatMoney(carrier.avg_bid_amount_cents || 0)}</p>
          </Glass>

          <Glass className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatMoney(carrier.total_revenue_cents || 0)}
            </p>
          </Glass>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Glass className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity Metrics
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days Active:</span>
                <span className="font-medium">{Math.round(carrier.days_active || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bids Last 7 Days:</span>
                <span className="font-medium">{carrier.bids_last_7_days || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bids Last 24 Hours:</span>
                <span className="font-medium">{carrier.bids_last_24_hours || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  Competitiveness
                  <Info className="w-3.5 h-3.5 text-muted-foreground/70" title="Estimated percent competitiveness based on recent bidding performance: mix of win rate, proximity of bids to winning prices, and activity in the selected timeframe." />
                </span>
                <span className="font-medium">{carrier.competitiveness_score || 0}%</span>
              </div>
            </div>
          </Glass>

          <Glass className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Company Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">MC Number:</span>
                <span className="font-medium">{carrier.mc_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DOT Number:</span>
                <span className="font-medium">{carrier.dot_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Bid:</span>
                <span className="font-medium">
                  {carrier.first_bid_at ? new Date(carrier.first_bid_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Bid:</span>
                <span className="font-medium">
                  {carrier.last_bid_at ? new Date(carrier.last_bid_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </Glass>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
}

// Group carriers table with full MC/DOT match using wide timeframe fallback
function GroupCarriersTable({ selectedGroup, groupBy, accentColor }: { selectedGroup: any; groupBy: 'mc' | 'dot'; accentColor: string; }) {
  // Fetch a wide individual leaderboard to ensure we have all carriers if API didn't include them
  const { data: allLeaderboardData } = useSWR(
    selectedGroup ? `/api/admin/carrier-leaderboard?timeframe=3650&limit=1000` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const wideLeaderboard = allLeaderboardData?.data?.leaderboard || [];

  // Always derive carriers from wide individual leaderboard to ensure per-user stats and names
  const carriersInGroup = wideLeaderboard.filter((c: any) => {
    const id = groupBy === 'mc' ? (c.mc_number || '') : (c.dot_number || '');
    return String(id) === String(selectedGroup?.group_identifier);
  });

  if (!selectedGroup) return null;

  if (!allLeaderboardData) {
    return (
      <Glass className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: accentColor }}></div>
          Loading carriers...
        </div>
      </Glass>
    );
  }

  if (carriersInGroup.length === 0) {
    return (
      <Glass className="p-4">
        <div className="text-sm text-muted-foreground">No carriers found for this {groupBy.toUpperCase()}.</div>
      </Glass>
    );
  }

  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Carriers</h4>
        <span className="text-xs text-muted-foreground">{carriersInGroup.length} total</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 text-sm font-semibold">Carrier</th>
              <th className="text-center p-3 text-sm font-semibold">Total Bids</th>
              <th className="text-center p-3 text-sm font-semibold">Win Rate</th>
              <th className="text-center p-3 text-sm font-semibold">Avg Bid</th>
              <th className="text-center p-3 text-sm font-semibold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {carriersInGroup.map((c: any, i: number) => (
              <tr key={(c.supabase_user_id || c.company_name || i) + ''} className="border-t border-border/30">
                <td className="p-3">
                  <span className="font-semibold">{c.contact_name || c.legal_name || c.full_name || c.user_name || 'Unknown Carrier'}</span>
                </td>
                <td className="p-3 text-center font-semibold">{c.total_bids ?? c.bids_count ?? 0}</td>
                <td className="p-3 text-center font-semibold" style={{ color: accentColor }}>{c.win_rate_percentage ?? c.win_rate ?? 0}%</td>
                <td className="p-3 text-center font-semibold">{formatMoney(c.avg_bid_amount_cents ?? c.avg_bid_cents ?? 0)}</td>
                <td className="p-3 text-center font-semibold text-green-600">{formatMoney(c.total_revenue_cents ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Glass>
  );
}

export function AdminBiddingConsole() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [showExpired, setShowExpired] = useState(true); // Default to showing expired for admin
  const [sortBy, setSortBy] = useState<"distance" | "time-remaining" | "pickup-time" | "delivery-time" | "state" | "received-time" | "bid-count">("received-time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [showBidDetails, setShowBidDetails] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState("bids");
  const [adjudicationBid, setAdjudicationBid] = useState<TelegramBid | null>(null);
  const [showAdminSetup, setShowAdminSetup] = useState(false);

  const { accentColor } = useAccentColor();

  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=true`,
    fetcher,
    {
      refreshInterval: 5000
    }
  );

  // Fetch data for analytics regardless of showExpired filter
  const { data: activeData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=true`,
    fetcher,
    { refreshInterval: 30000 } // Reduced from 5s to 30s to prevent rate limiting
  );

  const { data: expiredData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=true`,
    fetcher,
    { refreshInterval: 30000 } // Reduced from 5s to 30s to prevent rate limiting
  );

  const bids = data?.data || [];
  const activeBidsAll = activeData?.data || [];
  const expiredBidsAll = expiredData?.data || [];
  
  // Calculate today's counts properly
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Debug logging
  console.log('AdminBiddingConsole - data:', data);
  console.log('AdminBiddingConsole - bids:', bids);
  console.log('AdminBiddingConsole - bids.length:', bids.length);

  // Filter bids based on showExpired toggle
  let filteredBids = bids.filter((bid: TelegramBid) => {
    // Apply date filtering based on showExpired mode
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    
    // If showing active bids, only show today's bids
    if (!showExpired) {
      if (bidDate !== today) return false;
    }
    // If showing expired bids, we'll show all expired bids (the API already filtered by is_archived=false and archived_at IS NULL)
    
    // Apply search and tag filters
    if (q && !bid.bid_number.toLowerCase().includes(q.toLowerCase())) return false;
    if (tag && !bid.tag?.toLowerCase().includes(tag.toLowerCase())) return false;
    
    // Apply status filter
    if (statusFilter === 'active' && bid.is_expired) return false;
    if (statusFilter === 'expired' && !bid.is_expired) return false;
    
    return true;
  });

  // Apply sorting
  filteredBids = [...filteredBids].sort((a: TelegramBid, b: TelegramBid) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "distance":
        comparison = (a.distance_miles || 0) - (b.distance_miles || 0);
        break;
      case "time-remaining":
        // Only available for active bids
        if (!showExpired) {
          comparison = (a.time_left_seconds || 0) - (b.time_left_seconds || 0);
        } else {
          // For expired bids, use expires_at_25 as fallback
          const aExpiresAt = a.expires_at_25 ? new Date(a.expires_at_25).getTime() : new Date(a.received_at).getTime() + (25 * 60 * 1000);
          const bExpiresAt = b.expires_at_25 ? new Date(b.expires_at_25).getTime() : new Date(b.received_at).getTime() + (25 * 60 * 1000);
          comparison = aExpiresAt - bExpiresAt;
        }
        break;
      case "pickup-time":
        comparison = new Date(a.pickup_timestamp || 0).getTime() - new Date(b.pickup_timestamp || 0).getTime();
        break;
      case "delivery-time":
        comparison = new Date(a.delivery_timestamp || 0).getTime() - new Date(b.delivery_timestamp || 0).getTime();
        break;
      case "state":
        comparison = (a.tag || "").localeCompare(b.tag || "");
        break;
      case "received-time":
        // For expired bids, sort by expires_at_25 (when they expired) to match API sorting
        // For active bids, sort by received_at (when they were received)
        if (showExpired) {
          const aExpiresAt = a.expires_at_25 ? new Date(a.expires_at_25).getTime() : new Date(a.received_at).getTime() + (25 * 60 * 1000);
          const bExpiresAt = b.expires_at_25 ? new Date(b.expires_at_25).getTime() : new Date(b.received_at).getTime() + (25 * 60 * 1000);
          comparison = aExpiresAt - bExpiresAt;
        } else {
          comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
        }
        break;
      case "bid-count":
        comparison = (a.bids_count || 0) - (b.bids_count || 0);
        break;
      default:
        // Default to received-time sorting
        if (showExpired) {
          const aExpiresAt = a.expires_at_25 ? new Date(a.expires_at_25).getTime() : new Date(a.received_at).getTime() + (25 * 60 * 1000);
          const bExpiresAt = b.expires_at_25 ? new Date(b.expires_at_25).getTime() : new Date(b.received_at).getTime() + (25 * 60 * 1000);
          comparison = aExpiresAt - bExpiresAt;
        } else {
          comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
        }
    }
    
    // Apply sort direction
    return sortDirection === "desc" ? -comparison : comparison;
  });
  
  // Get all bids for today (regardless of showExpired filter)
  const todaysBids = bids.filter((bid: TelegramBid) => {
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    return bidDate === today;
  });

  // Analytics calculations - show stats based on current view mode
  const todaysActiveBids = activeBidsAll.filter((b: TelegramBid) => {
    const bidDate = new Date(b.received_at).toISOString().split('T')[0];
    return bidDate === today && !b.is_expired;
  });
  
  const todaysExpiredBids = expiredBidsAll.filter((b: TelegramBid) => {
    const bidDate = new Date(b.received_at).toISOString().split('T')[0];
    return bidDate === today;
  });
  
  // If showing active bids, show only active bid stats (hide expired)
  // If showing expired bids, show all expired stats
  const analytics = showExpired ? {
    totalBids: expiredBidsAll.length, // All expired bids
    activeBids: todaysActiveBids.length, // Today's active bids
    expiredBids: expiredBidsAll.length, // All expired bids
    totalCarrierBids: expiredBidsAll.reduce((sum: number, b: TelegramBid) => sum + (Number(b.bids_count) || 0), 0)
  } : {
    totalBids: todaysActiveBids.length, // Only today's active bids
    activeBids: todaysActiveBids.length, // Only today's active bids
    expiredBids: 0, // Don't show expired count when viewing active bids
    totalCarrierBids: todaysActiveBids.reduce((sum: number, b: TelegramBid) => sum + (Number(b.bids_count) || 0), 0)
  };

  const handleArchiveBid = async (bidNumber: string) => {
    try {
      const response = await fetch('/api/archive-bids', { method: 'GET' });
      if (response.ok) {
        toast.success(`Bid ${bidNumber} archived successfully`);
        mutate();
      } else {
        toast.error('Failed to archive bid');
      }
    } catch (error) {
      toast.error('Failed to archive bid');
    }
  };

  const handleDeleteBid = async (bidNumber: string) => {
    if (!confirm(`Are you sure you want to delete bid ${bidNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/bids/${encodeURIComponent(bidNumber)}`, { 
        method: 'DELETE' 
      });
      if (response.ok) {
        toast.success(`Bid ${bidNumber} deleted successfully`);
        mutate();
      } else {
        toast.error('Failed to delete bid');
      }
    } catch (error) {
      toast.error('Failed to delete bid');
    }
  };

  const handleAdminSetup = async () => {
    try {
      const response = await fetch('/api/clerk-roles?action=make-admin', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success("Admin role set successfully! Please refresh the page.");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(data.error || "Failed to set admin role");
      }
    } catch (error) {
      console.error("Error setting admin role:", error);
      toast.error("Failed to set admin role");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <Glass className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/admin/archive-bids', '_blank')}
              className="flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              Archive Bids
            </Button>
            <Button
              onClick={() => mutate()}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Glass>

      <div className="space-y-6">
        {/* Analytics Dashboard */}
        {showAnalytics && (
          <Glass className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Glass className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-blue-500 rounded"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Auctions</p>
                    <p className="text-2xl font-bold">{analytics.totalBids}</p>
                  </div>
                </div>
              </Glass>
              
              <Glass className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{analytics.activeBids}</p>
                  </div>
                </div>
              </Glass>
              
              <Glass className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-purple-500 rounded"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bids</p>
                    <p className="text-2xl font-bold">{analytics.totalCarrierBids}</p>
                  </div>
                </div>
              </Glass>
              
              <Glass className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-red-500 rounded"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expired</p>
                    <p className="text-2xl font-bold">{analytics.expiredBids}</p>
                  </div>
                </div>
              </Glass>
            </div>
          </Glass>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bids" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Live Bids
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Carrier Leaderboard
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Advanced Analytics
            </TabsTrigger>
          </TabsList>

          {/* Live Bids Tab */}
          <TabsContent value="bids" className="space-y-6">
            {/* Filters and Controls */}
            <Glass className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Bid number..."
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Tag Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">State/Tag</label>
                  <Input
                    value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase())}
                    placeholder="State tag (e.g. GA)"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Status</label>
                  <select
                    className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'expired')}
                  >
                    <option value="all">All Bids</option>
                    <option value="active">Active Only</option>
                    <option value="expired">Expired Only</option>
                  </select>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Stats</label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {analytics.activeBids} Active
                    </Badge>
                    <Badge variant="outline">
                      {analytics.expiredBids} Expired
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Sort Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/40">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sort By</label>
                  <Select 
                    value={sortBy} 
                    onValueChange={(value) => setSortBy(value as typeof sortBy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Distance (Miles)</SelectItem>
                      {!showExpired && <SelectItem value="time-remaining">Time Remaining</SelectItem>}
                      <SelectItem value="pickup-time">Pickup Time</SelectItem>
                      <SelectItem value="delivery-time">Delivery Time</SelectItem>
                      <SelectItem value="state">State/Tag</SelectItem>
                      <SelectItem value="received-time">
                        {showExpired ? "Time Expired" : "Time Received"}
                      </SelectItem>
                      <SelectItem value="bid-count">Bid Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Direction</label>
                  <Select 
                    value={sortDirection} 
                    onValueChange={(value) => setSortDirection(value as "asc" | "desc")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant={showExpired ? "default" : "outline"}
                    onClick={() => setShowExpired(!showExpired)}
                    style={showExpired ? {
                      backgroundColor: accentColor,
                      color: '#ffffff'
                    } : {}}
                    className="w-full"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {showExpired ? "Hide Expired" : "Show Expired"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                <div className="text-sm text-muted-foreground">
                  {showExpired 
                    ? `Showing ${filteredBids.length} expired bid${filteredBids.length !== 1 ? 's' : ''} (pending archive)`
                    : `Showing ${filteredBids.length} active bid${filteredBids.length !== 1 ? 's' : ''}`
                  }
                </div>
              </div>
            </Glass>

            {/* Bids Display */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Glass key={i} className="p-6 space-y-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-6 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                  </Glass>
                ))}
              </div>
            ) : filteredBids.length === 0 ? (
              <Glass className="p-12 text-center">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                {!showExpired && todaysBids.filter((b: TelegramBid) => !b.is_expired).length === 0 ? (
                  <>
                    <h3 className="text-xl font-semibold text-foreground mb-2">No Active Bids</h3>
                    <p className="text-muted-foreground">
                      Last bid seen: {todaysBids.length > 0 
                        ? new Date(todaysBids[todaysBids.length - 1]?.received_at).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })
                        : 'None'
                      }
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold text-foreground mb-2">No Bids Found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters or check back later.</p>
                  </>
                )}
              </Glass>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBids.map((bid: TelegramBid) => (
                  <Glass key={bid.bid_number} className="p-6 space-y-4 hover:shadow-card transition-all duration-300 hover:-translate-y-1">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-2"
                          style={{
                            backgroundColor: `${accentColor}15`,
                            color: accentColor,
                            borderColor: `${accentColor}40`
                          }}
                        >
                          #{bid.bid_number}
                        </Badge>
                        {bid.tag && (
                          <Badge variant="secondary">
                            {bid.tag}
                          </Badge>
                        )}
                        {bid.is_expired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="default" style={{ backgroundColor: accentColor }}>
                            Active
                          </Badge>
                        )}
                      </div>
                      <Countdown
                        expiresAt={bid.expires_at_25}
                        variant={bid.is_expired ? "expired" : bid.time_left_seconds <= 300 ? "urgent" : "default"}
                      />
                    </div>

                    {/* Route Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{formatStops(parseStops(bid.stops))}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Truck className="w-4 h-4" />
                        <span className="text-sm">{formatDistance(bid.distance_miles)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Pickup: {formatPickupDateTime(bid.pickup_timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm">{formatStopCount(parseStops(bid.stops))}</span>
                      </div>
                    </div>

                    {/* Bidding Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Carrier Bids:</span>
                        <span className="font-medium">{bid.bids_count || 0}</span>
                      </div>
                  {bid.lowest_amount_cents && bid.lowest_amount_cents > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lowest Bid:</span>
                      <span className="font-medium text-green-600">{formatMoney(bid.lowest_amount_cents)}</span>
                    </div>
                  )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {bid.is_expired ? "Auction Closed" : "Bidding Open"}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBid(bid);
                              setShowBidDetails(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {bid.bids_count && bid.bids_count > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAdjudicationBid(bid)}
                              className="flex items-center gap-1"
                              style={{ 
                                borderColor: accentColor,
                                color: accentColor 
                              }}
                            >
                              <Gavel className="w-4 h-4 mr-1" />
                              Adjudicate
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBid(bid.bid_number)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Glass>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Carrier Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <CarrierLeaderboard accentColor={accentColor} />
          </TabsContent>

          {/* Advanced Analytics Tab */}
          <TabsContent value="analytics">
            <AdvancedAnalytics accentColor={accentColor} />
          </TabsContent>
        </Tabs>

        {/* Bid Adjudication Console */}
        <BidAdjudicationConsole 
          bid={adjudicationBid}
          accentColor={accentColor}
          onClose={() => setAdjudicationBid(null)}
          onAwarded={() => mutate()}
        />

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
                    <p className="text-lg font-semibold">Pickup: {formatPickupDateTime(selectedBid.pickup_timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                    <p className="text-lg font-semibold">Delivery: {formatPickupDateTime(selectedBid.delivery_timestamp)}</p>
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

                {/* Bidding Information */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Auction Information</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Current Bids</label>
                      <p className="text-lg font-semibold">{selectedBid.bids_count || 0}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-lg font-semibold">
                        {selectedBid.is_expired ? 'Auction Closed' : 'Bidding Open'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Time Remaining</label>
                      <div className="flex items-center gap-2">
                        <Countdown
                          expiresAt={selectedBid.expires_at_25}
                          variant={selectedBid.is_expired ? "expired" : selectedBid.time_left_seconds <= 300 ? "urgent" : "default"}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Lowest Bid</label>
                      <p className="text-lg font-semibold text-green-600">
                        {selectedBid.lowest_amount_cents && selectedBid.lowest_amount_cents > 0 ? formatMoney(selectedBid.lowest_amount_cents) : 'No bids yet'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Source Information */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Source Information</h3>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Received At</label>
                      <p className="text-lg font-semibold">{formatPickupDateTime(selectedBid.received_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowBidDetails(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => handleDeleteBid(selectedBid.bid_number)}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Bid
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}