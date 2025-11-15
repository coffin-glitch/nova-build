"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { swrFetcher } from "@/lib/safe-fetcher";
import { AlertTriangle, Bell, CheckCircle, FileText, Info, MessageSquare, Settings, Target, Volume2, VolumeX, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface Notification {
  id: string;
  type: 'bid_won' | 'bid_lost' | 'bid_expired' | 'load_assigned' | 'bid_received' | 'system' | 'info' | 
        'new_lowest_bid' | 'carrier_message' | 'bid_message' | 'profile_submission' | 'admin_message' |
        'profile_approved' | 'profile_declined' | 'bid_accepted' | 'bid_expired_needs_award';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isAdmin, isCarrier } = useUnifiedRole();
  const { accentColor } = useAccentColor();
  
  // Load preferences from localStorage (shared with notifications page)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('notification_sound_enabled');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('notification_desktop_enabled');
      return stored !== null ? stored === 'true' : false;
    }
    return false;
  });
  
  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification_sound_enabled', String(soundEnabled));
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification_desktop_enabled', String(desktopNotificationsEnabled));
    }
  }, [desktopNotificationsEnabled]);

  // Request desktop notification permission
  useEffect(() => {
    if (desktopNotificationsEnabled && 'Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission !== 'granted') {
          setDesktopNotificationsEnabled(false);
        }
      });
    }
  }, [desktopNotificationsEnabled]);
  
  // Track previous unread notification IDs for sound/desktop notifications
  const previousUnreadIdsRef = useRef<Set<string>>(new Set());
  
  // Use appropriate endpoint based on user role
  const notificationsEndpoint = isAdmin ? '/api/notifications' : '/api/carrier/notifications';
  
  const { data, mutate, error } = useSWR(notificationsEndpoint, swrFetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds to get new notifications
    revalidateOnFocus: true, // Revalidate when window regains focus
    revalidateOnReconnect: true, // Revalidate when network reconnects
    keepPreviousData: true, // Keep previous data during refetch to prevent flashing
    onError: (err) => console.error('Notification fetch error:', err),
  });

  // Get notifications - handle both API response formats
  // swrFetcher unwraps: { success: true, data: {...} } -> {...}
  // /api/notifications returns: { success: true, data: { notifications: [...], unreadCount: ... } }
  // After swrFetcher: { notifications: [...], unreadCount: ... }
  // /api/carrier/notifications returns: { data: { notifications: [...], pagination: ... } }
  // After swrFetcher: { notifications: [...], pagination: ... }
  const notifications = data?.notifications || [];
  const pagination = data?.pagination;
  
  // Calculate unread count from notifications
  const unreadCount = notifications.filter((n: Notification) => !n.read).length;
  const recentNotifications = notifications.slice(0, 3); // Show only 3 most recent for preview
  
  // Play sound for new notifications
  useEffect(() => {
    if (soundEnabled && notifications.length > 0) {
      const unread = notifications.filter((n: Notification) => !n.read);
      const currentUnreadIds = new Set<string>(unread.map((n: Notification) => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter((n: Notification) => !previousUnreadIdsRef.current.has(n.id));
      
      // Only play sound if there are new unread notifications (and we had previous data)
      if (newUnread.length > 0 && previousUnreadIdsRef.current.size > 0) {
        try {
          const audio = new Audio('/notification-sound.wav');
          audio.volume = 0.5;
          audio.play().catch(() => {
            const mp3Audio = new Audio('/notification-sound.mp3');
            mp3Audio.volume = 0.5;
            mp3Audio.play().catch(() => {
              // Ignore errors
            });
          });
        } catch (error) {
          // Ignore errors
        }
      }
      
      previousUnreadIdsRef.current = currentUnreadIds;
    }
  }, [notifications, soundEnabled]);

  // Show desktop notifications for new unread
  useEffect(() => {
    if (desktopNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const unread = notifications.filter((n: Notification) => !n.read);
      const currentUnreadIds = new Set<string>(unread.map((n: Notification) => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter((n: Notification) => !previousUnreadIdsRef.current.has(n.id));
      
      if (newUnread.length > 0 && previousUnreadIdsRef.current.size > 0) {
        // Show notification for the latest new unread
        const latest = newUnread[0];
        new Notification(latest.title, {
          body: latest.message,
          icon: '/favicon.ico',
          tag: latest.id,
          requireInteraction: false,
        });
      }
      
      previousUnreadIdsRef.current = currentUnreadIds;
    }
  }, [notifications, desktopNotificationsEnabled]);

  // Debug logging
  useEffect(() => {
    if (data) {
      console.log('[NotificationBell] Data received:', { 
        endpoint: notificationsEndpoint,
        isAdmin,
        dataKeys: Object.keys(data),
        notificationsCount: data?.notifications?.length || 0,
        rawData: data
      });
    }
    if (error) {
      console.error('[NotificationBell] Error:', error);
    }
  }, [data, error, notificationsEndpoint, isAdmin]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bid_won':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'bid_lost':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'bid_expired':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'bid_expired_needs_award':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'bid_received':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'load_assigned':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'system':
        return <Info className="h-4 w-4 text-gray-500" />;
      case 'new_lowest_bid':
        return <Target className="h-4 w-4 text-blue-500" />;
      case 'carrier_message':
      case 'bid_message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'profile_submission':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'bid_accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'admin_message':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'profile_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'profile_declined':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    // Dark mode colors with glass effect
    const darkBase = 'dark:bg-gradient-to-br dark:backdrop-blur-xl dark:border-opacity-30';
    switch (type) {
      case 'bid_won':
        return `bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-green-200/50 backdrop-blur-sm ${darkBase} dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-500/30`;
      case 'bid_lost':
        return `bg-gradient-to-br from-red-50/80 to-rose-50/80 border-red-200/50 backdrop-blur-sm ${darkBase} dark:from-red-900/20 dark:to-rose-900/20 dark:border-red-500/30`;
      case 'bid_expired':
        return `bg-gradient-to-br from-yellow-50/80 to-amber-50/80 border-yellow-200/50 backdrop-blur-sm ${darkBase} dark:from-yellow-900/20 dark:to-amber-900/20 dark:border-yellow-500/30`;
      case 'bid_expired_needs_award':
        return `bg-gradient-to-br from-orange-50/80 to-amber-50/80 border-orange-200/50 backdrop-blur-sm ${darkBase} dark:from-orange-900/20 dark:to-amber-900/20 dark:border-orange-500/30`;
      case 'bid_received':
        return `bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-blue-200/50 backdrop-blur-sm ${darkBase} dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-500/30`;
      case 'load_assigned':
        return `bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-200/50 backdrop-blur-sm ${darkBase} dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-500/30`;
      case 'system':
        return `bg-gradient-to-br from-gray-50/80 to-slate-50/80 border-gray-200/50 backdrop-blur-sm ${darkBase} dark:from-gray-800/20 dark:to-slate-800/20 dark:border-gray-600/30`;
      case 'new_lowest_bid':
        return `bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-blue-200/50 backdrop-blur-sm ${darkBase} dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-500/30`;
      case 'carrier_message':
      case 'bid_message':
        return `bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-200/50 backdrop-blur-sm ${darkBase} dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-500/30`;
      case 'profile_submission':
        return `bg-gradient-to-br from-orange-50/80 to-amber-50/80 border-orange-200/50 backdrop-blur-sm ${darkBase} dark:from-orange-900/20 dark:to-amber-900/20 dark:border-orange-500/30`;
      case 'bid_accepted':
        return `bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-green-200/50 backdrop-blur-sm ${darkBase} dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-500/30`;
      case 'admin_message':
        return `bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-green-200/50 backdrop-blur-sm ${darkBase} dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-500/30`;
      case 'profile_approved':
        return `bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-green-200/50 backdrop-blur-sm ${darkBase} dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-500/30`;
      case 'profile_declined':
        return `bg-gradient-to-br from-red-50/80 to-rose-50/80 border-red-200/50 backdrop-blur-sm ${darkBase} dark:from-red-900/20 dark:to-rose-900/20 dark:border-red-500/30`;
      default:
        return `bg-gradient-to-br from-gray-50/80 to-slate-50/80 border-gray-200/50 backdrop-blur-sm ${darkBase} dark:from-gray-800/20 dark:to-slate-800/20 dark:border-gray-600/30`;
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const endpoint = isAdmin 
        ? `/api/notifications` 
        : `/api/carrier/notifications/${notificationId}/read`;
      
      const method = isAdmin ? 'PUT' : 'POST';
      const body = isAdmin 
        ? JSON.stringify({ notificationId, read: true })
        : undefined;
      
      const response = await fetch(endpoint, {
        method,
        headers: isAdmin ? { 'Content-Type': 'application/json' } : undefined,
        body
      });
      
      if (!response.ok) {
        console.error('Failed to mark notification as read:', await response.text());
        return;
      }
      
      mutate(); // Refresh the data
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // For now, mark each unread notification individually
      // TODO: Add bulk mark-as-read endpoint if needed
      const unreadNotifications = notifications.filter((n: Notification) => !n.read);
      for (const notification of unreadNotifications) {
        await markAsRead(notification.id);
      }
      mutate(); // Refresh the data
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
      return;
    }

    try {
      const endpoint = isAdmin 
        ? '/api/notifications/clear-all' 
        : '/api/carrier/notifications/clear-all';
      
      const response = await fetch(endpoint, {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('Failed to clear all notifications:', await response.text());
        return;
      }
      
      mutate(); // Refresh the data
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  // State to force re-render for timestamp updates
  const [timestampUpdate, setTimestampUpdate] = useState(0);

  // Update timestamps every 30 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestampUpdate(prev => prev + 1);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Use timestampUpdate to ensure this function recalculates
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = timestampUpdate; // Force recalculation when timestampUpdate changes

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const handleMouseEnter = () => {
    if (previewTimeout) {
      clearTimeout(previewTimeout);
    }
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowPreview(false);
    }, 300); // Small delay to prevent flickering
    setPreviewTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
    };
  }, [previewTimeout]);

  return (
    <div className="relative">
      {/* Hover Preview */}
      {showPreview && notifications.length > 0 && (
        <div 
          className="absolute top-12 right-0 z-50 w-80 rounded-2xl shadow-2xl border backdrop-blur-2xl overflow-hidden bg-white/95 dark:bg-gray-900/95 border-opacity-20 dark:border-opacity-30"
          style={{
            borderColor: `rgba(${accentColor ? accentColor.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') : '99, 102, 241'}, 0.2)`,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 20% 50%, ${accentColor || '#6366f1'} 0%, transparent 50%)`,
            }}
          />
          <div 
            className="p-4 border-b backdrop-blur-sm relative z-10 dark:border-gray-700/50"
            style={{
              borderColor: `rgba(${accentColor ? accentColor.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') : '99, 102, 241'}, 0.1)`,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Notifications</h3>
              <Badge 
                variant="secondary" 
                className="text-xs backdrop-blur-sm"
                style={{
                  backgroundColor: accentColor ? `${accentColor}20` : undefined,
                  borderColor: accentColor ? `${accentColor}40` : undefined,
                }}
              >
                {unreadCount} unread
              </Badge>
            </div>
          </div>
          <ScrollArea className="max-h-64 relative z-10">
            <div className="p-3 space-y-2">
              {recentNotifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer border relative z-10 ${
                    notification.read ? 'opacity-70' : ''
                  } ${getNotificationColor(notification.type)}`}
                  onClick={() => {
                    if (!notification.read) markAsRead(notification.id);
                    setIsOpen(true);
                    setShowPreview(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className={`text-sm font-semibold break-words ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed break-words ${notification.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <div 
                          className="w-2 h-2 rounded-full mt-2 animate-pulse"
                          style={{ backgroundColor: accentColor || '#3b82f6' }}
                        ></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div 
            className="p-3 border-t backdrop-blur-sm relative z-10 dark:border-gray-700/50"
            style={{
              borderColor: `rgba(${accentColor ? accentColor.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') : '99, 102, 241'}, 0.1)`,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs hover:bg-opacity-80 backdrop-blur-sm"
              style={{
                backgroundColor: accentColor ? `${accentColor}15` : undefined,
              }}
              onClick={() => {
                window.location.href = '/carrier/notifications';
              }}
            >
              Manage Notifications
            </Button>
          </div>
        </div>
      )}

      {/* Main Notification Bell */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            ref={buttonRef}
            variant="ghost"
            size="sm"
            className="relative h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        
        <DialogContent 
          className="max-w-lg max-h-[85vh] border shadow-2xl backdrop-blur-2xl overflow-hidden bg-white/95 dark:bg-gray-900/95 border-opacity-30 dark:border-opacity-30"
          style={{
            borderColor: `rgba(${accentColor ? accentColor.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') : '99, 102, 241'}, 0.3)`,
          }}
        >
          <div 
            className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 20% 50%, ${accentColor || '#6366f1'} 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${accentColor || '#6366f1'} 0%, transparent 50%)`,
            }}
          />
          <DialogHeader className="pb-4 relative z-10">
            <DialogTitle className="flex items-center justify-between text-xl">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2.5 rounded-xl backdrop-blur-sm shadow-lg"
                  style={{
                    backgroundColor: accentColor ? `${accentColor}20` : 'rgba(99, 102, 241, 0.2)',
                    borderColor: accentColor ? `${accentColor}40` : 'rgba(99, 102, 241, 0.3)',
                    borderWidth: '1px',
                  }}
                >
                  <Bell 
                    className="h-5 w-5" 
                    style={{ color: accentColor || '#6366f1' }}
                  />
                </div>
                <span 
                  className="font-bold"
                  style={{ color: accentColor || '#6366f1' }}
                >
                  Notifications
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isCarrier && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsOpen(false);
                      window.location.href = '/carrier/notifications';
                    }}
                    className="h-8 w-8 -mr-1 backdrop-blur-sm border-opacity-30 hover:border-opacity-50"
                    style={{
                      backgroundColor: accentColor ? `${accentColor}15` : undefined,
                      borderColor: accentColor ? `${accentColor}30` : undefined,
                    }}
                    title="Manage Notifications"
                  >
                    <Settings className="h-4 w-4" style={{ color: accentColor || undefined }} />
                  </Button>
                )}
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs backdrop-blur-sm border-opacity-30 hover:border-opacity-50"
                    style={{
                      backgroundColor: accentColor ? `${accentColor}15` : undefined,
                      borderColor: accentColor ? `${accentColor}30` : undefined,
                    }}
                  >
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllNotifications}
                    className="text-xs backdrop-blur-sm text-red-600 hover:text-red-700 border-red-200 dark:border-red-800"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] relative z-10">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <div 
                  className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center backdrop-blur-sm shadow-lg"
                  style={{
                    backgroundColor: accentColor ? `${accentColor}15` : 'rgba(99, 102, 241, 0.1)',
                  }}
                >
                  <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No notifications yet</h3>
                <p className="text-gray-500 dark:text-gray-400">We'll notify you when something important happens!</p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {notifications.map((notification: Notification) => (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.01] border backdrop-blur-sm ${
                      notification.read ? 'opacity-70' : ''
                    } ${getNotificationColor(notification.type)} shadow-lg`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                    style={{
                      boxShadow: notification.read 
                        ? undefined 
                        : `0 4px 20px -2px ${accentColor ? `${accentColor}30` : 'rgba(99, 102, 241, 0.2)'}`,
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div 
                          className="flex-shrink-0 mt-0.5 p-2 rounded-xl backdrop-blur-sm shadow-md"
                          style={{
                            backgroundColor: accentColor ? `${accentColor}20` : 'rgba(255, 255, 255, 0.5)',
                          }}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className={`text-sm font-semibold break-words ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                              {notification.title}
                            </h4>
                            <span 
                              className="text-xs px-2 py-1 rounded-full backdrop-blur-sm whitespace-nowrap flex-shrink-0"
                              style={{
                                backgroundColor: accentColor ? `${accentColor}15` : 'rgba(99, 102, 241, 0.1)',
                                color: accentColor || undefined,
                              }}
                            >
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed break-words ${notification.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notification.message}
                          </p>
                          {!notification.read && (
                            <div className="flex items-center gap-2 mt-2">
                              <div 
                                className="w-2 h-2 rounded-full animate-pulse"
                                style={{ backgroundColor: accentColor || '#3b82f6' }}
                              ></div>
                              <span 
                                className="text-xs font-medium"
                                style={{ color: accentColor || '#3b82f6' }}
                              >
                                New
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {/* Preferences Section (for carriers only) */}
          {isCarrier && (
            <>
              <Separator className="my-4" />
              <div className="px-6 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Settings</Label>
                  <div className="space-y-3">
                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Label htmlFor="bell-sound-toggle" className="text-sm cursor-pointer">
                          Sound
                        </Label>
                      </div>
                      <Switch
                        id="bell-sound-toggle"
                        checked={soundEnabled}
                        onCheckedChange={setSoundEnabled}
                      />
                    </div>
                    
                    {/* Desktop Notifications Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="bell-desktop-toggle" className="text-sm cursor-pointer">
                          Desktop Notifications
                        </Label>
                      </div>
                      <Switch
                        id="bell-desktop-toggle"
                        checked={desktopNotificationsEnabled}
                        onCheckedChange={setDesktopNotificationsEnabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
