"use client";

import { useState, useEffect } from "react";
import { Map, X, Zap, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";

interface CollapsibleMapPanelProps {
  className?: string;
}

export default function CollapsibleMapPanel({ className }: CollapsibleMapPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();

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
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000'; // Black text on white background
    }
    return '#ffffff'; // White text on colored background
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
        <Map className="h-8 w-8 drop-shadow-lg" style={{ color: getFloatingButtonIconColor() }} />
      </Button>

      {/* Bubble Popup Window */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Bubble Window */}
          <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500 ease-out">
            {/* Bubble Tail */}
            <div 
              className="absolute -bottom-2 right-8 w-4 h-4 rotate-45 border-r border-b border-white/20"
              style={{ backgroundColor: accentColor }}
            ></div>
            
            {/* Main Bubble */}
            <div className="relative bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl shadow-2xl border-2 border-white/20 backdrop-blur-lg overflow-hidden">
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
                    <Map 
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

              {/* Map Content */}
              <div className="p-4 space-y-4">
                {/* Map Area */}
                <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 border border-border">
                  <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex flex-col items-center justify-center text-muted-foreground relative overflow-hidden">
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent animate-pulse"></div>
                    <div className="absolute top-4 left-4 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                    <div className="absolute top-8 right-6 w-2 h-2 bg-blue-500 rounded-full animate-ping delay-300"></div>
                    <div className="absolute bottom-6 left-8 w-2 h-2 bg-orange-500 rounded-full animate-ping delay-700"></div>
                    <div className="absolute bottom-4 right-4 w-3 h-3 bg-purple-500 rounded-full animate-ping delay-1000"></div>
                    
                    <Map className="h-16 w-16 mb-3 drop-shadow-lg relative z-10" style={{ color: getIconColor() }} />
                    <p className="font-bold text-lg relative z-10" style={{ color: getIconColor() }}>Interactive Map</p>
                    <p className="text-sm text-center relative z-10 text-muted-foreground">
                      Set `NEXT_PUBLIC_MAPBOX_TOKEN`<br />
                      to enable live map view
                    </p>
                  </div>
                </div>

                {/* Game-like Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-3 border border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-semibold text-green-700 dark:text-green-300">ACTIVE</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">12</div>
                    <div className="text-xs text-green-600/70 dark:text-green-400/70">Live Bids</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-3 border border-red-200 dark:border-red-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-xs font-semibold text-red-700 dark:text-red-300">EXPIRED</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">3</div>
                    <div className="text-xs text-red-600/70 dark:text-red-400/70">Completed</div>
                  </div>
                </div>

                {/* State Leaderboard */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-3 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4" style={{ color: getIconColor() }} />
                    <span className="text-sm font-bold" style={{ color: getIconColor() }}>State Leaderboard</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { state: "GA", count: 5, color: "bg-green-500" },
                      { state: "TX", count: 3, color: "bg-blue-500" },
                      { state: "CA", count: 2, color: "bg-orange-500" },
                      { state: "FL", count: 2, color: "bg-purple-500" },
                    ].map((item, index) => (
                      <div key={item.state} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground">#{index + 1}</span>
                          <div className={cn("w-2 h-2 rounded-full", item.color)}></div>
                          <span className="font-semibold text-foreground">{item.state}</span>
                        </div>
                        <span className="font-bold" style={{ color: getIconColor() }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

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
                  <Map className="h-4 w-4 mr-2" style={{ color: getButtonTextColor() }} />
                  Close Map
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
