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
  LayoutGrid,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Settings,
  SortAsc,
  SortDesc,
  Star,
  Table as TableIcon,
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
  currentBid: number | null;
  bidCount: number;
  myBid?: number | null;
  timeLeftSeconds?: number;
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
  avoidHighCompetition: boolean; // Filter out loads with too many bids
  maxCompetitionBids: number; // Maximum number of bids before filtering (if avoidHighCompetition is true)
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
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'bid_amount' | 'match_score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreferences, setShowPreferences] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState<NotificationPreferences | null>(null);
  const [showNotificationTriggers, setShowNotificationTriggers] = useState(false);
  const [isCreatingTrigger, setIsCreatingTrigger] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [maxCompetitionBids, setMaxCompetitionBids] = useState<number>(10);
  const [avoidHighCompetition, setAvoidHighCompetition] = useState<boolean>(false);
  
  // Local state to track string input values (allows empty strings during editing)
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  
  const { accentColor, accentBgStyle } = useAccentColor();

  // Fetch favorites data using SWR (following ManageBidsConsole pattern)
  const { data, mutate, isLoading } = useSWR(
    isOpen ? `/api/carrier/favorites` : null,
    fetcher,
    { 
      refreshInterval: 10000,
      fallbackData: { ok: true, data: [] },
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  );

  // Fetch notification preferences
  const { data: preferencesData, mutate: mutatePreferences } = useSWR(
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
  
  // Debug logging
  useEffect(() => {
    if (isOpen && data) {
      console.log('[FavoritesConsole] Data received:', {
        hasData: !!data,
        hasOk: data?.ok,
        dataLength: data?.data?.length || 0,
        dataType: typeof data?.data,
        isArray: Array.isArray(data?.data),
        firstItem: data?.data?.[0]
      });
    }
  }, [isOpen, data]);
  
  // Stable preferences with fallback
  const defaultPreferences: NotificationPreferences = {
    emailNotifications: true,
    similarLoadNotifications: true,
    distanceThresholdMiles: 50,
    statePreferences: [],
    equipmentPreferences: [],
    minDistance: 0,
    maxDistance: 2000,
    minMatchScore: 70,
    routeMatchThreshold: 60,
    equipmentStrict: false,
    distanceFlexibility: 25,
    timingRelevanceDays: 7,
    prioritizeBackhaul: true,
    marketPriceAlerts: false,
    avoidHighCompetition: false,
    maxCompetitionBids: 10,
  };
  
  // Initialize editingPreferences when preferences data loads, but only if we're not already editing
  useEffect(() => {
    if (preferencesData?.data && !editingPreferences) {
      // Only initialize if editingPreferences is null (first load)
      setEditingPreferences(preferencesData.data);
      // Clear input values to use the loaded preferences
      setInputValues({});
    }
  }, [preferencesData?.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const preferences = editingPreferences || preferencesData?.data || defaultPreferences;

  // Sync avoidHighCompetition and maxCompetitionBids with preferences
  useEffect(() => {
    if (preferencesData?.data) {
      const prefs = preferencesData.data;
      if (prefs.avoidHighCompetition !== undefined) {
        setAvoidHighCompetition(prefs.avoidHighCompetition);
      }
      if (prefs.maxCompetitionBids !== undefined) {
        setMaxCompetitionBids(prefs.maxCompetitionBids);
      }
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

    // Apply competition filter when enabled
    if (avoidHighCompetition) {
      filtered = filtered.filter((f) => (f.bidCount || 0) <= maxCompetitionBids);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'distance':
          aValue = a.distance || 0;
          bValue = b.distance || 0;
          break;
        case 'bid_amount':
          aValue = a.bidCount || 0;
          bValue = b.bidCount || 0;
          break;
        case 'match_score':
          aValue = getSimilarityScoreSync(a);
          bValue = getSimilarityScoreSync(b);
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
      // Include avoidHighCompetition and maxCompetitionBids in saved preferences
      const preferencesToSave = {
        ...preferences,
        avoidHighCompetition,
        maxCompetitionBids,
      };
      
      const response = await fetch('/api/carrier/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferencesToSave),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Notification preferences saved!");
        // Update editingPreferences with the saved values (so inputs retain their state)
        setEditingPreferences(preferencesToSave);
        // Clear input values so they sync with saved preferences
        setInputValues({});
        // Re-fetch from server to ensure consistency
        await mutatePreferences();
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
   * Extract city name from stop string (helper for route matching)
   */
  const extractCityName = (stop: string): string => {
    const parts = stop.split(',');
    return parts[0]?.trim() || stop;
  };

  /**
   * Calculate sophisticated similarity score for a favorite bid
   * Uses weighted composite scoring based on preferences, route patterns, timing, and market fit
   */
  const getSimilarityScoreSync = (bid: FavoriteBid): number => {
    let preferenceScore = 0;
    let routeConsistencyScore = 0;
    let timingScore = 0;
    let marketFitScore = 0;

    const prefs = preferences;
    const allFavorites = favorites.filter(f => f.bid_number !== bid.bid_number);

    // 1. PREFERENCE ALIGNMENT (40% weight)
    // Distance alignment
    if (bid.distance >= prefs.minDistance && bid.distance <= prefs.maxDistance) {
      const distanceRange = prefs.maxDistance - prefs.minDistance;
      if (distanceRange > 0) {
        const distanceFromMin = bid.distance - prefs.minDistance;
        const normalizedDistance = distanceFromMin / distanceRange;
        // Prefer distances in the middle-upper range (50-80% of range)
        if (normalizedDistance >= 0.5 && normalizedDistance <= 0.8) {
          preferenceScore += 40;
        } else if (normalizedDistance >= 0.3 && normalizedDistance <= 0.9) {
          preferenceScore += 30;
        } else {
          preferenceScore += 20;
        }
      } else {
        preferenceScore += 30; // Default if range is 0
      }
    } else {
      // Penalty for out-of-range distances
      if (bid.distance < prefs.minDistance) {
        const percentShort = ((prefs.minDistance - bid.distance) / prefs.minDistance) * 100;
        preferenceScore += Math.max(0, 20 - percentShort / 5);
      } else {
        const percentOver = ((bid.distance - prefs.maxDistance) / prefs.maxDistance) * 100;
        preferenceScore += Math.max(0, 20 - percentOver / 10);
      }
    }

    // Equipment/Tag matching
    if (bid.tag && prefs.statePreferences.length > 0) {
      if (prefs.statePreferences.includes(bid.tag)) {
        preferenceScore += 40;
      } else {
        preferenceScore += 10; // Tag exists but doesn't match preferences
      }
    } else if (bid.tag) {
      preferenceScore += 20; // Tag exists but no preferences set
    } else {
      preferenceScore += 15; // No tag, neutral
    }

    // Equipment preferences (if we had equipment data, would check here)
    preferenceScore = Math.min(100, preferenceScore);

    // 2. ROUTE CONSISTENCY (30% weight) - Compare with other favorites
    if (allFavorites.length > 0 && bid.stops && Array.isArray(bid.stops) && bid.stops.length > 0) {
      const bidOrigin = extractCityName(bid.stops[0]).toUpperCase().trim();
      const bidDest = extractCityName(bid.stops[bid.stops.length - 1]).toUpperCase().trim();
      
      let routeMatches = 0;
      let partialMatches = 0;
      
      for (const fav of allFavorites) {
        if (fav.stops && Array.isArray(fav.stops) && fav.stops.length > 0) {
          const favOrigin = extractCityName(fav.stops[0]).toUpperCase().trim();
          const favDest = extractCityName(fav.stops[fav.stops.length - 1]).toUpperCase().trim();
          
          if (bidOrigin === favOrigin && bidDest === favDest) {
            routeMatches++;
          } else if (bidOrigin === favOrigin || bidDest === favDest) {
            partialMatches++;
          }
        }
      }
      
      const totalMatches = routeMatches + partialMatches;
      if (totalMatches > 0) {
        // Strong pattern if multiple exact matches
        if (routeMatches >= 3) {
          routeConsistencyScore = 100;
        } else if (routeMatches >= 1) {
          routeConsistencyScore = 70 + (routeMatches * 10);
        } else if (partialMatches >= 2) {
          routeConsistencyScore = 50 + (partialMatches * 5);
        } else {
          routeConsistencyScore = 40;
        }
      } else {
        // No route matches - this is a unique route (neutral score)
        routeConsistencyScore = 50;
      }
    } else {
      routeConsistencyScore = 50; // Neutral if no route data
    }

    // 3. TIMING RELEVANCE (20% weight)
    const now = new Date();
    const pickupTime = new Date(bid.pickupDate);
    const daysUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const relevanceWindow = prefs.timingRelevanceDays || 7;

    if (bid.isExpired) {
      timingScore = 10; // Expired loads get low score
    } else if (daysUntilPickup < 0) {
      timingScore = 80; // Past pickup but not expired (still relevant)
    } else if (daysUntilPickup >= 0 && daysUntilPickup <= relevanceWindow) {
      if (daysUntilPickup <= 1) {
        timingScore = 100; // Urgent - within 24 hours
      } else if (daysUntilPickup <= 2) {
        timingScore = 90; // Very soon
      } else if (daysUntilPickup <= 3) {
        timingScore = 80; // Soon
      } else {
        // Decay score based on remaining window
        const remainingDays = Math.max(1, relevanceWindow - 3);
        const decayPercent = Math.max(0, (relevanceWindow - daysUntilPickup) / remainingDays);
        timingScore = 70 * decayPercent + 30; // Scale between 30-100
      }
    } else if (daysUntilPickup > relevanceWindow) {
      // Beyond relevance window
      const excessDays = daysUntilPickup - relevanceWindow;
      timingScore = Math.max(20, 50 - (excessDays * 5));
    }

    // 4. MARKET FIT (10% weight) - Competition and activity
    if (prefs.avoidHighCompetition && bid.bidCount > prefs.maxCompetitionBids) {
      // High competition penalty
      const excessBids = bid.bidCount - prefs.maxCompetitionBids;
      marketFitScore = Math.max(0, 30 - (excessBids * 2));
    } else {
      // Moderate competition is good (shows demand)
      if (bid.bidCount === 0) {
        marketFitScore = 60; // No competition but also no validation
      } else if (bid.bidCount <= 3) {
        marketFitScore = 90; // Low competition - good opportunity
      } else if (bid.bidCount <= prefs.maxCompetitionBids) {
        marketFitScore = 70; // Moderate competition - still viable
      } else {
        marketFitScore = 40; // Higher competition
      }
    }

    // Calculate weighted composite score
    const compositeScore = (
      preferenceScore * 0.40 +
      routeConsistencyScore * 0.30 +
      timingScore * 0.20 +
      marketFitScore * 0.10
    );

    // Return score as percentage (0-100)
    return Math.round(Math.max(0, Math.min(100, compositeScore)));
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
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-bold">
                      {favorites.length > 0 ? Math.round(favorites.reduce((sum, fav) => sum + getSimilarityScoreSync(fav), 0) / favorites.length) : 0}%
                    </div>
                    <span 
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help" 
                      title="Average Match Score: Calculated using a weighted algorithm that considers (1) Distance & Equipment preferences (40%), (2) Route consistency with your other favorites (30%), (3) Timing relevance within your window (20%), and (4) Market competition level (10%). Each bid's score is averaged across all your favorites."
                    >
                      ?
                    </span>
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
                  <option value="bid_amount">Bid Count</option>
                  <option value="match_score">Match Score</option>
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
              {/* View Toggle */}
              <div className="flex items-center gap-1 border border-border rounded p-0.5">
                <Button
                  variant={viewMode === 'card' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className={`text-xs px-2 py-1 h-7 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : ''}`}
                  title="Card View"
                >
                  <LayoutGrid className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={`text-xs px-2 py-1 h-7 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                  title="Table View"
                >
                  <TableIcon className="h-3 w-3" />
                </Button>
              </div>
              
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-semibold">Notification Preferences</h3>
                  </div>
                  <Button
                    variant={showAdvancedSettings ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    title="Advanced Matching Settings"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  >
                    {showAdvancedSettings ? "Hide Advanced" : "Show Advanced"}
                  </Button>
                </div>
                
                {/* Advanced Settings Panel */}
                {showAdvancedSettings && (
                  <div className="mt-4 p-4 bg-muted/20 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-400" />
                        <h4 className="text-sm font-semibold">Advanced Matching Criteria</h4>
                      </div>
                      {/* Presets */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          title="More Alerts"
                          onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), minMatchScore: 50, distanceFlexibility: 30 }))}
                        >
                          More Alerts
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          title="Balanced"
                          onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), minMatchScore: 70, distanceFlexibility: 25 }))}
                        >
                          Balanced
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          title="Selective"
                          onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), minMatchScore: 85, distanceFlexibility: 15 }))}
                        >
                          Selective
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Min Match Score */}
                      <div>
                        <label className="text-xs font-medium flex items-center gap-1">
                          Min Match Score (0-100)
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help" title="Only alert when similarity is above this threshold (0–100). Higher = fewer but better alerts.">?</span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={inputValues.minMatchScore !== undefined ? inputValues.minMatchScore : preferences.minMatchScore}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues((prev: Record<string, string>) => ({ ...prev, minMatchScore: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = Math.max(0, Math.min(100, parseInt(val) || 0));
                            setEditingPreferences(prev => ({ ...(prev || preferences), minMatchScore: numVal }));
                          }}
                          onBlur={(e) => {
                            // On blur, ensure we have a valid number
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, minMatchScore: String(preferences.minMatchScore) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                      </div>

                      {/* Route Match Threshold */}
                      <div>
                        <label className="text-xs font-medium flex items-center gap-1">
                          Route Match Threshold (%)
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help" title="How similar pickup/delivery cities must be. Higher = closer to the same cities.">?</span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={inputValues.routeMatchThreshold !== undefined ? inputValues.routeMatchThreshold : preferences.routeMatchThreshold}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, routeMatchThreshold: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = Math.max(0, Math.min(100, parseInt(val) || 0));
                            setEditingPreferences(prev => ({ ...(prev || preferences), routeMatchThreshold: numVal }));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, routeMatchThreshold: String(preferences.routeMatchThreshold) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                      </div>

                      {/* Distance Flexibility */}
                      <div>
                        <label className="text-xs font-medium">Distance Flexibility (%)</label>
                        <Input
                          type="number"
                          min="0"
                          max="50"
                          value={inputValues.distanceFlexibility !== undefined ? inputValues.distanceFlexibility : preferences.distanceFlexibility}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, distanceFlexibility: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = Math.max(0, Math.min(50, parseInt(val) || 0));
                            setEditingPreferences(prev => ({ ...(prev || preferences), distanceFlexibility: numVal }));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, distanceFlexibility: String(preferences.distanceFlexibility) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Allowed variance in miles compared to similar routes.
                        </p>
                      </div>

                      {/* Timing Relevance Window */}
                      <div>
                        <label className="text-xs font-medium">Timing Relevance Window (days)</label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={inputValues.timingRelevanceDays !== undefined ? inputValues.timingRelevanceDays : preferences.timingRelevanceDays}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, timingRelevanceDays: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = Math.max(0, Math.min(30, parseInt(val) || 0));
                            setEditingPreferences(prev => ({ ...(prev || preferences), timingRelevanceDays: numVal }));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, timingRelevanceDays: String(preferences.timingRelevanceDays) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          How far ahead pickups can be and still be relevant.
                        </p>
                      </div>

                      {/* Prioritize Backhaul */}
                      <div className="flex items-center justify-between mt-6">
                        <div>
                          <label className="text-xs font-medium">Prioritize Backhaul</label>
                          <p className="text-xs text-muted-foreground">Prefer return route matches</p>
                        </div>
                        <Button
                          variant={preferences.prioritizeBackhaul ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), prioritizeBackhaul: !(prev || preferences).prioritizeBackhaul }))}
                        >
                          {preferences.prioritizeBackhaul ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      {/* Avoid High Competition (local filter) */}
                      <div className="flex items-center justify-between mt-6">
                        <div>
                          <label className="text-xs font-medium">Avoid High Competition</label>
                          <p className="text-xs text-muted-foreground">Hide favorites with more than N bids</p>
                        </div>
                        <Button
                          variant={avoidHighCompetition ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          onClick={() => setAvoidHighCompetition(!avoidHighCompetition)}
                        >
                          {avoidHighCompetition ? 'ON' : 'OFF'}
                        </Button>
                      </div>

                      {/* Max Competition Bids (local filter) */}
                      <div>
                        <label className="text-xs font-medium">Max Competition Bids</label>
                        <Input
                          type="number"
                          min="0"
                          max="50"
                          value={inputValues.maxCompetitionBids !== undefined ? inputValues.maxCompetitionBids : maxCompetitionBids}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, maxCompetitionBids: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = Math.max(0, Math.min(50, parseInt(val) || 0));
                            setMaxCompetitionBids(numVal);
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, maxCompetitionBids: String(maxCompetitionBids) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
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
                        onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), emailNotifications: !(prev || preferences).emailNotifications }))}
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
                        onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), similarLoadNotifications: !(prev || preferences).similarLoadNotifications }))}
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
                        value={inputValues.distanceThresholdMiles !== undefined ? inputValues.distanceThresholdMiles : preferences.distanceThresholdMiles}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputValues(prev => ({ ...prev, distanceThresholdMiles: val }));
                          if (val === '') return; // Allow empty during editing
                          const numVal = parseInt(val) || 50;
                          setEditingPreferences(prev => ({ ...(prev || preferences), distanceThresholdMiles: numVal }));
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setInputValues(prev => ({ ...prev, distanceThresholdMiles: String(preferences.distanceThresholdMiles) }));
                          }
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium">Min Distance</label>
                        <Input
                          type="number"
                          min="0"
                          value={inputValues.minDistance !== undefined ? inputValues.minDistance : preferences.minDistance}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, minDistance: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = parseInt(val) || 0;
                            setEditingPreferences(prev => ({ ...(prev || preferences), minDistance: numVal }));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, minDistance: String(preferences.minDistance) }));
                            }
                          }}
                          className="mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Max Distance</label>
                        <Input
                          type="number"
                          min="0"
                          value={inputValues.maxDistance !== undefined ? inputValues.maxDistance : preferences.maxDistance}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInputValues(prev => ({ ...prev, maxDistance: val }));
                            if (val === '') return; // Allow empty during editing
                            const numVal = parseInt(val) || 2000;
                            setEditingPreferences(prev => ({ ...(prev || preferences), maxDistance: numVal }));
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setInputValues(prev => ({ ...prev, maxDistance: String(preferences.maxDistance) }));
                            }
                          }}
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
              ) : viewMode === 'card' ? (
                /* Card View - 3 Column Grid with proper spacing */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredFavorites.map((favorite) => {
                    const similarityScore = getSimilarityScoreSync(favorite);
                    return (
                      <Glass key={favorite.favorite_id} className="p-3 flex flex-col h-[280px]">
                        <div className="space-y-3 flex-1 flex flex-col min-h-0">
                          {/* Header Row - Bid Number, Badges, State Tag, Time Left */}
                          <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm">#{favorite.bid_number}</h4>
                              <Badge className={getStatusColor(favorite)}>
                                <span className="text-[10px] px-1.5">{getStatusText(favorite)}</span>
                              </Badge>
                              <Badge variant="outline" className="text-xs px-2">
                                <Target className="h-3 w-3 mr-1" />
                                {similarityScore}%
                              </Badge>
                              {favorite.tag && (
                                <Badge variant="secondary" className="text-[10px] px-2 py-1">
                                  {favorite.tag}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Time Left - Top Right */}
                            {!favorite.isExpired && (
                              <div className="text-right">
                                <div className="text-[10px] text-muted-foreground mb-0.5">Time Left</div>
                                <Countdown 
                                  expiresAt={favorite.expiresAt} 
                                  variant={(favorite.timeLeftSeconds || 0) <= 300 ? "urgent" : "default"}
                                  className="text-xs font-mono"
                                />
                              </div>
                            )}
                          </div>

                          {/* Route Details Section - Prominent and Well-Spaced */}
                          <div className="space-y-2.5 flex-shrink-0 bg-muted/30 rounded-lg p-3 border border-border/50">
                            {/* Route */}
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                {favorite.stops && Array.isArray(favorite.stops) && favorite.stops.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-snug">
                                    {favorite.stops.slice(0, 3).map((stop, idx) => (
                                      <span key={idx} className="inline-flex items-center">
                                        <span className="text-foreground font-semibold truncate max-w-[140px]">{stop}</span>
                                        {idx < Math.min(favorite.stops.length - 1, 2) && (
                                          <span className="mx-1.5 text-muted-foreground text-xs">→</span>
                                        )}
                                      </span>
                                    ))}
                                    {favorite.stops.length > 3 && (
                                      <span className="text-muted-foreground text-xs ml-1">+{favorite.stops.length - 3} more</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">No route information</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Distance and Stops - Grouped together */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                              <div className="flex items-center gap-1.5">
                                <Navigation className="h-3.5 w-3.5" />
                                <span className="font-medium">{formatDistance(favorite.distance)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Truck className="h-3.5 w-3.5" />
                                <span className="font-medium">{formatStopCount(favorite.stops)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Details, Bid Now (Left) and Action Buttons (Right) */}
                          <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
                            {/* Left side - Details, Bid Now */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewDetailsBid(favorite)}
                                className="text-xs px-3 py-1.5 h-8"
                              >
                                Details
                              </Button>
                              
                              {!favorite.isExpired && (
                                <Link href="/bid-board">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs px-3 py-1.5 h-8 hover:bg-blue-500/20 hover:text-blue-400"
                                  >
                                    <Zap className="h-3.5 w-3.5 mr-1" />
                                    Bid Now
                                  </Button>
                                </Link>
                              )}
                            </div>

                            {/* Right side - Action Buttons */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateExactMatchTrigger(favorite.bid_number)}
                                disabled={isCreatingTrigger}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border-blue-500/30 p-1 h-7 w-7"
                                title="Get notified when this exact load appears again"
                              >
                                <Bell className="h-3 w-3" />
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowNotificationTriggers(true)}
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 border-purple-500/30 p-1 h-7 w-7"
                                title="Manage notification settings"
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveFavorite(favorite.bid_number)}
                                disabled={isRemoving === favorite.bid_number}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-red-500/30 p-1 h-7 w-7"
                              >
                                {isRemoving === favorite.bid_number ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Footer - My Bid Info */}
                          <div className="flex flex-col gap-2 mt-auto pt-2 border-t flex-shrink-0">
                            {favorite.myBid && (
                              <div className="flex items-center gap-2 text-sm justify-center">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span>My Bid: <span className="font-semibold text-blue-400">${Number(favorite.myBid || 0).toFixed(2)}</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Glass>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium">Bid #</th>
                        <th className="text-left p-3 font-medium">Route</th>
                        <th className="text-left p-3 font-medium">Distance</th>
                        <th className="text-left p-3 font-medium">Tag</th>
                        <th className="text-left p-3 font-medium">Bids</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Match</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFavorites.map((favorite) => {
                        const similarityScore = getSimilarityScoreSync(favorite);
                        return (
                          <tr key={favorite.favorite_id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="font-medium">{favorite.bid_number}</div>
                              {!favorite.isExpired && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <Countdown 
                                    expiresAt={favorite.expiresAt} 
                                    variant={(favorite.timeLeftSeconds || 0) <= 300 ? "urgent" : "default"}
                                    className="font-mono"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate max-w-[200px]" title={formatStops(favorite.stops)}>
                                  {formatStops(favorite.stops)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <Truck className="h-3 w-3 inline mr-1" />
                                {formatStopCount(favorite.stops)}
                              </div>
                            </td>
                            <td className="p-3">
                              <Navigation className="h-3 w-3 inline mr-1 text-muted-foreground" />
                              {formatDistance(favorite.distance)}
                            </td>
                            <td className="p-3">
                              {favorite.tag ? (
                                <Badge variant="secondary" className="text-xs">
                                  {favorite.tag}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge className={favorite.bidCount === 0 ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
                                {favorite.bidCount}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={getStatusColor(favorite)}>
                                {getStatusText(favorite)}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                <Target className="h-3 w-3 inline mr-1" />
                                {similarityScore}%
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCreateExactMatchTrigger(favorite.bid_number)}
                                  disabled={isCreatingTrigger}
                                  className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                                  title="Notify on exact match"
                                >
                                  <Bell className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewDetailsBid(favorite)}
                                  className="h-7 px-2 text-xs"
                                >
                                  Details
                                </Button>
                                {!favorite.isExpired && (
                                  <Link href="/bid-board">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                    >
                                      Bid
                                    </Button>
                                  </Link>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFavorite(favorite.bid_number)}
                                  disabled={isRemoving === favorite.bid_number}
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                  title="Remove"
                                >
                                  {isRemoving === favorite.bid_number ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Details Dialog */}
        <Dialog open={!!viewDetailsBid} onOpenChange={(open) => { if (!open) setViewDetailsBid(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Bid Details - {viewDetailsBid?.bid_number}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewDetailsBid(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                  {viewDetailsBid.sourceChannel && viewDetailsBid.sourceChannel !== '-1002560784901' && (
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <span className="ml-2 font-medium">{viewDetailsBid.sourceChannel}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Favorited:</span>
                    <span className="ml-2 font-medium">
                      {new Date(viewDetailsBid.favorited_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Match Score:</span>
                    <span className="ml-2 font-medium">{getSimilarityScoreSync(viewDetailsBid)}%</span>
                  </div>
                  {viewDetailsBid.myBid && (
                    <div>
                      <span className="text-muted-foreground">My Bid:</span>
                      <span className="ml-2 font-medium text-blue-400">${Number(viewDetailsBid.myBid || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setViewDetailsBid(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

