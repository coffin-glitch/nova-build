"use client";

import FavoritesConsole from "@/components/carrier/FavoritesConsole";
import ManageBidsConsole from "@/components/carrier/ManageBidsConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/Countdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeCarrierProfiles } from "@/hooks/useRealtimeCarrierProfiles";
import { useRealtimeSystemSettings } from "@/hooks/useRealtimeSystemSettings";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useIsAdmin } from "@/hooks/useUserRole";
import { TelegramBid } from "@/lib/auctions";
import { formatDistance, formatPickupDateTime, formatStopCount, formatStops, formatStopsDetailed, ParsedAddress } from "@/lib/format";
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Gavel,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Star,
  Truck,
  User
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

// Parse stops helper (matching admin page exactly)
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

import { useRealtimeBids } from "@/hooks/useRealtimeBids";
import { swrFetcher } from "@/lib/safe-fetcher";

interface BidBoardClientProps {
  initialBids: TelegramBid[];
}

export default function BidBoardClient({ initialBids }: BidBoardClientProps) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [selectedBid, setSelectedBid] = useState<TelegramBid | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isBidding, setIsBidding] = useState(false);
  const [viewDetailsBid, setViewDetailsBid] = useState<TelegramBid | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<string | null>(null);
  const [showManageBidsConsole, setShowManageBidsConsole] = useState(false);
  const [showFavoritesConsole, setShowFavoritesConsole] = useState(false);
  const searchParams = useSearchParams();
  
  // State for filtering and sorting - matching admin page exactly
  // Default to showing active bids for carriers (admin defaults to expired)
  const [showExpired, setShowExpired] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<"distance" | "time-remaining" | "pickup-time" | "delivery-time" | "state" | "received-time" | "bid-count">("received-time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const isAdmin = useIsAdmin();
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBids, setArchivedBids] = useState<any[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedFilters, setArchivedFilters] = useState({
    date: "",
    city: "",
    state: "",
    milesMin: "",
    milesMax: "",
    sortBy: "date" // "date", "bids"
  });
  
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  const { theme } = useTheme();
  
  // Fetch shop status
  const { data: shopStatusData, mutate: mutateShopStatus } = useSWR(
    '/api/shop-status',
    swrFetcher,
    { refreshInterval: 60000 } // Reduced from 30s - Realtime handles instant updates
  );
  
  const shopStatus = shopStatusData?.status || 'open';

  // Realtime updates for system_settings (shop status)
  useRealtimeSystemSettings({
    onUpdate: () => {
      mutateShopStatus();
    },
    enabled: true,
  });
  const isShopOpen = shopStatus === 'open';
  
  const { user } = useUnifiedUser();

  // Check profile status for access restriction - use swrFetcher with credentials
  const { data: profileData, isLoading: profileLoading, mutate: mutateProfile } = useSWR(
    `/api/carrier/profile`,
    swrFetcher,
    {
      refreshInterval: 60000, // Reduced from 10s - Realtime handles instant updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  // Realtime updates for carrier_profiles (current user's profile)
  useRealtimeCarrierProfiles({
    userId: user?.id,
    onUpdate: () => {
      mutateProfile();
    },
    enabled: !!user,
  });

  const profile = profileData?.data;
  
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

  // Fetch data for the main view - matching admin page exactly
  // Using Realtime instead of 5-second polling
  const { data, mutate, isLoading } = useSWR(
    `/api/telegram-bids?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&limit=1000&showExpired=${showExpired}&isAdmin=false`,
    swrFetcher,
    {
      refreshInterval: 0, // Disable polling - using Realtime instead
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // Subscribe to real-time updates for telegram_bids
  useRealtimeBids({
    enabled: true,
    filter: 'published=eq.true', // Only published bids
    onInsert: () => {
      console.log('[BidBoard] New bid inserted, refreshing...');
      mutate(); // Refresh data when new bid is inserted
    },
    onUpdate: () => {
      console.log('[BidBoard] Bid updated, refreshing...');
      mutate(); // Refresh data when bid is updated (e.g., expires)
    },
    onDelete: () => {
      console.log('[BidBoard] Bid deleted, refreshing...');
      mutate(); // Refresh data when bid is deleted
    },
  });

  // Fetch data for analytics regardless of showExpired filter - matching admin page exactly
  // Using longer intervals for analytics since they're less critical
  const { data: activeData, mutate: mutateActive } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=false`,
    swrFetcher,
    { refreshInterval: 60000 } // Increased to 60s for analytics (less critical)
  );

  const { data: expiredData, mutate: mutateExpired } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=false`,
    swrFetcher,
    { refreshInterval: 60000 } // Increased to 60s for analytics (less critical)
  );

  // Realtime updates will also refresh analytics when main data changes
  useRealtimeBids({
    enabled: true,
    filter: 'published=eq.true',
    onInsert: () => {
      mutateActive();
      mutateExpired();
    },
    onUpdate: () => {
      mutateActive();
      mutateExpired();
    },
  });

  // Calculate today's counts properly - matching admin page
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Extract bids data - swrFetcher returns result.data || result
  // API returns { ok: true, data: [...] }, so swrFetcher should return the array
  // But handle both cases for safety (array or object with .data property)
  const bids = Array.isArray(data) ? data : (data?.data || []);
  const activeBidsAll = Array.isArray(activeData) ? activeData : (activeData?.data || []);
  const expiredBidsAll = Array.isArray(expiredData) ? expiredData : (expiredData?.data || []);
  
  // Debug logging to track data structure
  useEffect(() => {
    console.log('🔍 [BidBoard] Data structure check:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      dataLength: Array.isArray(data) ? data.length : (data?.data?.length || 0),
      activeDataType: Array.isArray(activeData) ? 'array' : typeof activeData,
      activeDataLength: Array.isArray(activeData) ? activeData.length : (activeData?.data?.length || 0),
      expiredDataType: Array.isArray(expiredData) ? 'array' : typeof expiredData,
      expiredDataLength: Array.isArray(expiredData) ? expiredData.length : (expiredData?.data?.length || 0),
      bidsLength: bids.length,
      activeBidsAllLength: activeBidsAll.length,
      expiredBidsAllLength: expiredBidsAll.length,
      today,
      todaysActiveBidsLength: activeBidsAll.filter((b: TelegramBid) => {
        const bidDate = new Date(b.received_at).toISOString().split('T')[0];
        return bidDate === today && !b.is_expired;
      }).length
    });
  }, [data, activeData, expiredData, bids.length, activeBidsAll.length, expiredBidsAll.length, today]);

  // Fetch favorites status for all bids
  // Filter out bids with invalid bid_numbers before creating the URL
  const validBidNumbers = bids
    .map((b: TelegramBid) => b.bid_number)
    .filter((bn: string | null | undefined): bn is string => 
      bn != null && bn.trim().length > 0 && /^[A-Z0-9\-_]+$/.test(bn.trim()) && bn.trim().length <= 100
    );
  
  const { data: favoritesData, mutate: mutateFavorites } = useSWR(
    validBidNumbers.length > 0 ? `/api/carrier/favorites/check?bid_numbers=${validBidNumbers.join(',')}` : null,
    swrFetcher,
    { 
      refreshInterval: 30000,
      fallbackData: {} // swrFetcher unwraps, so fallback should be the unwrapped object
    }
  );

  // Use favorites data directly (stable reference pattern)
  // swrFetcher already unwraps result.data || result, so favoritesData is the data object itself
  // Handle both cases: if swrFetcher unwrapped it (object with bid_number keys) or if it's still wrapped
  const favorites = (favoritesData && typeof favoritesData === 'object' && !Array.isArray(favoritesData) && !favoritesData.ok) 
    ? favoritesData 
    : (favoritesData?.data || {});
  
  // Debug logging to track favorites data
  useEffect(() => {
    if (favoritesData) {
      console.log('⭐ [BidBoard] Favorites data:', {
        favoritesDataType: typeof favoritesData,
        isArray: Array.isArray(favoritesData),
        hasOk: 'ok' in (favoritesData || {}),
        hasData: 'data' in (favoritesData || {}),
        favoritesKeys: Object.keys(favorites || {}),
        favoritesCount: Object.keys(favorites || {}).length,
        sampleFavorite: Object.keys(favorites || {}).slice(0, 3).map(k => ({ [k]: favorites[k] }))
      });
    }
  }, [favoritesData, favorites]);

  const handlePlaceBid = async () => {
    if (!selectedBid || !bidAmount) return;

    setIsBidding(true);
    try {
      const response = await fetch("/api/carrier-bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bid_number: selectedBid.bid_number,
          amount: parseFloat(bidAmount),
          notes: bidNotes,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Bid placed successfully!");
        setSelectedBid(null);
        setBidAmount("");
        setBidNotes("");
        mutate(); // Refresh data
      } else {
        toast.error(result.error || "Failed to place bid");
      }
    } catch (error) {
      toast.error("Failed to place bid");
    } finally {
      setIsBidding(false);
    }
  };

  const openBidDialog = (bid: TelegramBid) => {
    setSelectedBid(bid);
    setBidAmount("");
    setBidNotes("");
  };

  const handleToggleFavorite = async (bidNumber: string) => {
    setIsTogglingFavorite(bidNumber);
    try {
      const isFavorited = favorites[bidNumber];
      
      if (isFavorited) {
        // Remove from favorites
        const deleteResponse = await fetch(`/api/carrier/favorites?bid_number=${bidNumber}`, {
          method: 'DELETE'
        });
        const deleteResult = await deleteResponse.json();
        
        if (deleteResult.ok) {
          toast.success("Removed from favorites");
          // Trigger SWR revalidation to update the favorites data
          mutate();
          mutateFavorites(); // Revalidate favorites check endpoint
          // Also trigger global SWR revalidation for the favorites list (used by FavoritesConsole)
          globalMutate('/api/carrier/favorites');
        } else {
          toast.error(deleteResult.error || "Failed to remove from favorites");
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/carrier/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bid_number: bidNumber })
        });
        const result = await response.json();
        
        if (result.ok) {
          // If it already exists, remove it instead (toggle behavior)
          if (result.alreadyExists) {
            // Remove from favorites
            const deleteResponse = await fetch(`/api/carrier/favorites?bid_number=${bidNumber}`, {
              method: 'DELETE'
            });
            const deleteResult = await deleteResponse.json();
            
            if (deleteResult.ok) {
              toast.success("Removed from favorites");
              mutate();
              mutateFavorites(); // Revalidate favorites check endpoint
              globalMutate('/api/carrier/favorites');
            } else {
              toast.error(deleteResult.error || "Failed to remove from favorites");
            }
          } else {
            toast.success("Added to favorites");
            // Trigger SWR revalidation to update the favorites data
            mutate();
            mutateFavorites(); // Revalidate favorites check endpoint
            // Also trigger global SWR revalidation for the favorites list (used by FavoritesConsole)
            globalMutate('/api/carrier/favorites');
          }
        } else {
          toast.error(result.error || "Failed to add to favorites");
        }
      }
    } catch (error) {
      toast.error("Failed to update favorites");
    } finally {
      setIsTogglingFavorite(null);
    }
  };

  const loadArchivedBids = async () => {
    setIsLoadingArchived(true);
    try {
      const params = new URLSearchParams();
      if (archivedFilters.date) params.append('date', archivedFilters.date);
      if (archivedFilters.city) params.append('city', archivedFilters.city);
      if (archivedFilters.state) params.append('state', archivedFilters.state);
      if (archivedFilters.milesMin) params.append('milesMin', archivedFilters.milesMin);
      if (archivedFilters.milesMax) params.append('milesMax', archivedFilters.milesMax);
      if (archivedFilters.sortBy) params.append('sortBy', archivedFilters.sortBy);
      
      const response = await fetch(`/api/archive-bids/list?${params.toString()}`);
      const result = await response.json();
      
      if (result.ok) {
        setArchivedBids(result.data);
      } else {
        toast.error("Failed to load archived bids");
      }
    } catch (error) {
      toast.error("Failed to load archived bids");
    } finally {
      setIsLoadingArchived(false);
    }
  };

  // Filter bids based on showExpired toggle - matching admin page exactly
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

  // Apply sorting - matching admin page exactly
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
  
  // Get all bids for today (regardless of showExpired filter) - matching admin page
  const todaysBids = bids.filter((bid: TelegramBid) => {
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    return bidDate === today;
  });

  // Analytics calculations - show stats based on current view mode - matching admin page exactly
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
    expiredBids: expiredBidsAll.length, // Always show actual expired count (not 0)
    totalCarrierBids: todaysActiveBids.reduce((sum: number, b: TelegramBid) => sum + (Number(b.bids_count) || 0), 0)
  };

  // Handle URL parameter to open bid details dialog
  useEffect(() => {
    const bidNumber = searchParams?.get('bid');
    if (bidNumber && bids.length > 0) {
      const bid = bids.find((b: TelegramBid) => b.bid_number === bidNumber);
      if (bid) {
        setViewDetailsBid(bid);
        // Remove the query parameter from URL without reloading
        const url = new URL(window.location.href);
        url.searchParams.delete('bid');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, bids]);

  // Calculate stats - matching admin page structure
  // Get unique states from today's active bids and all expired bids
  const allBidsForStates = showExpired 
    ? [...todaysActiveBids, ...expiredBidsAll]
    : [...todaysActiveBids, ...expiredBidsAll];
  const uniqueStates = new Set(allBidsForStates.map((b: TelegramBid) => b.tag).filter(Boolean)).size;
  
  const stats = useMemo(() => {
    return {
      activeCount: analytics.activeBids,
      expiredCount: analytics.expiredBids, // Always show actual expired count
      statesCount: uniqueStates,
      totalValue: filteredBids.length > 0 ? "Live" : "0"
    };
  }, [analytics.activeBids, analytics.expiredBids, uniqueStates, filteredBids.length]);

  // Show access restriction banner for unapproved users
  const renderAccessBanner = () => {
    // Don't show banner while loading - wait for profile data
    if (profileLoading) return null;
    
    // Only show banner if profile exists and is NOT approved
    // If profile is null/undefined, don't show banner (middleware handles redirect)
    if (profile && profile.profile_status !== 'approved') {
      return (
        <Glass className="border-l-4 border-l-red-500 dark:border-l-red-400 mb-6">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 dark:text-red-400">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Access to website features are restricted until you setup your profile and it has been reviewed by an admin.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your profile to gain access to all features and start bidding on loads.
                </p>
              </div>
              <Button asChild>
                <Link href="/carrier/profile">
                  <User className="h-4 w-4 mr-2" />
                  Complete Profile
                </Link>
              </Button>
            </div>
          </div>
        </Glass>
      );
    }
    return null;
  };

  // Determine if user is approved - default to true if profile is still loading (middleware handles blocking)
  // This allows the page to render while profile loads, preventing blank screen
  // IMPORTANT: Since middleware already blocks unapproved users from accessing /bid-board,
  // we can safely assume approved if profile is loading. If profile exists and is not approved,
  // middleware would have redirected, so we can trust that if we get here, user is approved.
  const isApproved = profileLoading ? true : (profile?.profile_status === 'approved' || !profile);
  

  return (
    <div className="space-y-6">
      {/* Access Restriction Banner */}
      {renderAccessBanner()}
      
      {/* Shop Status Banner */}
      {isApproved && (
        <div 
          className="rounded-xl border-2 p-4 backdrop-blur-sm transition-all duration-300"
          style={{
            borderColor: isShopOpen ? `${accentColor}30` : '#ef444430',
            backgroundColor: isShopOpen ? `${accentColor}08` : '#ef444408',
          }}
        >
          <div className="flex items-center gap-3">
            {isShopOpen ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            )}
            <p className="text-sm font-medium text-foreground">
              {isShopOpen 
                ? 'We are accepting bids' 
                : 'We are currently not accepting bids'}
            </p>
          </div>
        </div>
      )}
      
      {/* Header Actions - Matching admin page */}
      {isApproved && (
        <Glass className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowManageBidsConsole(true)}
                className="flex items-center gap-2 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30"
              >
                <Gavel className="w-4 h-4" />
                Manage Bids
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFavoritesConsole(true)}
                className="flex items-center gap-2 hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30"
              >
                <Star className="w-4 h-4" />
                Favorites
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
      )}

      {/* Filters and Controls - Matching admin page exactly */}
      {isApproved && (
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
                  {stats.activeCount} Active
                </Badge>
                <Badge variant="outline">
                  {stats.expiredCount} Expired
                </Badge>
              </div>
            </div>
          </div>

          {/* Sort Controls - Matching admin page exactly */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/40">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sort By</label>
              <select 
                className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="distance">Distance (Miles)</option>
                {!showExpired && <option value="time-remaining">Time Remaining</option>}
                <option value="pickup-time">Pickup Time</option>
                <option value="delivery-time">Delivery Time</option>
                <option value="state">State/Tag</option>
                <option value="received-time">
                  {showExpired ? "Time Expired" : "Time Received"}
                </option>
                <option value="bid-count">Bid Count</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Direction</label>
              <select 
                className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
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
      )}

      {/* Stats - Only show for approved users */}
      {isApproved && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">Active Auctions</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.activeCount}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.expiredCount}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">States</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.statesCount}
              </p>
            </div>
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5" style={{ color: iconColor }} />
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalValue}
              </p>
            </div>
          </div>
        </Glass>
        </div>
      )}

      {/* Bids Grid - Only show for approved users */}
      {isApproved && (
        <>
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
              {/* Header - Matching admin page exactly */}
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

              {/* Route Info - Matching admin page format exactly */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">
                    {(() => {
                      const parsed = parseStops(bid.stops);
                      const formatted = formatStops(parsed);
                      return formatted || 'N/A';
                    })()}
                  </span>
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
                  <span className="text-sm">
                    {(() => {
                      const parsed = parseStops(bid.stops);
                      return formatStopCount(parsed);
                    })()}
                  </span>
                </div>
              </div>

              {/* Bidding Info - Matching admin page */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Carrier Bids:</span>
                  <span className="font-medium">{bid.bids_count || 0}</span>
                </div>
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
                      onClick={() => handleToggleFavorite(bid.bid_number)}
                      disabled={isTogglingFavorite === bid.bid_number}
                      className={`${
                        favorites[bid.bid_number] 
                          ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20 border-yellow-500/30' 
                          : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/20'
                      }`}
                    >
                      {isTogglingFavorite === bid.bid_number ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Star className={`w-4 h-4 ${favorites[bid.bid_number] ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewDetailsBid(bid)}
                    >
                      View Details
                    </Button>
                    {!bid.is_expired && (
                      <Button
                        size="sm"
                        onClick={() => openBidDialog(bid)}
                        style={{
                          backgroundColor: accentColor,
                          color: buttonTextColor
                        }}
                        className="hover:opacity-90"
                      >
                        <Gavel className="w-4 h-4 mr-1" />
                        Bid
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Glass>
          ))}
        </div>
      )}

      {/* Bid Dialog */}
      <Dialog open={!!selectedBid} onOpenChange={() => setSelectedBid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid - #{selectedBid?.bid_number}</DialogTitle>
          </DialogHeader>
          
          {selectedBid && (() => {
            // Calculate expires_at_25 if not present
            const expiresAt = selectedBid.expires_at_25 || (() => {
              const receivedAt = new Date(selectedBid.received_at);
              return new Date(receivedAt.getTime() + (25 * 60 * 1000)).toISOString();
            })();
            
            return (
              <div className="space-y-6">
                {/* Bid Details */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{formatStops(parseStops(selectedBid.stops))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{formatDistance(selectedBid.distance_miles)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Pickup: {formatPickupDateTime(selectedBid.pickup_timestamp)} | Delivery: {formatPickupDateTime(selectedBid.delivery_timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Countdown 
                      expiresAt={expiresAt}
                      variant={selectedBid.is_expired ? "expired" : (selectedBid.time_left_seconds || 0) <= 300 ? "urgent" : "default"}
                    />
                  </div>
                </div>

              {/* Bid Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Bid Amount ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={selectedBid.is_expired}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Notes (Optional)
                  </label>
                  <Input
                    value={bidNotes}
                    onChange={(e) => setBidNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    disabled={selectedBid.is_expired}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedBid(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePlaceBid}
                  disabled={!bidAmount || isBidding || selectedBid.is_expired}
                  style={{
                    backgroundColor: accentColor,
                    color: buttonTextColor
                  }}
                  className="hover:opacity-90"
                >
                  {isBidding ? "Placing Bid..." : "Place Bid"}
                </Button>
              </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewDetailsBid} onOpenChange={() => setViewDetailsBid(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Load Details - #{viewDetailsBid?.bid_number}</DialogTitle>
            <DialogDescription>
              View detailed information about this load including route map, stops, and auction details.
            </DialogDescription>
          </DialogHeader>
          
          {viewDetailsBid && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bid Number</label>
                  <p className="text-lg font-semibold">#{viewDetailsBid.bid_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State Tag</label>
                  <p className="text-lg font-semibold">{viewDetailsBid.tag || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Distance</label>
                  <p className="text-lg font-semibold">{formatDistance(viewDetailsBid.distance_miles)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stops</label>
                  <p className="text-lg font-semibold">{formatStopCount(parseStops(viewDetailsBid.stops))}</p>
                </div>
              </div>

              {/* Pickup & Delivery Times */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pickup Time</label>
                  <p className="text-lg font-semibold">Pickup: {formatPickupDateTime(viewDetailsBid.pickup_timestamp)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                  <p className="text-lg font-semibold">Delivery: {formatPickupDateTime(viewDetailsBid.delivery_timestamp)}</p>
                </div>
              </div>

              {/* Detailed Stops */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Route Details</h3>
                <div className="space-y-2">
                  {formatStopsDetailed(parseStops(viewDetailsBid.stops)).map((address: ParsedAddress, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{address.fullAddress}</p>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {address.streetNumber && address.streetName && (
                            <p>Street: {address.streetNumber} {address.streetName}</p>
                          )}
                          <p>City: {address.city}</p>
                          <p>State: {address.state}</p>
                          {address.zipcode && <p>ZIP: {address.zipcode}</p>}
                          <p className="text-xs mt-1">
                            {index === 0 ? 'Pickup Location' : 
                             index === formatStopsDetailed(parseStops(viewDetailsBid.stops)).length - 1 ? 'Delivery Location' : 
                             'Stop Location'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Route Map */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Route Map</h3>
                <div 
                  className="rounded-lg overflow-hidden border border-border/40 bg-muted/20" 
                  style={{ 
                    width: '100%', 
                    height: '400px', 
                    minHeight: '400px',
                    position: 'relative'
                  }}
                >
                  {viewDetailsBid && (
                    <MapboxMap 
                      key={`route-map-${viewDetailsBid.bid_number}-${JSON.stringify(viewDetailsBid.stops)}`}
                      stops={formatStopsDetailed(parseStops(viewDetailsBid.stops)).map((addr: ParsedAddress) => addr.fullAddress)} 
                      className="w-full h-full"
                      lazy={false}
                      minHeight="400px"
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
              </div>

              {/* Bidding Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Auction Information</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Bids</label>
                    <p className="text-lg font-semibold">{viewDetailsBid.bids_count || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="text-lg font-semibold">
                      {viewDetailsBid.is_expired ? 'Auction Closed' : 'Bidding Open'}
                    </p>
                  </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Time Remaining</label>
                      <div className="flex items-center gap-2">
                        <Countdown 
                          expiresAt={(() => {
                            // Calculate expires_at_25 if not present
                            if (viewDetailsBid.expires_at_25) {
                              return viewDetailsBid.expires_at_25;
                            }
                            const receivedAt = new Date(viewDetailsBid.received_at);
                            return new Date(receivedAt.getTime() + (25 * 60 * 1000)).toISOString();
                          })()}
                          variant={viewDetailsBid.is_expired ? "expired" : (viewDetailsBid.time_left_seconds || 0) <= 300 ? "urgent" : "default"}
                        />
                      </div>
                    </div>
                </div>
              </div>

              {/* Source Information */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Source Information</h3>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Received At</label>
                    <p className="text-lg font-semibold">{formatPickupDateTime(viewDetailsBid.received_at)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setViewDetailsBid(null)}
                >
                  Close
                </Button>
                {!viewDetailsBid.is_expired && (
                  <Button
                    onClick={() => {
                      setViewDetailsBid(null);
                      openBidDialog(viewDetailsBid);
                    }}
                    style={{
                      backgroundColor: accentColor,
                      color: buttonTextColor
                    }}
                    className="hover:opacity-90"
                  >
                    <Gavel className="w-4 h-4 mr-2" />
                    Place Bid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Archived Bids Dialog */}
      <Dialog open={showArchived} onOpenChange={setShowArchived}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Bids
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={archivedFilters.date}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <Input
                  placeholder="Enter city"
                  value={archivedFilters.city}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">State</label>
                <Input
                  placeholder="Enter state"
                  value={archivedFilters.state}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Miles</label>
                <Input
                  type="number"
                  placeholder="Min miles"
                  value={archivedFilters.milesMin}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, milesMin: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Miles</label>
                <Input
                  type="number"
                  placeholder="Max miles"
                  value={archivedFilters.milesMax}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, milesMax: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <select
                  className="w-full p-2 border border-border rounded-md bg-background"
                  value={archivedFilters.sortBy}
                  onChange={(e) => setArchivedFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                >
                  <option value="date">Date (Newest First)</option>
                  <option value="bids">Bid Count (Lowest to Highest)</option>
                </select>
              </div>
            </div>

            {/* Archived Bids List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Archived Bids</h3>
              {isLoadingArchived ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading archived bids...</p>
                </div>
              ) : archivedBids.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Archived Bids Found</h4>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or select a different date range.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {archivedBids.map((bid: any) => (
                    <div key={`${bid.bid_number}-${bid.archived_date}`} className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">#{bid.bid_number}</Badge>
                        <Badge variant="secondary">{bid.tag}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{formatStops(parseStops(bid.stops))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDistance(bid.distance_miles)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{new Date(bid.archived_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gavel className="w-4 h-4 text-muted-foreground" />
                          <span>{bid.bids_count || 0} bids</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowArchived(false)}
              >
                Close
              </Button>
              <Button
                onClick={loadArchivedBids}
                disabled={isLoadingArchived}
                style={{
                  backgroundColor: accentColor,
                  color: buttonTextColor
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                {isLoadingArchived ? "Searching..." : "Search Archived"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Manage Bids Console */}
      <ManageBidsConsole 
        isOpen={showManageBidsConsole} 
        onClose={() => setShowManageBidsConsole(false)} 
      />

      {/* Favorites Console */}
      <FavoritesConsole 
        isOpen={showFavoritesConsole} 
        onClose={() => setShowFavoritesConsole(false)} 
      />
    </div>
  );
}