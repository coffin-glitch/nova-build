"use client";

import FavoritesConsole from "@/components/carrier/FavoritesConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatStops } from "@/lib/format";
import { Activity, AlertCircle, ArrowRight, Bell, CheckCircle, Clock, DollarSign, Gavel, MessageSquare, Star, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Inner component that uses useSearchParams
function CarrierDashboardInner() {
  const searchParams = useSearchParams();
  const setupMode = searchParams.get('setup') === 'true';
  const status = searchParams.get('status');
  const [showFavoritesConsole, setShowFavoritesConsole] = useState(false);
  const { accentColor } = useAccentColor();

  const { data: profileData, isLoading: profileLoading } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null }
    }
  );

  // Fetch dashboard stats
  const { data: statsData, isLoading: statsLoading } = useSWR(
    `/api/carrier/dashboard-stats`,
    fetcher,
    {
      refreshInterval: 30000,
      fallbackData: { ok: true, data: null }
    }
  );

  // Fetch recent notifications
  const { data: notificationsData } = useSWR(
    `/api/carrier/notifications?limit=5`,
    fetcher,
    {
      refreshInterval: 10000,
      fallbackData: { ok: true, data: { notifications: [] } }
    }
  );

  // Fetch recent bid activity
  const { data: bidsData } = useSWR(
    `/api/carrier/bids?limit=5`,
    fetcher,
    {
      refreshInterval: 10000,
      fallbackData: { ok: true, data: [] }
    }
  );

  const profile = profileData?.data;
  const stats = statsData?.data || {
    totalBids: 0,
    activeBids: 0,
    wonBids: 0,
    totalAwarded: 0,
    totalRevenue: 0,
    totalFavorites: 0,
    activeFavorites: 0
  };

  // Handle notifications - API returns { ok: true, data: { notifications: [...] } }
  const notifications = notificationsData?.data?.notifications || notificationsData?.notifications || [];
  const recentBids = bidsData?.data || [];

  // Calculate win rate
  const winRate = stats.totalBids > 0 
    ? Math.round((stats.wonBids / stats.totalBids) * 100) 
    : 0;

  // Show status banner for unapproved users
  const renderStatusBanner = () => {
    if (profileLoading) return null;
    
    if (!profile || profile.profile_status !== 'approved') {
      return (
        <Card className="border-l-4 border-l-red-500 dark:border-l-red-400 border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl mb-6">
          <CardContent className="p-6">
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
              <Button 
                asChild
                className="text-white"
                style={{ backgroundColor: accentColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${accentColor}dd`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = accentColor;
                }}
              >
                <Link href="/carrier/profile">
                  Complete Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'similar_load':
      case 'exact_match':
        return <Star className="h-4 w-4 text-blue-400" />;
      case 'favorite_available':
        return <Bell className="h-4 w-4 text-purple-400" />;
      case 'deadline_approaching':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 space-y-6">
        {/* Status Banner */}
        {renderStatusBanner()}
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Carrier Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back! Manage your bids and track your performance.
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border-blue-500/30">
            CARRIER
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Bids</p>
                  <p className="text-3xl font-bold mt-2">{stats.activeBids || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pendingBids || 0} pending
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
                  <Activity className="h-6 w-6" style={{ color: accentColor }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Bids</p>
                  <p className="text-3xl font-bold mt-2">{stats.totalBids || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.bidsLast30Days || 0} this month
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
                  <Gavel className="h-6 w-6" style={{ color: accentColor }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold mt-2">
                    ${((stats.totalRevenue || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalAwarded || 0} awarded
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
                  <DollarSign className="h-6 w-6" style={{ color: accentColor }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className="text-3xl font-bold mt-2">{winRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.wonBids || 0} won
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
                  <TrendingUp className="h-6 w-6" style={{ color: accentColor }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
                      <Gavel className="h-5 w-5" style={{ color: accentColor }} />
                    </div>
                    <h3 className="text-lg font-semibold">My Bids</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage your active bids, view history, and track your bidding performance.
                  </p>
                  {(!profile || profile.profile_status !== 'approved') ? (
                    <Button disabled className="w-full">
                      Complete Profile First
                    </Button>
                  ) : (
                    <Button 
                      asChild 
                      className="w-full text-white" 
                      style={{ backgroundColor: accentColor }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${accentColor}dd`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = accentColor;
                      }}
                    >
                      <Link href="/carrier/my-bids">
                        View My Bids
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl hover:shadow-2xl transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
                      <MessageSquare className="h-5 w-5" style={{ color: accentColor }} />
                    </div>
                    <h3 className="text-lg font-semibold">Messages</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Communicate with shippers and manage your conversations.
                  </p>
                  {(!profile || profile.profile_status !== 'approved') ? (
                    <Button disabled className="w-full">
                      Complete Profile First
                    </Button>
                  ) : (
                    <Button 
                      asChild 
                      className="w-full text-white" 
                      style={{ backgroundColor: accentColor }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${accentColor}dd`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = accentColor;
                      }}
                    >
                      <Link href="/carrier/messages">
                        View Messages
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity - Split 50/50 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Notifications */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
                    <Bell className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <h3 className="text-lg font-semibold">Recent Notifications</h3>
                </div>
                {/* View All notifications - can be added when notifications page is created */}
              </div>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification: any) => (
                    <div key={notification.id} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm hover:bg-white/10 dark:hover:bg-black/10 transition-colors">
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.type || 'default')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notification.title || notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Bid Activity */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
                    <Activity className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <h3 className="text-lg font-semibold">Recent Bid Activity</h3>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/carrier/my-bids">View All</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {recentBids.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gavel className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent bids</p>
                  </div>
                ) : (
                  recentBids.slice(0, 5).map((bid: any) => (
                    <div key={bid.id} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm hover:bg-white/10 dark:hover:bg-black/10 transition-colors">
                      <div className="mt-0.5">
                        {bid.isExpired ? (
                          bid.bidStatus === 'won' ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-400" />
                          )
                        ) : (
                          <Target className="h-4 w-4" style={{ color: accentColor }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          Bid #{bid.bidNumber}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {formatStops(bid.stops || [])} • ${Number(bid.myBid || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(bid.createdAt)}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={bid.isExpired 
                          ? (bid.bidStatus === 'won' ? 'border-green-500/30 text-green-400' : 'border-yellow-500/30 text-yellow-400')
                          : ''
                        }
                        style={!bid.isExpired ? { 
                          borderColor: `${accentColor}30`, 
                          color: accentColor 
                        } : {}}
                      >
                        {bid.isExpired 
                          ? (bid.bidStatus === 'won' ? 'Won' : 'Expired')
                          : 'Active'
                        }
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Favorites Console */}
      <FavoritesConsole isOpen={showFavoritesConsole} onClose={() => setShowFavoritesConsole(false)} />
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function CarrierDashboard() {
  return (
    <Suspense fallback={
      <div className="py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <CarrierDashboardInner />
    </Suspense>
  );
}
