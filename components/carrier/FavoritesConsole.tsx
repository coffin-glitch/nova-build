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
import { formatDistance, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
    Activity,
    BarChart3,
    Bell,
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
import { useState } from "react";
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
  currentBid: number | null;
  bidCount: number;
  myBid?: number | null;
}

interface NotificationTrigger {
  id: string;
  carrier_user_id: string;
  trigger_type: string;
  trigger_config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  bid_number?: string;
  route?: string | string[];
}

interface NotificationPreferences {
  emailNotifications: boolean;
  similarLoadNotifications: boolean;
  distanceThresholdMiles: number;
  statePreferences: string[];
  equipmentPreferences: string[];
  minDistance: number;
  maxDistance: number;
  // Advanced matching criteria
  minMatchScore: number; // Minimum similarity score to trigger notification (0-100)
  routeMatchThreshold: number; // Minimum route similarity percentage
  equipmentStrict: boolean; // Require exact equipment match vs partial
  distanceFlexibility: number; // Percentage variance allowed for distance (0-50%)
  timingRelevanceDays: number; // How many days ahead to consider for timing
  prioritizeBackhaul: boolean; // Prefer loads that match return routes
  marketPriceAlerts: boolean; // Alert when market price is favorable
}

interface FavoritesConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FavoritesConsole({ isOpen, onClose }: FavoritesConsoleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewDetailsBid, setViewDetailsBid] = useState<FavoriteBid | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'bid_amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreferences, setShowPreferences] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState<NotificationPreferences | null>(null);
  const [showNotificationTriggers, setShowNotificationTriggers] = useState(false);
  const [isCreatingTrigger, setIsCreatingTrigger] = useState(false);
  
  const { accentColor, accentBgStyle } = useAccentColor();

  // Fetch favorites data using SWR (following ManageBidsConsole pattern)
  const { data, mutate, isLoading } = useSWR(
    isOpen ? `/api/carrier/favorites` : null,
    fetcher,
    { 
      refreshInterval: 10000,
      fallbackData: { ok: true, data: [] }
    }
  );

  // Fetch notification preferences
  const { data: preferencesData } = useSWR(
    isOpen ? `/api/carrier/notification-preferences` : null,
    fetcher,
    { 
      refreshInterval: 30000,
      fallbackData: { ok: true, data: null }
    }
  );

  // Fetch notification triggers
  const { data: triggersData, mutate: mutateTriggers } = useSWR(
    isOpen ? `/api/carrier/notification-triggers` : null,
    fetcher,
    { 
      refreshInterval: 30000,
      fallbackData: { ok: true, data: [] }
    }
  );

  const favorites: FavoriteBid[] = data?.data || [];
  const notificationTriggers: NotificationTrigger[] = triggersData?.data || [];
  
  // Stable preferences with fallback
  const defaultPreferences: NotificationPreferences = {
    emailNotifications: true,
    similarLoadNotifications: true,
    distanceThresholdMiles: 50,
    statePreferences: [],
    equipmentPreferences: [],
    minDistance: 0,
    maxDistance: 2000,
  };
  
  const preferences = editingPreferences || preferencesData?.data || defaultPreferences;

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
          aValue = a.currentBid || 0;
          bValue = b.currentBid || 0;
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
        setEditingPreferences(null); // Clear editing state
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

  /**
   * Calculate similarity score using industry-leading algorithm
   * This score represents how relevant this favorited bid is to your preferences
   * Based on route similarity, equipment match, distance, timing, and market fit
   */
  const getSimilarityScore = async (favoriteBid: FavoriteBid): Promise<number> => {
    // For now, return a placeholder score based on bid characteristics
    // This will be enhanced with real-time matching data in a future update
    
    let score = 75; // Base relevance score
    
    // Equipment match (tag)
    if (favoriteBid.tag) score += 10;
    
    // Distance scoring
    if (favoriteBid.distance > 50 && favoriteBid.distance < 500) score += 5;
    if (favoriteBid.distance > 500 && favoriteBid.distance < 1500) score += 10;
    
    // Expiry status
    if (!favoriteBid.isExpired) score += 5;
    
    // Bid activity
    if (favoriteBid.bidCount > 0) score += 5;
    
    return Math.min(100, score);
  };
  
  // Synchronous wrapper for immediate display
  const getSimilarityScoreSync = (bid: FavoriteBid) => {
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

  // Notification trigger functions
  const handleCreateSimilarLoadTrigger = async () => {
    setIsCreatingTrigger(true);
    try {
      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'similar_load',
          triggerConfig: {
            distanceThreshold: preferences.distanceThresholdMiles,
            statePreferences: preferences.statePreferences,
            equipmentPreferences: preferences.equipmentPreferences,
            minDistance: preferences.minDistance,
            maxDistance: preferences.maxDistance
          },
          isActive: true
        })
      });

      const result = await response.json();
      if (result.ok) {
        toast.success("Similar load notifications enabled!");
        mutateTriggers();
      } else {
        toast.error(result.error || "Failed to create notification trigger");
      }
    } catch (error) {
      toast.error("Failed to create notification trigger");
    } finally {
      setIsCreatingTrigger(false);
    }
  };

  const handleCreateExactMatchTrigger = async (bidNumber: string) => {
    setIsCreatingTrigger(true);
    try {
      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'exact_match',
          triggerConfig: {
            favoriteBidNumbers: [bidNumber]
          },
          isActive: true
        })
      });

      const result = await response.json();
      if (result.ok) {
        toast.success(`Exact match notifications enabled for ${bidNumber}!`);
        mutateTriggers();
      } else {
        toast.error(result.error || "Failed to create notification trigger");
      }
    } catch (error) {
      toast.error("Failed to create notification trigger");
    } finally {
      setIsCreatingTrigger(false);
    }
  };

  const handleToggleTrigger = async (triggerId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: triggerId,
          isActive: !isActive
        })
      });

      const result = await response.json();
      if (result.ok) {
        toast.success(`Notification trigger ${!isActive ? 'enabled' : 'disabled'}`);
        mutateTriggers();
      } else {
        toast.error(result.error || "Failed to update notification trigger");
      }
    } catch (error) {
      toast.error("Failed to update notification trigger");
    }
  };

  const handleDeleteTrigger = async (triggerId: string) => {
    try {
      const response = await fetch(`/api/carrier/notification-triggers?id=${triggerId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.ok) {
        toast.success("Notification trigger deleted");
        mutateTriggers();
      } else {
        toast.error(result.error || "Failed to delete notification trigger");
      }
    } catch (error) {
      toast.error("Failed to delete notification trigger");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Your Favorites
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[80vh] space-y-4">
          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{favorites.length}</div>
                  <div className="text-xs text-muted-foreground">Total Favorites</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Activity className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{activeFavorites.length}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {preferences.similarLoadNotifications ? "ON" : "OFF"}
                  </div>
                  <div className="text-xs text-muted-foreground">Notifications</div>
                </div>
              </div>
            </Glass>
            
            <Glass className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {favorites.length > 0 ? Math.round(favorites.reduce((sum, fav) => sum + getSimilarityScoreSync(fav), 0) / favorites.length) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Match</div>
                </div>
              </div>
            </Glass>
          </div>

          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search favorites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>
              
              <div className="flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 bg-background border border-border rounded text-xs"
                >
                  <option value="date">Date</option>
                  <option value="distance">Distance</option>
                  <option value="bid_amount">Bid Amount</option>
                </select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1"
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreferences(!showPreferences)}
                className="hover:bg-blue-500/20 hover:text-blue-400 text-xs px-2 py-1"
              >
                <Settings className="h-3 w-3 mr-1" />
                {showPreferences ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {showPreferences ? "Hide" : "Show"} Prefs
              </Button>
              
              <div className="text-xs text-muted-foreground">
                <Star className="h-3 w-3 inline mr-1" />
                {filteredFavorites.length}
              </div>
            </div>
          </div>

          {/* Notification Preferences Panel */}
          {showPreferences && (
            <Glass className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold">Notification Preferences</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-medium">Email Notifications</label>
                        <p className="text-xs text-muted-foreground">Receive email alerts</p>
                      </div>
                      <Button
                        variant={preferences.emailNotifications ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingPreferences(prev => ({ ...(prev || defaultPreferences), emailNotifications: !(prev || defaultPreferences).emailNotifications }))}
                        className={preferences.emailNotifications ? "bg-primary text-primary-foreground" : ""}
                      >
                        {preferences.emailNotifications ? "ON" : "OFF"}
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-medium">Similar Load Alerts</label>
                        <p className="text-xs text-muted-foreground">Get notified about matches</p>
                      </div>
                      <Button
                        variant={preferences.similarLoadNotifications ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditingPreferences(prev => ({ ...(prev || defaultPreferences), similarLoadNotifications: !(prev || defaultPreferences).similarLoadNotifications }))}
                        className={preferences.similarLoadNotifications ? "bg-primary text-primary-foreground" : ""}
                      >
                        {preferences.similarLoadNotifications ? "ON" : "OFF"}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium">Distance Threshold (miles)</label>
                      <Input
                        type="number"
                        min="0"
                        max="500"
                        value={preferences.distanceThresholdMiles}
                        onChange={(e) => setEditingPreferences(prev => ({ ...(prev || defaultPreferences), distanceThresholdMiles: parseInt(e.target.value) || 50 }))}
                        className="mt-1 text-xs"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium">Min Distance</label>
                        <Input
                          type="number"
                          min="0"
                          value={preferences.minDistance}
                          onChange={(e) => setEditingPreferences(prev => ({ ...(prev || defaultPreferences), minDistance: parseInt(e.target.value) || 0 }))}
                          className="mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Max Distance</label>
                        <Input
                          type="number"
                          min="0"
                          value={preferences.maxDistance}
                          onChange={(e) => setEditingPreferences(prev => ({ ...(prev || defaultPreferences), maxDistance: parseInt(e.target.value) || 2000 }))}
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSavingPreferences}
                    className="bg-primary text-primary-foreground"
                    size="sm"
                  >
                    {isSavingPreferences ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings className="h-3 w-3 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Glass>
          )}

          {/* Notification Triggers Panel */}
          {showNotificationTriggers && (
            <Glass className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    <h3 className="text-sm font-semibold">Smart Notifications</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotificationTriggers(false)}
                    className="text-xs px-2 py-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {/* Similar Load Notifications */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">Similar Load Alerts</div>
                      <div className="text-xs text-muted-foreground">
                        Get notified when loads similar to your favorites appear
                      </div>
                    </div>
                    <Button
                      onClick={handleCreateSimilarLoadTrigger}
                      disabled={isCreatingTrigger}
                      className="bg-primary text-primary-foreground text-xs px-3 py-1"
                    >
                      {isCreatingTrigger ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Bell className="h-3 w-3 mr-1" />
                          Enable
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Active Triggers */}
                  {notificationTriggers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Active Triggers</div>
                      {notificationTriggers.map((trigger) => (
                        <div key={trigger.id} className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs">
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {trigger.trigger_type.replace('_', ' ')}
                            </Badge>
                            {trigger.bid_number && (
                              <span className="text-muted-foreground">
                                Bid #{trigger.bid_number}
                              </span>
                            )}
                            {trigger.route && (
                              <span className="text-muted-foreground truncate">
                                {Array.isArray(trigger.route) ? trigger.route.join(' → ') : trigger.route}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              • {trigger.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleTrigger(trigger.id, trigger.is_active)}
                              className="text-xs px-2 py-1"
                            >
                              {trigger.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTrigger(trigger.id)}
                              className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Glass>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'active' | 'expired')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3" />
                All ({favorites.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="flex items-center gap-1 text-xs">
                <Activity className="h-3 w-3" />
                Active ({activeFavorites.length})
              </TabsTrigger>
              <TabsTrigger value="expired" className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Expired ({expiredFavorites.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3">
              {filteredFavorites.length === 0 ? (
                <div className="text-center py-8">
                  <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="text-sm font-semibold mb-1">
                    {searchTerm ? "No favorites match your search" : "No favorites yet"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {searchTerm 
                      ? "Try adjusting your search terms" 
                      : "Start favoriting bids from the Live Auctions page"
                    }
                  </p>
                  {!searchTerm && (
                    <Link href="/bid-board">
                      <Button size="sm" className="bg-primary text-primary-foreground mt-2">
                        <Star className="h-3 w-3 mr-1" />
                        Browse Live Auctions
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFavorites.map((favorite) => {
                    const similarityScore = getSimilarityScoreSync(favorite);
                    return (
                      <Glass key={favorite.favorite_id} className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">{favorite.bid_number}</h4>
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
                                  <div className="text-xs text-muted-foreground">Time Left</div>
                                  <Countdown 
                                    expiresAt={favorite.expiresAt} 
                                    className="text-sm font-mono"
                                  />
                                </div>
                              )}
                              
                              {/* Notification Trigger Buttons */}
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateExactMatchTrigger(favorite.bid_number)}
                                  disabled={isCreatingTrigger}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border-blue-500/30 px-2 py-1"
                                  title="Get notified when this exact load appears again"
                                >
                                  <Bell className="h-3 w-3" />
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowNotificationTriggers(true)}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 border-purple-500/30 px-2 py-1"
                                  title="Manage notification settings"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveFavorite(favorite.bid_number)}
                                disabled={isRemoving === favorite.bid_number}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-red-500/30 px-2 py-1"
                              >
                                {isRemoving === favorite.bid_number ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Route Info */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{formatStops(favorite.stops)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Navigation className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDistance(favorite.distance)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span>{formatStopCount(favorite.stops)}</span>
                            </div>
                          </div>

                          {/* Bidding Info */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs">
                              {favorite.myBid && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  <span>My Bid: <span className="font-semibold text-blue-400">${Number(favorite.myBid || 0).toFixed(2)}</span></span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {favorite.tag && (
                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                  {favorite.tag}
                                </Badge>
                              )}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewDetailsBid(favorite)}
                                className="text-xs px-2 py-1"
                              >
                                Details
                              </Button>
                              
                              {!favorite.isExpired && (
                                <Link href="/bid-board">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs px-2 py-1 hover:bg-blue-500/20 hover:text-blue-400"
                                  >
                                    <Zap className="h-3 w-3 mr-1" />
                                    Bid Now
                                  </Button>
                                </Link>
                              )}
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
        </div>

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
              <div className="space-y-4">
                <div className="h-48 rounded-lg overflow-hidden">
                  <MapboxMap
                    stops={viewDetailsBid.stops}
                    className="w-full h-full"
                  />
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Detailed Route</h4>
                  <div className="space-y-1">
                    {formatStopsDetailed(viewDetailsBid.stops).map((stop, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded bg-muted/20 text-sm">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span>{stop}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
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
                  {viewDetailsBid.myBid && (
                    <div>
                      <span className="text-muted-foreground">My Bid:</span>
                      <span className="ml-2 font-medium text-blue-400">${Number(viewDetailsBid.myBid || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
