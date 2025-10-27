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
    Archive,
    Award,
    BarChart3,
    Calendar,
    CheckCircle,
    Clock,
    Crown,
    Eye,
    Filter,
    Gavel,
    MapPin,
    Navigation,
    RefreshCw,
    Search,
    Send,
    Star,
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

  const { data: bidData, mutate: mutateBidData } = useSWR(
    bid ? `/api/admin/bids/${bid.bid_number}/award` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  React.useEffect(() => {
    if (bidData?.data) {
      setBidDetails(bidData.data);
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

      if (result.success) {
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
        
        onAwarded();
        onClose();
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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 border-violet-500/30 backdrop-blur-xl">
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-violet-500/20">
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

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
              {bidDetails?.bids?.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-3 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">No Bids Yet</h3>
                  <p className="text-slate-400 text-sm">No carriers have placed bids on this auction.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentBids.map((carrierBid: any, index: number) => (
                    <div
                      key={carrierBid.id}
                      className={`p-4 rounded-lg border transition-all duration-300 hover:scale-[1.01] ${
                        selectedWinner === carrierBid.clerk_user_id
                          ? 'border-violet-500/60 bg-gradient-to-r from-violet-500/10 to-purple-500/10 shadow-lg shadow-violet-500/10'
                          : bidDetails?.award?.winner_user_id === carrierBid.clerk_user_id
                          ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-500/10 to-green-500/10 shadow-lg shadow-emerald-500/10'
                          : 'border-slate-600/40 bg-gradient-to-r from-slate-700/30 to-slate-800/30 hover:border-slate-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              selectedWinner === carrierBid.clerk_user_id || bidDetails?.award?.winner_user_id === carrierBid.clerk_user_id
                                ? 'border-violet-400 bg-violet-500/20'
                                : 'border-slate-500 hover:border-violet-400'
                            }`}>
                              <input
                                type="radio"
                                id={`winner-${carrierBid.id}`}
                                name="winner"
                                value={carrierBid.clerk_user_id}
                                checked={selectedWinner === carrierBid.clerk_user_id}
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
                                  {bidDetails?.award?.winner_user_id === carrierBid.clerk_user_id && (
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

  const { data: leaderboardData, mutate: mutateLeaderboard, isLoading: leaderboardLoading } = useSWR(
    `/api/admin/carrier-leaderboard?timeframe=${timeframe}&sortBy=${sortBy}&limit=${limit}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const leaderboard = leaderboardData?.data?.leaderboard || [];
  const summary = leaderboardData?.data?.summary || {};
  const topPerformers = leaderboardData?.data?.topPerformers || [];

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
      default: return 'Total Bids';
    }
  };

  return (
    <div className="space-y-6">
      {/* Leaderboard Controls */}
      <Glass className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className="text-xl font-semibold">Carrier Leaderboard</h2>
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
              onClick={() => mutateLeaderboard()}
              disabled={leaderboardLoading}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${leaderboardLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Glass>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Carriers</p>
                <p className="text-2xl font-bold">{summary.total_carriers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Carriers</p>
                <p className="text-2xl font-bold">{summary.active_carriers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Bids</p>
                <p className="text-2xl font-bold">{summary.total_bids_placed || 0}</p>
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
                <p className="text-2xl font-bold">{formatMoney(summary.platform_avg_bid_cents || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Glass className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPerformers.map((performer: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium capitalize">{performer.metric.replace('_', ' ')}</span>
                  </div>
                  <p className="font-semibold">{performer.company_name || performer.legal_name}</p>
                  <p className="text-2xl font-bold" style={{ color: accentColor }}>
                    {performer.value} {performer.unit}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Glass>
      )}

      {/* Leaderboard Table */}
      <Glass className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Leaderboard - {getSortLabel(sortBy)} ({timeframe} days)
        </h3>
        
        {leaderboardLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Carrier Data</h3>
            <p className="text-muted-foreground">No carriers have placed bids in the selected timeframe.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((carrier: any, index: number) => (
              <Card key={carrier.clerk_user_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8">
                        {getRankIcon(index)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{carrier.company_name || carrier.legal_name}</h4>
                          {carrier.is_verified && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>MC: {carrier.mc_number || 'N/A'}</span>
                          <span>Fleet: {carrier.fleet_size || 1}</span>
                          <span>Days Active: {Math.round(carrier.days_active || 0)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-semibold" style={{ color: accentColor }}>
                          {sortBy === 'total_bids' && carrier.total_bids}
                          {sortBy === 'win_rate' && `${carrier.win_rate_percentage}%`}
                          {sortBy === 'avg_bid' && formatMoney(carrier.avg_bid_amount_cents)}
                          {sortBy === 'total_value' && formatMoney(carrier.total_bid_value_cents)}
                          {sortBy === 'recent_activity' && carrier.bids_last_7_days}
                          {sortBy === 'wins' && carrier.total_wins}
                        </p>
                        <p className="text-xs text-muted-foreground">{getSortLabel(sortBy)}</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="font-semibold">{carrier.total_bids}</p>
                        <p className="text-xs text-muted-foreground">Total Bids</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="font-semibold">{carrier.win_rate_percentage}%</p>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="font-semibold">{formatMoney(carrier.avg_bid_amount_cents)}</p>
                        <p className="text-xs text-muted-foreground">Avg Bid</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Glass>
    </div>
  );
}

export function AdminBiddingConsole() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [showExpired, setShowExpired] = useState(true); // Default to showing expired for admin
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
    { refreshInterval: 5000 }
  );

  const { data: expiredData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=true`,
    fetcher,
    { refreshInterval: 5000 }
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
  const filteredBids = bids.filter((bid: TelegramBid) => {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Bidding Console</h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive bid management, carrier analytics, and leaderboard dashboard
              </p>
            </div>
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
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Analytics Dashboard */}
        {showAnalytics && (
          <Glass className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Auctions</p>
                      <p className="text-2xl font-bold">{analytics.totalBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-green-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold">{analytics.activeBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-purple-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bids</p>
                      <p className="text-2xl font-bold">{analytics.totalCarrierBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-red-500 rounded"></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expired</p>
                      <p className="text-2xl font-bold">{analytics.expiredBids}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant={showExpired ? "default" : "outline"}
                    onClick={() => setShowExpired(!showExpired)}
                    style={showExpired ? {
                      backgroundColor: accentColor,
                      color: '#ffffff'
                    } : {}}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {showExpired ? "Hide Expired" : "Show Expired"}
                  </Button>
                </div>
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