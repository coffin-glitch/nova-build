"use client";

import { useState, useEffect } from "react";
import { Map as MapIcon, X, Zap, Target, TrendingUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getButtonTextColor as getTextColor } from "@/lib/utils";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { LiveMapView } from "./LiveMapView";
import useSWR from "swr";
import { swrFetcher } from "@/lib/safe-fetcher";
import { useRouter } from "next/navigation";
import { getStateName, extractStateCode } from "@/lib/state-names";

interface CollapsibleMapPanelProps {
  className?: string;
}

interface TelegramBid {
  bid_number: string;
  stops?: string | string[] | null;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  is_expired?: boolean;
  received_at?: string;
  tag?: string;
  [key: string]: any;
}

export default function CollapsibleMapPanel({ className }: CollapsibleMapPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  const router = useRouter();

  // Fetch active bids for the map
  const { data: activeBidsData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=false&isAdmin=false`,
    swrFetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  // Fetch expired bids for stats
  const { data: expiredBidsData } = useSWR(
    `/api/telegram-bids?q=&tag=&limit=1000&showExpired=true&isAdmin=false`,
    swrFetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const activeBids: TelegramBid[] = Array.isArray(activeBidsData) 
    ? activeBidsData 
    : (activeBidsData?.data || []);

  const expiredBids: TelegramBid[] = Array.isArray(expiredBidsData) 
    ? expiredBidsData 
    : (expiredBidsData?.data || []);

  // Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];
  
  // Filter bids for today
  const todaysActiveBids = activeBids.filter(bid => {
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    return bidDate === today;
  });
  
  const todaysExpiredBids = expiredBids.filter(bid => {
    const bidDate = new Date(bid.received_at).toISOString().split('T')[0];
    return bidDate === today;
  });

  // Calculate comprehensive state statistics
  const stateStats = new Map<string, { 
    code: string, 
    name: string, 
    active: number, 
    expired: number, 
    total: number 
  }>();

  // Process all bids (active and expired) for today
  const allTodaysBids = [...todaysActiveBids, ...todaysExpiredBids];
  
  allTodaysBids.forEach(bid => {
    // Try to get state from tag, origin_state, or destination_state
    let stateCode = bid.tag || bid.origin_state || bid.destination_state;
    
    // If we have stops, try to extract state from first stop
    if (!stateCode && bid.stops) {
      const stops = Array.isArray(bid.stops) ? bid.stops : 
                   typeof bid.stops === 'string' ? [bid.stops] : [];
      if (stops.length > 0) {
        stateCode = extractStateCode(stops[0]);
      }
    }
    
    if (!stateCode) return;
    
    const code = stateCode.toUpperCase().trim();
    const name = getStateName(code);
    
    if (!stateStats.has(code)) {
      stateStats.set(code, { code, name, active: 0, expired: 0, total: 0 });
    }
    
    const stats = stateStats.get(code)!;
    stats.total++;
    if (bid.is_expired) {
      stats.expired++;
    } else {
      stats.active++;
    }
  });

  // Convert to array and sort by total bids
  const allStateStats = Array.from(stateStats.values())
    .sort((a, b) => b.total - a.total);

  // Top states (top 4 by total bids)
  const topStates = allStateStats.slice(0, 4);
  
  // Current states (all states with active bids)
  const currentStates = allStateStats
    .filter(s => s.active > 0)
    .sort((a, b) => b.active - a.active);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Smart color handling for white accent color
  const getIconColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  };

  // Smart color handling for floating button icon (needs contrast against gradient background)
  const getFloatingButtonIconColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#ffffff'; // White icon on black gradient background
    }
    return '#ffffff'; // White icon on colored gradient background
  };

  // Smart color handling for solid background buttons (like close map button)
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

  // Smart color handling for logo icon (always black background with white icon, like floating button)
  const getLogoIconColor = () => {
    return '#ffffff'; // Always white icon
  };

  const getLogoBackgroundColor = () => {
    return '#000000'; // Always black background
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!mounted) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Floating Bubble Button */}
      <Button
        onClick={toggleExpanded}
        className={cn(
          "fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out",
          "shadow-2xl hover:scale-110",
          "rounded-full h-16 w-16 p-0",
          "border-2 border-white/20 backdrop-blur-sm",
          "animate-pulse hover:animate-none",
          isExpanded && "scale-0 opacity-0"
        )}
        style={{
          background: accentColor === 'hsl(0, 0%, 100%)' 
            ? 'linear-gradient(to right, #000000, #333333)' 
            : `linear-gradient(to right, ${accentColor}, ${accentColor}80)`,
          boxShadow: accentColor === 'hsl(0, 0%, 100%)' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
            : `0 25px 50px -12px ${accentColor}25`
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = accentColor === 'hsl(0, 0%, 100%)' 
            ? 'linear-gradient(to right, #111111, #444444)' 
            : `linear-gradient(to right, ${accentColor}90, ${accentColor}70)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = accentColor === 'hsl(0, 0%, 100%)' 
            ? 'linear-gradient(to right, #000000, #333333)' 
            : `linear-gradient(to right, ${accentColor}, ${accentColor}80)`;
        }}
      >
        <MapIcon className="h-8 w-8 drop-shadow-lg" style={{ color: getFloatingButtonIconColor() }} />
      </Button>

      {/* Bubble Popup Window */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Bubble Window - Elevated - Wider Layout */}
          <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500 ease-out w-[95vw] max-w-4xl" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            {/* Bubble Tail */}
            <div 
              className="absolute -bottom-2 right-8 w-4 h-4 rotate-45 border-r border-b border-white/20"
              style={{ backgroundColor: accentColor }}
            ></div>
            
            {/* Main Bubble - Elevated with enhanced shadow */}
            <div className="relative bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl shadow-2xl border-2 border-white/30 backdrop-blur-lg overflow-hidden" style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}>
              {/* Bubble Header */}
              <div 
                className="flex items-center justify-between p-4 border-b"
                style={{ 
                  background: `linear-gradient(to right, ${accentColor}10, ${accentColor}05)`,
                  borderBottomColor: `${accentColor}20`
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-full" 
                    style={{ 
                      backgroundColor: '#000000', 
                      border: 'none',
                      background: '#000000'
                    }}
                  >
                    <MapIcon 
                      className="h-5 w-5" 
                      style={{ 
                        color: '#ffffff',
                        fill: '#ffffff'
                      }} 
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: getIconColor() }}>Live Map</h3>
                    <p className="text-xs text-muted-foreground">Real-time bid locations</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Map Content - Horizontal Layout */}
              <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Map Area - Takes 2 columns */}
                  <div className="lg:col-span-2">
                    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 border border-border" style={{ minHeight: '400px' }}>
                      <LiveMapView 
                        bids={todaysActiveBids} 
                        className="w-full"
                        onMarkerClick={(bid) => {
                          // Navigate to bid board with the bid number in the URL
                          // The bid board will handle opening the details dialog
                          router.push(`/bid-board?bid=${bid.bid_number}`);
                          setIsExpanded(false);
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats and Info Sidebar - Takes 1 column */}
                  <div className="space-y-4">
                    {/* Game-like Stats */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-3 border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-semibold text-green-700 dark:text-green-300">ACTIVE</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{todaysActiveBids.length}</div>
                        <div className="text-xs text-green-600/70 dark:text-green-400/70">Live Bids Today</div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-3 border border-red-200 dark:border-red-700">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <span className="text-xs font-semibold text-red-700 dark:text-red-300">EXPIRED</span>
                        </div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{todaysExpiredBids.length}</div>
                        <div className="text-xs text-red-600/70 dark:text-red-400/70">Expired Today</div>
                      </div>
                    </div>

                    {/* Top States Section - Enhanced */}
                    {topStates.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-3 border border-border shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4" style={{ color: getIconColor() }} />
                          <span className="text-sm font-bold" style={{ color: getIconColor() }}>Top States</span>
                        </div>
                        <div className="space-y-1.5">
                          {topStates.map((state, index) => {
                            const colors = ["bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"];
                            return (
                              <div key={state.code} className="bg-white/60 dark:bg-slate-600/60 rounded-lg p-2 border border-border/50">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="font-bold text-muted-foreground text-xs">#{index + 1}</span>
                                  <div className={cn("w-2 h-2 rounded-full", colors[index] || "bg-gray-500")}></div>
                                  <span className="font-semibold text-foreground text-xs">{state.name}</span>
                                  <span className="text-xs text-muted-foreground">({state.code})</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">T:</span>
                                  <span className="font-bold" style={{ color: getIconColor() }}>{state.total}</span>
                                  <span className="text-green-600 dark:text-green-400">A:{state.active}</span>
                                  <span className="text-red-600 dark:text-red-400">E:{state.expired}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Current States Section */}
                    {currentStates.length > 0 && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Current States</span>
                          <span className="text-xs text-muted-foreground bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded-full">
                            {currentStates.length}
                          </span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {currentStates.map((state) => (
                            <div key={state.code} className="flex items-center justify-between text-xs bg-white/60 dark:bg-slate-600/60 rounded-lg p-1.5 border border-border/50">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground text-xs">{state.name}</span>
                                <span className="text-muted-foreground text-xs">({state.code})</span>
                              </div>
                              <span className="text-green-600 dark:text-green-400 font-bold text-xs">{state.active}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <Button 
                      className="w-full rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                      style={{
                        backgroundColor: accentColor,
                        color: getButtonTextColor()
                      }}
                      onClick={() => setIsExpanded(false)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${accentColor}dd`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = accentColor;
                      }}
                    >
                      <MapIcon className="h-4 w-4 mr-2" style={{ color: getButtonTextColor() }} />
                      Close Map
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
