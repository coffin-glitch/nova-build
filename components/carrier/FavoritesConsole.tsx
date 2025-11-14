"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatDistance, formatStopCount, formatStops, formatStopsDetailed } from "@/lib/format";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BellOff,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Heart,
  Info,
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { US_STATES } from "./US_STATES";

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
  statePreferences: string[];
  equipmentPreferences: string[];
  distanceThresholdMiles: number; // Distance threshold for state preference bid matching (0-1000)
  minDistance: number;
  maxDistance: number;
  // Advanced matching criteria
  minMatchScore: number; // Minimum similarity score to trigger notification (0-100)
  useMinMatchScoreFilter: boolean; // Whether to apply min match score filter to notifications
  timingRelevanceDays: number; // How many days ahead to consider for timing
  backhaulMatcher: boolean; // Enable backhaul matching for exact/state match alerts
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
  const [showSmartNotifications, setShowSmartNotifications] = useState(true);
  const [showStatePrefDialog, setShowStatePrefDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [maxCompetitionBids, setMaxCompetitionBids] = useState<number>(10);
  const [avoidHighCompetition, setAvoidHighCompetition] = useState<boolean>(false);
  const [showMatchTypeDialog, setShowMatchTypeDialog] = useState<string | null>(null); // bid_number when dialog is open
  const [selectedMatchType, setSelectedMatchType] = useState<'exact' | 'state' | null>(null);
  const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);
  const [showEditTriggerDialog, setShowEditTriggerDialog] = useState(false);
  
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
  const { data: triggersData, mutate: mutateTriggers, isLoading: isLoadingTriggers } = useSWR(
    isOpen ? `/api/carrier/notification-triggers` : null,
    fetcher,
    { 
      refreshInterval: 30000,
      fallbackData: { ok: true, data: [] },
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000 // Prevent duplicate requests within 5 seconds
    }
  );

  const favorites: FavoriteBid[] = data?.data || [];
  
  // Stabilize notification triggers array to prevent flashing
  const notificationTriggers: NotificationTrigger[] = useMemo(() => {
    // If we have valid data, use it
    if (triggersData?.ok && Array.isArray(triggersData?.data)) {
      return triggersData.data;
    }
    // If data exists but not ok, still try to use it if it's an array
    if (Array.isArray(triggersData?.data)) {
      return triggersData.data;
    }
    // Return empty array as fallback
    return [];
  }, [triggersData]);
  
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
    statePreferences: [],
    equipmentPreferences: [],
    distanceThresholdMiles: 50,
    minDistance: 0,
    maxDistance: 2000,
    minMatchScore: 70,
    useMinMatchScoreFilter: true,
    timingRelevanceDays: 7,
    backhaulMatcher: true,
    avoidHighCompetition: false,
    maxCompetitionBids: 10,
  };

  // Preference presets/templates
  const preferencePresets = {
    'conservative': {
      name: 'Conservative',
      description: 'Fewer, high-quality notifications',
      preferences: {
        ...defaultPreferences,
        minMatchScore: 85,
        useMinMatchScoreFilter: true,
        distanceThresholdMiles: 30,
        avoidHighCompetition: true,
        maxCompetitionBids: 5,
      }
    },
    'balanced': {
      name: 'Balanced',
      description: 'Good mix of quality and quantity',
      preferences: {
        ...defaultPreferences,
        minMatchScore: 70,
        useMinMatchScoreFilter: true,
        distanceThresholdMiles: 50,
        avoidHighCompetition: false,
        maxCompetitionBids: 10,
      }
    },
    'aggressive': {
      name: 'Aggressive',
      description: 'More notifications, cast a wider net',
      preferences: {
        ...defaultPreferences,
        minMatchScore: 50,
        useMinMatchScoreFilter: false,
        distanceThresholdMiles: 100,
        avoidHighCompetition: false,
        maxCompetitionBids: 20,
      }
    },
    'local': {
      name: 'Local Routes',
      description: 'Optimized for short-distance loads',
      preferences: {
        ...defaultPreferences,
        minDistance: 0,
        maxDistance: 300,
        distanceThresholdMiles: 25,
        minMatchScore: 65,
      }
    },
    'long-haul': {
      name: 'Long Haul',
      description: 'Optimized for long-distance loads',
      preferences: {
        ...defaultPreferences,
        minDistance: 500,
        maxDistance: 2000,
        distanceThresholdMiles: 75,
        minMatchScore: 75,
      }
    }
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
    const prefs = preferences;
    
    // New calculation based on selected states, timing relevance, and min/max distance
    let stateMatchScore = 0;
    let distanceScore = 0;
    let timingScore = 0;
    
    // 1. STATE PREFERENCE MATCHING (40% weight)
    if (prefs.statePreferences.length > 0 && bid.stops && Array.isArray(bid.stops) && bid.stops.length > 0) {
      const originState = extractStateFromStop(bid.stops[0]);
      if (originState && prefs.statePreferences.includes(originState)) {
        stateMatchScore = 100; // Perfect match if pickup state is in preferences
      } else {
        stateMatchScore = 0; // No match
      }
    } else if (prefs.statePreferences.length === 0) {
      stateMatchScore = 50; // Neutral if no state preferences set
    } else {
      stateMatchScore = 0; // No state data or no match
    }
    
    // 2. DISTANCE MATCHING (35% weight)
    if (bid.distance >= prefs.minDistance && bid.distance <= prefs.maxDistance) {
      const distanceRange = prefs.maxDistance - prefs.minDistance;
      if (distanceRange > 0) {
        const distanceFromMin = bid.distance - prefs.minDistance;
        const normalizedDistance = distanceFromMin / distanceRange;
        // Prefer distances in the middle-upper range (50-80% of range)
        if (normalizedDistance >= 0.5 && normalizedDistance <= 0.8) {
          distanceScore = 100;
        } else if (normalizedDistance >= 0.3 && normalizedDistance <= 0.9) {
          distanceScore = 80;
        } else {
          distanceScore = 60;
        }
      } else {
        distanceScore = 70; // Default if range is 0
      }
    } else {
      // Penalty for out-of-range distances
      if (bid.distance < prefs.minDistance) {
        const percentShort = ((prefs.minDistance - bid.distance) / prefs.minDistance) * 100;
        distanceScore = Math.max(0, 50 - percentShort / 2);
      } else {
        const percentOver = ((bid.distance - prefs.maxDistance) / prefs.maxDistance) * 100;
        distanceScore = Math.max(0, 50 - percentOver / 5);
      }
    }
    
    // 3. TIMING RELEVANCE (25% weight)
    const now = new Date();
    const relevanceWindow = prefs.timingRelevanceDays || 7;
    
    if (bid.pickupDate) {
      const pickupDate = new Date(bid.pickupDate);
      const daysUntilPickup = (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilPickup >= 0 && daysUntilPickup <= relevanceWindow) {
        if (daysUntilPickup <= 1) {
          timingScore = 100; // Within 24 hours - perfect
        } else if (daysUntilPickup <= 2) {
          timingScore = 90; // Within 2 days
        } else if (daysUntilPickup <= 3) {
          timingScore = 80; // Within 3 days
        } else {
          // Decay score based on remaining window
          const remainingDays = Math.max(1, relevanceWindow - 3);
          const decayPercent = Math.max(0, (relevanceWindow - daysUntilPickup) / remainingDays);
          timingScore = 80 * decayPercent + 20; // Scale between 20-80
        }
      } else if (daysUntilPickup < 0) {
        timingScore = 10; // Past pickup time
      } else {
        timingScore = 0; // Beyond relevance window
      }
    } else {
      timingScore = 50; // No pickup date - neutral
    }
    
    // Calculate weighted composite score
    const compositeScore = (
      stateMatchScore * 0.40 +
      distanceScore * 0.35 +
      timingScore * 0.25
    );
    
    return Math.round(Math.max(0, Math.min(100, compositeScore)));
  };


  // Helper to extract state from stop string (same logic as heat map)
  const extractStateFromStop = (stop: string): string | null => {
    if (!stop) return null;
    const trimmed = stop.trim().toUpperCase();
    const validStates = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ]);
    let match = trimmed.match(/,\s*([A-Z]{2})$/);
    if (match && validStates.has(match[1])) return match[1];
    match = trimmed.match(/\s+([A-Z]{2})$/);
    if (match && validStates.has(match[1])) return match[1];
    match = trimmed.match(/,\s*([A-Z]{2})\s*,/);
    if (match && validStates.has(match[1])) return match[1];
    match = trimmed.match(/([A-Z]{2})$/);
    if (match && validStates.has(match[1])) return match[1];
    return null;
  };

  const handleCreateExactMatchTrigger = async (bidNumber: string) => {
    setIsCreatingTrigger(true);
    try {
      // Get the favorite bid to extract distance information
      const favorite = favorites.find(f => f.bid_number === bidNumber);
      if (!favorite || favorite.distance === undefined) {
        toast.error("Cannot create trigger: distance information missing");
        setIsCreatingTrigger(false);
        return;
      }

      // Use distance range from preferences, or default to favorite distance ± 50 miles
      const minDistance = preferences.minDistance || Math.max(0, favorite.distance - 50);
      const maxDistance = preferences.maxDistance || favorite.distance + 50;

      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'exact_match',
          triggerConfig: {
            favoriteDistanceRange: {
              minDistance,
              maxDistance
            },
            matchType: 'exact' // Exact city-to-city match
          },
          isActive: true
        })
      });

      const result = await response.json();
      if (result.ok) {
        toast.success(`Exact match notifications enabled for ${bidNumber}!`);
        mutateTriggers();
        setShowMatchTypeDialog(null);
        setSelectedMatchType(null);
      } else {
        // Check if it's a duplicate state match error
        if (result.error && result.error.includes('already have a state match')) {
          toast.error(result.error);
        } else {
          toast.error(result.error || "Failed to create notification trigger");
        }
      }
    } catch (error) {
      toast.error("Failed to create notification trigger");
    } finally {
      setIsCreatingTrigger(false);
    }
  };

  const handleCreateStateMatchTrigger = async (bidNumber: string) => {
    setIsCreatingTrigger(true);
    try {
      // Get the favorite bid to extract state and distance information
      const favorite = favorites.find(f => f.bid_number === bidNumber);
      if (!favorite || !favorite.stops || favorite.stops.length < 2) {
        toast.error("Cannot create state match: route information missing");
        setIsCreatingTrigger(false);
        return;
      }

      if (favorite.distance === undefined) {
        toast.error("Cannot create state match: distance information missing");
        setIsCreatingTrigger(false);
        return;
      }

      // Extract origin and destination states
      const originStop = favorite.stops[0];
      const destinationStop = favorite.stops[favorite.stops.length - 1];
      const originState = extractStateFromStop(originStop);
      const destinationState = extractStateFromStop(destinationStop);

      if (!originState || !destinationState) {
        toast.error("Cannot create state match: state information missing");
        setIsCreatingTrigger(false);
        return;
      }

      // Use distance range from preferences, or default to favorite distance ± 50 miles
      const minDistance = preferences.minDistance || Math.max(0, favorite.distance - 50);
      const maxDistance = preferences.maxDistance || favorite.distance + 50;

      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'exact_match', // Using same type but with state match config
          triggerConfig: {
            favoriteDistanceRange: {
              minDistance,
              maxDistance
            },
            matchType: 'state', // State-to-state match
            originState,
            destinationState
          },
          isActive: true
        })
      });

      const result = await response.json();
      if (result.ok) {
        toast.success(`State match notifications enabled for ${originState} → ${destinationState}!`);
        mutateTriggers();
        setShowMatchTypeDialog(null);
        setSelectedMatchType(null);
      } else {
        // Check if it's a duplicate state match error
        if (result.error && result.error.includes('already have a state match')) {
          toast.error(result.error);
        } else {
          toast.error(result.error || "Failed to create notification trigger");
        }
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

  const handleEditTrigger = async (triggerId: string, updates: { triggerConfig?: any; isActive?: boolean }) => {
    try {
      const response = await fetch('/api/carrier/notification-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: triggerId,
          ...updates
        })
      });
      const result = await response.json();
      if (result.ok) {
        toast.success("Trigger updated successfully");
        mutateTriggers();
        setShowEditTriggerDialog(false);
        setEditingTrigger(null);
      } else {
        toast.error(result.error || "Failed to update trigger");
      }
    } catch (error) {
      toast.error("Failed to update trigger");
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
          <DialogDescription>
            Manage your favorited bids and configure smart notification alerts
          </DialogDescription>
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
                      title="Average Match Score: Calculated based on (1) State Preference Matching (40%): Checks if pickup state matches your selected states, (2) Distance Matching (35%): Based on whether distance falls within your min/max range, and (3) Timing Relevance (25%): Based on pickup date within your timing relevance window. Each bid's score is averaged across all your favorites."
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
                {showPreferences ? <BellOff className="h-3 w-3 mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help">
                            ?
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-md p-4">
                          <div className="space-y-3 text-xs">
                            <p className="font-semibold text-sm">Example Notification Scheme:</p>
                            <div className="space-y-1">
                              <p><strong>Distance Range:</strong> 100-500 miles</p>
                              <p><strong>Distance Threshold:</strong> 50 miles</p>
                              <p><strong>State Preferences:</strong> IL, PA</p>
                              <p><strong>Min Match Score:</strong> 70 (filtering: ON)</p>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <p className="font-semibold mb-2">What Will Trigger:</p>
                              <ul className="list-disc list-inside space-y-2 ml-2">
                                <li><strong>Exact Match:</strong> Loads matching your exact favorite route (e.g., City A → City B). <strong>Distance does NOT matter</strong> - only the exact city-to-city route. The system monitors all your favorites that fall within your distance range for route matching.</li>
                                <li><strong>State Match:</strong> Loads matching the same state-to-state route (e.g., IL → PA) regardless of specific cities, AND within your distance range (100-500 miles). More flexible than exact match - gives you more opportunities.</li>
                                <li><strong>State Pref Bid:</strong> Loads within 50 miles of your favorite's distance (e.g., favorite is 300mi → matches 250-350mi), AND between 100-500 miles total, AND from IL or PA, AND match score ≥ 70 (if filtering enabled)</li>
                                <li><strong>Backhaul:</strong> If enabled, reverse routes (City B → City A or PA → IL) also trigger exact/state match alerts. For exact match, distance doesn't matter. For state match, distance range applies.</li>
                              </ul>
                            </div>
                            <div className="mt-3 pt-3 border-t bg-muted/30 p-2 rounded">
                              <p className="text-muted-foreground text-xs"><strong>Important:</strong> Triggers use your distance range (min/max) to determine which favorites to monitor. For <strong>Exact Match</strong>, distance is ignored when matching loads - only the exact route matters. For <strong>State Match</strong>, distance range applies to filter matching loads.</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs px-2 py-1 rounded border bg-background text-foreground"
                      onChange={(e) => {
                        const presetKey = e.target.value;
                        if (presetKey && presetKey !== 'custom') {
                          const preset = preferencePresets[presetKey as keyof typeof preferencePresets];
                          if (preset) {
                            setEditingPreferences(preset.preferences);
                            toast.success(`Applied ${preset.name} preset`);
                          }
                        }
                        e.target.value = 'custom'; // Reset to custom after selection
                      }}
                      defaultValue="custom"
                      title="Load a preset configuration"
                    >
                      <option value="custom">Custom</option>
                      {Object.entries(preferencePresets).map(([key, preset]) => (
                        <option key={key} value={key}>{preset.name}</option>
                      ))}
                    </select>
                    <Button
                      variant={showSmartNotifications ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      title="Show/Hide Smart Notifications"
                      onClick={() => setShowSmartNotifications(!showSmartNotifications)}
                    >
                      {showSmartNotifications ? "Hide" : "Show"} Smart
                    </Button>
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
                </div>
                
                {/* Advanced Settings Panel */}
                {showAdvancedSettings && (
                  <div className="mt-4 p-4 bg-muted/20 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-400" />
                        <h4 className="text-sm font-semibold">Advanced Matching Criteria</h4>
                      </div>
                      {/* State Pref Button */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          title="Select States for Pickup Notifications"
                          onClick={() => setShowStatePrefDialog(true)}
                        >
                          State Pref
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Min Match Score */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium flex items-center gap-1">
                            Min Match Score (0-100)
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help">?</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <p><strong>How it works:</strong></p>
                                    <p>Minimum similarity score (0-100) required to trigger notifications. Higher = fewer but better alerts.</p>
                                    <p className="mt-2"><strong>Filter Toggle:</strong></p>
                                    <p><strong>ON:</strong> Only sends notifications when match score ≥ this threshold</p>
                                    <p><strong>OFF:</strong> Sends notifications for all matches, but scores still display on cards</p>
                                    <p className="mt-2 text-muted-foreground">Example: Score = 65, Threshold = 70 → Notification sent only if filter is OFF</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Use for filtering</span>
                            <Button
                              type="button"
                              variant={preferences.useMinMatchScoreFilter ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setEditingPreferences(prev => ({ ...(prev || preferences), useMinMatchScoreFilter: !(prev || preferences).useMinMatchScoreFilter }));
                              }}
                              className={`h-6 px-2 text-xs ${preferences.useMinMatchScoreFilter ? "bg-primary text-primary-foreground" : ""}`}
                            >
                              {preferences.useMinMatchScoreFilter ? "ON" : "OFF"}
                            </Button>
                          </div>
                        </div>
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Score still displays on cards even when filtering is {preferences.useMinMatchScoreFilter ? "enabled" : "disabled"}
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

                      {/* Backhaul Matcher */}
                      <div className="flex items-center justify-between mt-6">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium">Backhaul Matcher</label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Enable backhaul matching for your exact/state match alerts. When enabled, you'll also receive notifications for return route opportunities that match your favorited loads.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Button
                          variant={preferences.backhaulMatcher ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          onClick={() => setEditingPreferences(prev => ({ ...(prev || preferences), backhaulMatcher: !(prev || preferences).backhaulMatcher }))}
                        >
                          {preferences.backhaulMatcher ? 'ON' : 'OFF'}
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
                        <label className="text-xs font-medium">State Pref Bid Notifications</label>
                        <p className="text-xs text-muted-foreground">Master control for state preference notifications</p>
                      </div>
                      <Button
                        variant={preferences.similarLoadNotifications ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newValue = !preferences.similarLoadNotifications;
                          setEditingPreferences(prev => ({ ...(prev || preferences), similarLoadNotifications: newValue }));
                          // Just toggle the state - user must press Save to persist
                        }}
                        className={preferences.similarLoadNotifications ? "bg-primary text-primary-foreground" : ""}
                      >
                        {preferences.similarLoadNotifications ? "ON" : "OFF"}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Distance Threshold Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium">Distance Threshold</label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] cursor-help">
                                ?
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-md p-4">
                              <div className="space-y-3 text-xs">
                                <div>
                                  <p className="font-semibold text-sm mb-2">How Distance Threshold Works:</p>
                                  <p>Controls how similar a new load's distance must be to your favorites for <strong>"State Pref Bid"</strong> notifications. This creates a flexible matching window around your favorite loads' distances.</p>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t">
                                  <p className="font-semibold mb-2">Step-by-Step Example:</p>
                                  <p className="mb-2">If you have a favorite load that is <strong>300 miles</strong> and your threshold is <strong>50 miles</strong>:</p>
                                  <div className="space-y-1 ml-2">
                                    <p>✅ <strong>Matches:</strong> 250-350 miles (300 ± 50)</p>
                                    <p className="text-muted-foreground">   → Loads between 250-350 miles will trigger notifications</p>
                                    <p>❌ <strong>Doesn&apos;t match:</strong> 200 miles (difference = 100, &gt; 50)</p>
                                    <p className="text-muted-foreground">   → Loads outside the ±50 mile window won&apos;t trigger</p>
                                    <p>❌ <strong>Doesn&apos;t match:</strong> 400 miles (difference = 100, &gt; 50)</p>
                                    <p className="text-muted-foreground">   → Too far from your favorite&apos;s distance</p>
                                  </div>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t">
                                  <p className="font-semibold mb-2">Important Notes:</p>
                                  <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                                    <li>Only used for <strong>State Pref Bid</strong> matching</li>
                                    <li><strong>Exact Match</strong> notifications ignore distance completely - only route matters</li>
                                    <li><strong>State Match</strong> notifications use your distance range (min/max) to filter loads</li>
                                    <li>Lower threshold = stricter matching (fewer notifications)</li>
                                    <li>Higher threshold = more flexible matching (more notifications)</li>
                                  </ul>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t bg-muted/30 p-2 rounded">
                                  <p className="text-xs"><strong>Formula:</strong> |New Load Distance - Favorite Distance| ≤ Distance Threshold</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="px-2">
                        <Slider
                          value={[preferences.distanceThresholdMiles || 50]}
                          onValueChange={(value) => {
                            setEditingPreferences(prev => ({ ...(prev || preferences), distanceThresholdMiles: value[0] }));
                          }}
                          min={0}
                          max={1000}
                          step={10}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>0 mi</span>
                          <span className="font-medium">{preferences.distanceThresholdMiles || 50} miles</span>
                          <span>1000 mi</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Min/Max Distance */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium">Min Distance (Miles)</label>
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
                        <label className="text-xs font-medium">Max Distance (Miles)</label>
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

          {/* Smart Notifications Panel - Controlled by showSmartNotifications */}
          {showSmartNotifications && (
            <Glass className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    <h3 className="text-sm font-semibold">Smart Notifications</h3>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <>
                  {/* Backhaul Matcher Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Navigation className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">Backhaul Matcher</h4>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Enable backhaul matching for your exact/state match alerts. When enabled, you'll also receive notifications for return route opportunities that match your favorited loads.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Get notified about return route opportunities
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={preferences.backhaulMatcher ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newValue = !preferences.backhaulMatcher;
                        setEditingPreferences(prev => ({ ...(prev || preferences), backhaulMatcher: newValue }));
                        // Just toggle the state - user must press Save to persist
                        // This matches the behavior of the backhaul matcher in advanced matching criteria
                      }}
                      className={preferences.backhaulMatcher ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                    >
                      {preferences.backhaulMatcher ? (
                        <>
                          <Navigation className="h-3 w-3 mr-1" />
                          ON
                        </>
                      ) : (
                        "OFF"
                      )}
                    </Button>
                  </div>

                  {/* Active Exact/State Match Triggers */}
                  {(() => {
                    // Ensure notificationTriggers is always an array
                    const safeTriggers = Array.isArray(notificationTriggers) ? notificationTriggers : [];
                    const exactMatchTriggers = safeTriggers.filter(
                      (t: NotificationTrigger) => t && t.trigger_type === 'exact_match'
                    );
                    
                    // Always show triggers if we have them, regardless of loading state
                    // This prevents flickering during refetches - use memoized notificationTriggers
                    if (exactMatchTriggers.length > 0) {
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Active Alerts ({exactMatchTriggers.length})</h4>
                          </div>
                          {exactMatchTriggers.map((trigger) => {
                          const config = trigger.trigger_config || {};
                          const matchType = config.matchType || 'exact';
                          // Check if trigger uses distance range (new) or bid numbers (legacy)
                          const favoriteDistanceRange = config.favoriteDistanceRange;
                          const favoriteBidNumbers = config.favoriteBidNumbers || [];
                          
                          // For new triggers, find favorites within the distance range
                          // For legacy triggers, find by bid number
                          let favorite = null;
                          if (favoriteDistanceRange) {
                            favorite = favorites.find(f => 
                              f.distance !== undefined &&
                              f.distance >= favoriteDistanceRange.minDistance &&
                              f.distance <= favoriteDistanceRange.maxDistance
                            );
                          } else if (favoriteBidNumbers.length > 0) {
                            favorite = favorites.find(f => favoriteBidNumbers.includes(f.bid_number));
                          }
                          
                          return (
                            <div key={trigger.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg ${matchType === 'exact' ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
                                  {matchType === 'exact' ? (
                                    <Target className="h-4 w-4 text-blue-400" />
                                  ) : (
                                    <MapPin className="h-4 w-4 text-purple-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-xs ${matchType === 'exact' ? 'border-blue-400 text-blue-400' : 'border-purple-400 text-purple-400'}`}>
                                      {matchType === 'exact' ? 'Exact Match' : 'State Match'}
                                    </Badge>
                                    {favorite && (
                                      <span className="text-sm font-medium truncate">
                                        #{favorite.bid_number}
                                      </span>
                                    )}
                                  </div>
                                  {favorite && favorite.stops && (
                                    <p className="text-xs text-muted-foreground truncate mt-1">
                                      {formatStops(favorite.stops)}
                                    </p>
                                  )}
                                  {!favorite && trigger.route && (
                                    <p className="text-xs text-muted-foreground truncate mt-1">
                                      {Array.isArray(trigger.route) ? formatStops(trigger.route) : trigger.route}
                                    </p>
                                  )}
                                  {matchType === 'state' && config.originState && config.destinationState && (
                                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                                      {config.originState} → {config.destinationState}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Backhaul Toggle for this trigger */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant={config.backhaulEnabled ? "default" : "outline"}
                                        size="sm"
                                        onClick={async () => {
                                          const newBackhaulEnabled = !(config.backhaulEnabled || false);
                                          try {
                                            const response = await fetch('/api/carrier/notification-triggers', {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                id: trigger.id,
                                                triggerConfig: {
                                                  ...config,
                                                  backhaulEnabled: newBackhaulEnabled
                                                }
                                              })
                                            });
                                            const result = await response.json();
                                            if (result.ok) {
                                              toast.success(`Backhaul matching ${newBackhaulEnabled ? 'enabled' : 'disabled'}`);
                                              mutateTriggers();
                                            } else {
                                              toast.error(result.error || "Failed to update backhaul setting");
                                            }
                                          } catch (error) {
                                            toast.error("Failed to update backhaul setting");
                                          }
                                        }}
                                        className={`text-xs px-2 py-1 ${config.backhaulEnabled ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                                        title={config.backhaulEnabled ? "Disable backhaul matching" : "Enable backhaul matching"}
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{config.backhaulEnabled ? "Backhaul matching enabled - Click to disable" : "Enable backhaul matching for this alert"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTrigger(trigger);
                                    setShowEditTriggerDialog(true);
                                  }}
                                  className="text-xs px-2 py-1 text-blue-400 hover:text-blue-300"
                                  title="Edit alert settings"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant={trigger.is_active ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleTrigger(trigger.id, trigger.is_active)}
                                  className={`text-xs px-2 py-1 ${trigger.is_active ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}`}
                                  title={trigger.is_active ? "Disable alert" : "Enable alert"}
                                >
                                  {trigger.is_active ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteTrigger(trigger.id)}
                                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                                  title="Delete alert"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      );
                    }
                    
                    // Only show "No active alerts" if we have confirmed there are no triggers
                    // Use a more stable check to prevent flickering during refetches
                    // Check if we've successfully loaded data at least once (use a ref or state to track this)
                    const hasLoadedOnce = !isLoadingTriggers && (triggersData !== undefined);
                    const hasValidResponse = triggersData?.ok === true;
                    
                    // Only show empty state if we've confirmed there are no triggers and we have a valid response
                    // AND we're not currently loading
                    if (!isLoadingTriggers && hasValidResponse && exactMatchTriggers.length === 0 && hasLoadedOnce) {
                      return (
                        <div className="text-center py-6 text-muted-foreground">
                          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No active alerts</p>
                          <p className="text-xs mt-1">Click the bell icon on any favorite to enable alerts</p>
                        </div>
                      );
                    }
                    
                    // During initial load (still loading), show nothing to prevent flickering
                    if (isLoadingTriggers && exactMatchTriggers.length === 0) {
                      return null;
                    }
                    
                    // If we're here, we're in a loading state but have no triggers yet
                    // Return null to prevent flickering
                    return null;
                  })()}
                  
                  {/* Legacy Active Triggers (for other types) */}
                  {(() => {
                    const otherTriggers = notificationTriggers.filter(
                      (t: NotificationTrigger) => t.trigger_type !== 'exact_match'
                    );
                    
                    if (otherTriggers.length === 0) return null;
                    
                    return (
                      <div className="space-y-2 pt-4 border-t">
                        <div className="text-sm font-medium text-muted-foreground">Other Triggers</div>
                        {otherTriggers.map((trigger) => {
                          const triggerConfig = trigger.trigger_config || {};
                          return (
                          <div key={trigger.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="p-2 rounded-lg bg-orange-500/20">
                                <Bell className="h-4 w-4 text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {trigger.trigger_type.replace('_', ' ')}
                                  </Badge>
                                  {trigger.bid_number && (
                                    <span className="text-sm font-medium truncate">
                                      #{trigger.bid_number}
                                    </span>
                                  )}
                                </div>
                                {trigger.route && (
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {Array.isArray(trigger.route) ? formatStops(trigger.route) : trigger.route}
                                  </p>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {trigger.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Backhaul Toggle for state preference bid triggers */}
                              {trigger.trigger_type === 'similar_load' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant={triggerConfig.backhaulEnabled ? "default" : "outline"}
                                        size="sm"
                                        onClick={async () => {
                                          const newBackhaulEnabled = !(triggerConfig.backhaulEnabled || false);
                                          try {
                                            const response = await fetch('/api/carrier/notification-triggers', {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                id: trigger.id,
                                                triggerConfig: {
                                                  ...triggerConfig,
                                                  backhaulEnabled: newBackhaulEnabled
                                                }
                                              })
                                            });
                                            const result = await response.json();
                                            if (result.ok) {
                                              toast.success(`Backhaul matching ${newBackhaulEnabled ? 'enabled' : 'disabled'}`);
                                              mutateTriggers();
                                            } else {
                                              toast.error(result.error || "Failed to update backhaul setting");
                                            }
                                          } catch (error) {
                                            toast.error("Failed to update backhaul setting");
                                          }
                                        }}
                                        className={`text-xs px-2 py-1 ${triggerConfig.backhaulEnabled ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                                        title={triggerConfig.backhaulEnabled ? "Disable backhaul matching" : "Enable backhaul matching"}
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{triggerConfig.backhaulEnabled ? "Backhaul matching enabled" : "Enable backhaul matching"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleTrigger(trigger.id, trigger.is_active)}
                                className="text-xs px-2 py-1"
                                title={trigger.is_active ? "Disable alert" : "Enable alert"}
                              >
                                {trigger.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTrigger(trigger.id)}
                                className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                                title="Delete alert"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                    </div>
                    );
                  })()}
                  </>
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
                              {/* Check if trigger already exists for this bid */}
                              {(() => {
                                  const existingTrigger = notificationTriggers.find(
                                    (t: NotificationTrigger) => {
                                      if (t.trigger_type !== 'exact_match') return false;
                                      const config = t.trigger_config || {};
                                      
                                      // Check new distance range format
                                      if (config.favoriteDistanceRange) {
                                        return favorite.distance !== undefined &&
                                          favorite.distance >= config.favoriteDistanceRange.minDistance &&
                                          favorite.distance <= config.favoriteDistanceRange.maxDistance;
                                      }
                                      
                                      // Check legacy bid number format
                                      return config.favoriteBidNumbers?.includes(favorite.bid_number);
                                    }
                                  );
                                
                                if (existingTrigger) {
                                  const matchType = existingTrigger.trigger_config?.matchType || 'exact';
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="default"
                                            size="sm"
                                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border-blue-500/30 p-1 h-7 w-7 bg-blue-500/20"
                                            title={matchType === 'exact' 
                                              ? "Exact match notifications enabled - Click to change" 
                                              : "State match notifications enabled - Click to change"}
                                            onClick={() => setShowMatchTypeDialog(favorite.bid_number)}
                                          >
                                            <Bell className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{matchType === 'exact' ? 'Exact Match Active' : 'State Match Active'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }
                                
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setShowMatchTypeDialog(favorite.bid_number)}
                                          disabled={isCreatingTrigger}
                                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 border-blue-500/30 p-1 h-7 w-7"
                                        >
                                          <Bell className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Enable smart alerts for this load</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })()}
                              
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
                                {(() => {
                                  const existingTrigger = notificationTriggers.find(
                                    (t: NotificationTrigger) => {
                                      if (t.trigger_type !== 'exact_match') return false;
                                      const config = t.trigger_config || {};
                                      
                                      // Check new distance range format
                                      if (config.favoriteDistanceRange) {
                                        return favorite.distance !== undefined &&
                                          favorite.distance >= config.favoriteDistanceRange.minDistance &&
                                          favorite.distance <= config.favoriteDistanceRange.maxDistance;
                                      }
                                      
                                      // Check legacy bid number format
                                      return config.favoriteBidNumbers?.includes(favorite.bid_number);
                                    }
                                  );
                                  
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant={existingTrigger ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setShowMatchTypeDialog(favorite.bid_number)}
                                            disabled={isCreatingTrigger}
                                            className={`h-7 w-7 p-0 ${existingTrigger ? 'text-blue-400 bg-blue-500/20' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20'}`}
                                          >
                                            <Bell className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{existingTrigger ? 'Smart alerts enabled - Click to change' : 'Enable smart alerts'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
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
              <DialogDescription>
                View detailed information about this favorited bid
              </DialogDescription>
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

        {/* Match Type Selection Dialog */}
        <Dialog open={!!showMatchTypeDialog} onOpenChange={(open) => !open && setShowMatchTypeDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Smart Alert Options
              </DialogTitle>
              <DialogDescription>
                Choose how you want to be notified for bid #{showMatchTypeDialog}
              </DialogDescription>
            </DialogHeader>
            
            {showMatchTypeDialog && (() => {
              const favorite = favorites.find(f => f.bid_number === showMatchTypeDialog);
              const originState = favorite?.stops?.[0] ? extractStateFromStop(favorite.stops[0]) : null;
              const destinationState = favorite?.stops?.[favorite.stops.length - 1] 
                ? extractStateFromStop(favorite.stops[favorite.stops.length - 1]) 
                : null;
              
              return (
                <div className="space-y-4 py-4">
                  {/* Exact Match Option */}
                  <div 
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedMatchType === 'exact' 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-border hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedMatchType('exact')}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedMatchType === 'exact' 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-muted-foreground'
                      }`}>
                        {selectedMatchType === 'exact' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">Exact Match</h4>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Get notified when the exact same route (same cities and states) appears again on the bid board.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifies you when the exact city-to-city route matches your favorited load.
                        </p>
                        {favorite && (
                          <p className="text-xs text-muted-foreground mt-2 font-mono">
                            {formatStops(favorite.stops)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* State Match Option */}
                  <div 
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedMatchType === 'state' 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-border hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedMatchType('state')}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedMatchType === 'state' 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-muted-foreground'
                      }`}>
                        {selectedMatchType === 'state' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">State Match</h4>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Get notified when any load with the same state-to-state route appears, regardless of specific cities.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Notifies you when any load matches the same state-to-state route, giving you more opportunities.
                        </p>
                        {originState && destinationState && (
                          <p className="text-xs text-muted-foreground mt-2 font-mono">
                            {originState} → {destinationState}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowMatchTypeDialog(null);
        setSelectedMatchType(null);
                        setSelectedMatchType(null);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedMatchType === 'exact') {
                          handleCreateExactMatchTrigger(showMatchTypeDialog);
                        } else if (selectedMatchType === 'state') {
                          handleCreateStateMatchTrigger(showMatchTypeDialog);
                        }
                      }}
                      disabled={!selectedMatchType || isCreatingTrigger}
                      className="flex-1"
                    >
                      {isCreatingTrigger ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Enabling...
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4 mr-2" />
                          Enable {selectedMatchType === 'exact' ? 'Exact' : 'State'} Match
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Trigger Dialog */}
        <Dialog open={showEditTriggerDialog} onOpenChange={setShowEditTriggerDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Notification Trigger</DialogTitle>
              <DialogDescription>
                Update trigger settings without deleting and recreating
              </DialogDescription>
            </DialogHeader>
            {editingTrigger && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Trigger Type</label>
                  <p className="text-sm text-muted-foreground capitalize">
                    {editingTrigger.trigger_type.replace('_', ' ')}
                  </p>
                </div>
                {editingTrigger.trigger_config?.favoriteDistanceRange && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Min Distance (Miles)</label>
                      <Input
                        type="number"
                        min="0"
                        defaultValue={editingTrigger.trigger_config.favoriteDistanceRange.minDistance}
                        onChange={(e) => {
                          const newConfig = {
                            ...editingTrigger.trigger_config,
                            favoriteDistanceRange: {
                              ...editingTrigger.trigger_config.favoriteDistanceRange,
                              minDistance: parseInt(e.target.value) || 0
                            }
                          };
                          setEditingTrigger({ ...editingTrigger, trigger_config: newConfig });
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Max Distance (Miles)</label>
                      <Input
                        type="number"
                        min="0"
                        defaultValue={editingTrigger.trigger_config.favoriteDistanceRange.maxDistance}
                        onChange={(e) => {
                          const newConfig = {
                            ...editingTrigger.trigger_config,
                            favoriteDistanceRange: {
                              ...editingTrigger.trigger_config.favoriteDistanceRange,
                              maxDistance: parseInt(e.target.value) || 2000
                            }
                          };
                          setEditingTrigger({ ...editingTrigger, trigger_config: newConfig });
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Active</label>
                  <Button
                    variant={editingTrigger.is_active ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setEditingTrigger({ ...editingTrigger, is_active: !editingTrigger.is_active });
                    }}
                  >
                    {editingTrigger.is_active ? "Active" : "Inactive"}
                  </Button>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditTriggerDialog(false);
                      setEditingTrigger(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      handleEditTrigger(editingTrigger.id, {
                        triggerConfig: editingTrigger.trigger_config,
                        isActive: editingTrigger.is_active
                      });
                    }}
                    className="flex-1"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
      
      {/* State Preference Selection Dialog */}
      <Dialog open={showStatePrefDialog} onOpenChange={setShowStatePrefDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select States for Pickup Notifications
            </DialogTitle>
            <DialogDescription>
              Select states where you want to receive notifications for any bid picking up in those states, regardless of delivery location.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-4">
              {US_STATES.map((state) => {
                const currentPrefs = editingPreferences || preferences;
                const isSelected = currentPrefs.statePreferences.includes(state.code);
                return (
                  <Button
                    key={state.code}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={`text-xs h-auto py-2 px-3 flex flex-col items-center gap-1 ${
                      isSelected ? "bg-blue-500 hover:bg-blue-600 text-white" : ""
                    }`}
                    onClick={() => {
                      const newStatePrefs = isSelected
                        ? currentPrefs.statePreferences.filter((s: string) => s !== state.code)
                        : [...currentPrefs.statePreferences, state.code];
                      setEditingPreferences({
                        ...currentPrefs,
                        statePreferences: newStatePrefs
                      });
                    }}
                  >
                    <span className="font-bold text-sm">{state.code}</span>
                    <span className="text-[10px] opacity-80">{state.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              {(editingPreferences || preferences).statePreferences.length} state{(editingPreferences || preferences).statePreferences.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingPreferences(prev => ({
                    ...(prev || preferences),
                    statePreferences: []
                  }));
                }}
              >
                Clear All
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  await handleSavePreferences();
                  setShowStatePrefDialog(false);
                }}
              >
                Save States
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

