"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatDistance, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
    Activity,
    BarChart3,
    Bell,
    Calendar,
    Clock,
    DollarSign,
    Eye,
    EyeOff,
    Heart,
    MapPin,
    Navigation,
    RefreshCw,
    Search,
    Settings,
    SortAsc,
    SortDesc,
    Star,
    Target,
    Truck,
    X,
    Zap
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface FavoriteBid {
  favorite_id: string;
  bid_number: string;
  favorited_at: string;
  distance: number;
  pickupDate: string;
  deliveryDate: string;
  stops: string[];
  tag: string;
  sourceChannel: string;
  receivedAt: string;
  expiresAt: string;
  isExpired: boolean;
  currentBid: number;
  bidCount: number;
  myBid?: number;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  similarLoadNotifications: boolean;
  distanceThresholdMiles: number;
  statePreferences: string[];
  equipmentPreferences: string[];
  minDistance: number;
  maxDistance: number;
}

export default function CarrierFavoritesClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDetailsBid, setViewDetailsBid] = useState<FavoriteBid | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'bid_amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    similarLoadNotifications: true,
    distanceThresholdMiles: 50,
    statePreferences: [],
    equipmentPreferences: [],
    minDistance: 0,
    maxDistance: 2000,
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  
  // Stable color values to prevent hydration mismatch
  const [iconColor, setIconColor] = useState('#6b7280');
  const [buttonTextColor, setButtonTextColor] = useState('#ffffff');
  
  useEffect(() => {
    // Calculate colors on client side only to prevent hydration mismatch
    if (accentColor === 'hsl(0, 0%, 100%)') {
      setIconColor('#6b7280');
      setButtonTextColor('#000000');
    } else {
      setIconColor(accentColor);
      setButtonTextColor('#ffffff');
    }
  }, [accentColor]);

  const { data, mutate, isLoading } = useSWR(
    `/api/carrier/favorites`,
    fetcher,
    { 
      refreshInterval: 10000,
      fallbackData: { ok: true, data: [] }
    }
  );

  const favorites: FavoriteBid[] = data?.data || [];

  // Fetch notification preferences
  const { data: preferencesData } = useSWR(
    `/api/carrier/notification-preferences`,
    fetcher,
    { fallbackData: { ok: true, data: null } }
  );

  useEffect(() => {
    if (preferencesData?.data) {
      setPreferences(preferencesData.data);
    }
  }, [preferencesData]);

  // Separate favorites by status
  const activeFavorites = favorites.filter(fav => !fav.isExpired);
  const expiredFavorites = favorites.filter(fav => fav.isExpired);

  // Filter and sort favorites
  const getFilteredFavorites = () => {
    let filtered = favorites;
    
    // Apply tab filter
    if (activeTab === 'active') {
      filtered = activeFavorites;
    } else if (activeTab === 'expired') {
      filtered = expiredFavorites;
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((favorite) => {
        return (
          favorite.bid_number.toLowerCase().includes(searchLower) ||
          favorite.tag?.toLowerCase().includes(searchLower) ||
          favorite.sourceChannel?.toLowerCase().includes(searchLower) ||
          formatStops(favorite.stops).toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'distance':
          aValue = a.distance;
          bValue = b.distance;
          break;
        case 'bid_amount':
          aValue = a.currentBid;
          bValue = b.currentBid;
          break;
        case 'date':
        default:
          aValue = new Date(a.favorited_at).getTime();
          bValue = new Date(b.favorited_at).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    return filtered;
  };

  const filteredFavorites = getFilteredFavorites();

  const handleRemoveFavorite = async (bidNumber: string) => {
    setIsRemoving(bidNumber);
    try {
      const response = await fetch(`/api/carrier/favorites?bid_number=${bidNumber}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Removed from favorites");
        mutate();
      } else {
        toast.error(result.error || "Failed to remove from favorites");
      }
    } catch (error) {
      toast.error("Failed to remove from favorites");
    } finally {
      setIsRemoving(null);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      const response = await fetch('/api/carrier/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Notification preferences saved!");
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const getStatusColor = (bid: FavoriteBid) => {
    if (bid.isExpired) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (bid.bidCount === 0) return "bg-green-500/20 text-green-400 border-green-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  const getStatusText = (bid: FavoriteBid) => {
    if (bid.isExpired) return "Expired";
    if (bid.bidCount === 0) return "No Bids";
    return `${bid.bidCount} Bid${bid.bidCount === 1 ? '' : 's'}`;
  };

  const getSimilarityScore = (bid: FavoriteBid) => {
    // This would be calculated based on load matching algorithm
    // For now, we'll simulate based on distance and timing
    const now = new Date();
    const pickupTime = new Date(bid.pickupDate);
    const timeDiff = Math.abs(now.getTime() - pickupTime.getTime()) / (1000 * 60 * 60 * 24);
    
    let score = 100;
    if (timeDiff > 7) score -= 20;
    if (timeDiff > 14) score -= 30;
    if (bid.distance < 100) score -= 10;
    if (bid.distance > 1000) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Star className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{favorites.length}</div>
              <div className="text-sm text-muted-foreground">Total Favorites</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Activity className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeFavorites.length}</div>
              <div className="text-sm text-muted-foreground">Active Favorites</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Bell className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {preferences.similarLoadNotifications ? "ON" : "OFF"}
              </div>
              <div className="text-sm text-muted-foreground">Notifications</div>
            </div>
          </div>
        </Glass>
        
        <Glass className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.round(favorites.reduce((sum, fav) => sum + getSimilarityScore(fav), 0) / favorites.length) || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Match Score</div>
            </div>
          </div>
        </Glass>
      </div>

      {/* Search and Controls */}
      <Glass className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search favorites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-background border border-border rounded-md text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="distance">Sort by Distance</option>
                <option value="bid_amount">Sort by Bid Amount</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreferences(!showPreferences)}
              className="hover:bg-blue-500/20 hover:text-blue-400"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showPreferences ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showPreferences ? "Hide" : "Show"} Preferences
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <Star className="h-4 w-4 inline mr-1" />
              {filteredFavorites.length} favorite{filteredFavorites.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </Glass>

      {/* Notification Preferences Panel */}
      {showPreferences && (
        <Glass className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Email Notifications</label>
                    <p className="text-xs text-muted-foreground">Receive email alerts for similar loads</p>
                  </div>
                  <Button
                    variant={preferences.emailNotifications ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferences(prev => ({ ...prev, emailNotifications: !prev.emailNotifications }))}
                    style={preferences.emailNotifications ? accentBgStyle : undefined}
                  >
                    {preferences.emailNotifications ? "ON" : "OFF"}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Similar Load Alerts</label>
                    <p className="text-xs text-muted-foreground">Get notified about matching loads</p>
                  </div>
                  <Button
                    variant={preferences.similarLoadNotifications ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferences(prev => ({ ...prev, similarLoadNotifications: !prev.similarLoadNotifications }))}
                    style={preferences.similarLoadNotifications ? accentBgStyle : undefined}
                  >
                    {preferences.similarLoadNotifications ? "ON" : "OFF"}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Distance Threshold (miles)</label>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={preferences.distanceThresholdMiles}
                    onChange={(e) => setPreferences(prev => ({ ...prev, distanceThresholdMiles: parseInt(e.target.value) || 50 }))}
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Min Distance</label>
                    <Input
                      type="number"
                      min="0"
                      value={preferences.minDistance}
                      onChange={(e) => setPreferences(prev => ({ ...prev, minDistance: parseInt(e.target.value) || 0 }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max Distance</label>
                    <Input
                      type="number"
                      min="0"
                      value={preferences.maxDistance}
                      onChange={(e) => setPreferences(prev => ({ ...prev, maxDistance: parseInt(e.target.value) || 2000 }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={handleSavePreferences}
                disabled={isSavingPreferences}
                style={accentBgStyle}
              >
                {isSavingPreferences ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        </Glass>
      )}

      {/* Main Console with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'active' | 'expired')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            All Favorites ({favorites.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active ({activeFavorites.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Expired ({expiredFavorites.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {filteredFavorites.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No favorites match your search" : "No favorites yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search terms" 
                  : "Start favoriting bids from the Live Auctions page to see them here"
                }
              </p>
              {!searchTerm && (
                <Link href="/bid-board">
                  <Button style={accentBgStyle}>
                    <Star className="h-4 w-4 mr-2" />
                    Browse Live Auctions
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredFavorites.map((favorite) => {
                const similarityScore = getSimilarityScore(favorite);
                return (
                  <Glass key={favorite.favorite_id} className="p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Main Content */}
                      <div className="flex-1 space-y-4">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-foreground">
                              {favorite.bid_number}
                            </h3>
                            <Badge className={getStatusColor(favorite)}>
                              {getStatusText(favorite)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Target className="h-3 w-3 mr-1" />
                              {similarityScore}% match
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!favorite.isExpired && (
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Time Left</div>
                                <Countdown 
                                  expiresAt={new Date(favorite.expiresAt)} 
                                  className="text-lg font-mono"
                                />
                              </div>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveFavorite(favorite.bid_number)}
                              disabled={isRemoving === favorite.bid_number}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-red-500/30"
                            >
                              {isRemoving === favorite.bid_number ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Route</div>
                              <div className="font-medium">
                                {formatStops(favorite.stops)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Navigation className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Distance</div>
                              <div className="font-medium">
                                {formatDistance(favorite.distance)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Stops</div>
                              <div className="font-medium">
                                {formatStopCount(favorite.stops)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Pickup</div>
                              <div className="font-medium">
                                {formatPickupDateTime(favorite.pickupDate)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-sm text-muted-foreground">Delivery</div>
                              <div className="font-medium">
                                {formatPickupDateTime(favorite.deliveryDate)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bidding Info */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Current:</span>
                              <span className="font-semibold">${favorite.currentBid.toFixed(2)}</span>
                            </div>
                            
                            {favorite.myBid && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">My Bid:</span>
                                <span className="font-semibold text-blue-400">${favorite.myBid.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {favorite.tag && (
                              <Badge variant="secondary" className="text-xs">
                                {favorite.tag}
                              </Badge>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewDetailsBid(favorite)}
                            >
                              View Details
                            </Button>
                            
                            {!favorite.isExpired && (
                              <Link href="/bid-board">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-blue-500/20 hover:text-blue-400"
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  Bid Now
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Glass>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!viewDetailsBid} onOpenChange={() => setViewDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Bid Details - {viewDetailsBid?.bid_number}
            </DialogTitle>
          </DialogHeader>
          
          {viewDetailsBid && (
            <div className="space-y-6">
              {/* Route Map */}
              <div className="h-64 rounded-lg overflow-hidden">
                <MapboxMap
                  stops={viewDetailsBid.stops}
                  className="w-full h-full"
                />
              </div>
              
              {/* Detailed Stops */}
              <div>
                <h4 className="font-semibold mb-3">Detailed Route</h4>
                <div className="space-y-2">
                  {formatStopsDetailed(viewDetailsBid.stops).map((stop, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded bg-muted/20">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm">{stop}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <span className="ml-2 font-medium">{viewDetailsBid.sourceChannel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Favorited:</span>
                  <span className="ml-2 font-medium">
                    {new Date(viewDetailsBid.favorited_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Match Score:</span>
                  <span className="ml-2 font-medium">{getSimilarityScore(viewDetailsBid)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Bid:</span>
                  <span className="ml-2 font-medium">${viewDetailsBid.currentBid.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}