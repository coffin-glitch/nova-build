"use client";

import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { swrFetcher } from "@/lib/safe-fetcher";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  MessageSquare,
  Settings,
  Target,
  Volume2,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

// Simple filter options
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Notifications' },
  { value: 'unread', label: 'Unread Only' },
] as const;

export default function NotificationsPage() {
  const { isCarrier } = useUnifiedRole();
  const { user } = useUnifiedUser();
  const { accentColor } = useAccentColor();
  const [filter, setFilter] = useState<string>('all');
  
  // Load preferences from localStorage
  // Initialize with default values to avoid hydration mismatch
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  
  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSound = localStorage.getItem('notification_sound_enabled');
      if (storedSound !== null) {
        setSoundEnabled(storedSound === 'true');
      }
      
      const storedDesktop = localStorage.getItem('notification_desktop_enabled');
      if (storedDesktop !== null) {
        setDesktopNotificationsEnabled(storedDesktop === 'true');
    }
    }
  }, []);

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
          toast.error('Desktop notifications permission denied');
        }
      });
    }
  }, [desktopNotificationsEnabled]);

  // Build API endpoint - limit to last 50 notifications
  const notificationsEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.append('limit', '50');
    if (filter === 'unread') {
      params.append('unread_only', 'true');
    }
    return `/api/carrier/notifications?${params.toString()}`;
  }, [filter]);

  const { data, mutate, error } = useSWR(
    isCarrier ? notificationsEndpoint : null,
    swrFetcher,
    {
      refreshInterval: 0, // Disable polling - using Realtime instead
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleNotificationInsert = useCallback(() => {
    console.log('[NotificationsPage] New notification received, refreshing...');
    mutate();
  }, [mutate]);

  const handleNotificationUpdate = useCallback(() => {
    console.log('[NotificationsPage] Notification updated, refreshing...');
    mutate();
  }, [mutate]);

  // Subscribe to real-time notification updates
  useRealtimeNotifications({
    enabled: !!user?.id && isCarrier,
    userId: user?.id,
    onInsert: handleNotificationInsert,
    onUpdate: handleNotificationUpdate,
  });

  const notifications: Notification[] = data?.notifications || [];

  // Simple grouping: Group 3+ notifications of same type in 5-minute windows
  const groupedNotifications = useMemo(() => {
    if (!notifications.length) return [];

    const groups: Array<{
      type: string;
      notifications: Notification[];
      count: number;
      latestTime: Date;
      isGrouped: boolean;
    }> = [];

    // Group by type and time window
    const typeGroups = new Map<string, Notification[]>();
    
    notifications.forEach((notification) => {
      const key = notification.type;
      if (!typeGroups.has(key)) {
        typeGroups.set(key, []);
      }
      typeGroups.get(key)!.push(notification);
    });

    // Process each type group
    typeGroups.forEach((notifs, type) => {
      // Group by 5-minute time windows
      const timeGroups = new Map<string, Notification[]>();
      
      notifs.forEach((notif) => {
        const notifTime = new Date(notif.created_at);
        const windowStart = new Date(notifTime);
        windowStart.setMinutes(Math.floor(notifTime.getMinutes() / 5) * 5, 0, 0);
        const windowKey = `${windowStart.toISOString()}`;
        
        if (!timeGroups.has(windowKey)) {
          timeGroups.set(windowKey, []);
        }
        timeGroups.get(windowKey)!.push(notif);
      });

      // Create groups - if 3+ in a 5-minute window, group them
      timeGroups.forEach((windowNotifs) => {
        if (windowNotifs.length >= 3 && ['exact_match', 'state_match', 'state_pref_bid'].includes(type)) {
          groups.push({
            type,
            notifications: windowNotifs,
            count: windowNotifs.length,
            latestTime: new Date(Math.max(...windowNotifs.map(n => new Date(n.created_at).getTime()))),
            isGrouped: true,
          });
        } else {
          // Keep individual
          windowNotifs.forEach((notif) => {
            groups.push({
              type,
              notifications: [notif],
              count: 1,
              latestTime: new Date(notif.created_at),
              isGrouped: false,
            });
          });
        }
      });
    });

    // Sort by latest time
    return groups.sort((a, b) => b.latestTime.getTime() - a.latestTime.getTime());
  }, [notifications]);

  // Track previous unread notification IDs to only play sound/show desktop notifications for NEW ones
  const previousUnreadIdsRef = useRef<Set<string>>(new Set());

  // Play sound for new notifications
  useEffect(() => {
    if (soundEnabled && notifications.length > 0) {
      const unread = notifications.filter(n => !n.read);
      const currentUnreadIds = new Set(unread.map(n => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter(n => !previousUnreadIdsRef.current.has(n.id));
      
      // Only play sound if there are new unread notifications (and we had previous data)
      if (newUnread.length > 0 && previousUnreadIdsRef.current.size > 0) {
        try {
          // Try WAV first (we have this file), fallback to MP3
          const audio = new Audio('/notification-sound.wav');
          audio.volume = 0.5;
          audio.play().catch(() => {
            // If WAV fails, try MP3
            const mp3Audio = new Audio('/notification-sound.mp3');
            mp3Audio.volume = 0.5;
            mp3Audio.play().catch(() => {
              // Ignore errors if sound files don't exist
              console.log('Could not play notification sound');
            });
          });
        } catch (error) {
          // Ignore errors
        }
      }
      
      // Update ref (doesn't trigger re-render)
      previousUnreadIdsRef.current = currentUnreadIds;
    }
  }, [notifications, soundEnabled]);

  // Show desktop notifications for new unread
  useEffect(() => {
    if (desktopNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const unread = notifications.filter(n => !n.read);
      const currentUnreadIds = new Set(unread.map(n => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter(n => !previousUnreadIdsRef.current.has(n.id));
      
      if (newUnread.length > 0 && previousUnreadIdsRef.current.size > 0) {
        // Show notification for the latest new unread
        const latest = newUnread[0];
        new Notification(latest.title, {
          body: latest.message,
          icon: '/favicon.ico',
          tag: latest.id, // Prevent duplicate notifications
          requireInteraction: false,
        });
      }
      
      // Update ref (doesn't trigger re-render)
      previousUnreadIdsRef.current = currentUnreadIds;
    }
  }, [notifications, desktopNotificationsEnabled]);

  const markAsRead = async (notificationId: string) => {
    // Optimistic update: Mark as read immediately in UI
    mutate((current: any) => {
      if (!current?.data?.notifications) return current;
      return {
        ...current,
        data: {
          ...current.data,
          notifications: current.data.notifications.map((n: any) => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        }
      };
    }, false); // false = don't revalidate yet, let Realtime handle it

    try {
      await fetch(`/api/carrier/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      // Realtime will sync the actual state, so we don't need to mutate again
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Revert on error - Realtime will sync the correct state
      mutate();
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update: Mark all as read immediately in UI
    mutate((current: any) => {
      if (!current?.data?.notifications) return current;
      return {
        ...current,
        data: {
          ...current.data,
          notifications: current.data.notifications.map((n: any) => ({ ...n, read: true }))
        }
      };
    }, false); // false = don't revalidate yet, let Realtime handle it

    try {
      await fetch('/api/carrier/notifications/read-all', {
        method: 'POST',
      });
      // Realtime will sync the actual state, so we don't need to mutate again
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Revert on error - Realtime will sync the correct state
      mutate();
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bid_won':
      case 'bid_accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'bid_lost':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'bid_expired':
      case 'deadline_approaching':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'exact_match':
      case 'state_match':
      case 'state_pref_bid':
        return <Target className="h-5 w-5 text-blue-500" />;
      case 'admin_message':
      case 'carrier_message':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'system':
        return <Info className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="py-8">
      <PageHeader 
        title="Notification Settings" 
        subtitle="Manage your notification preferences and view recent activity"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "Notifications" }
        ]}
      />

      <div className="space-y-6 mt-6">
        {/* Preferences Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>
              Control how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound-toggle" className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Sound Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Play a sound when new notifications arrive
                </p>
              </div>
              <Switch
                id="sound-toggle"
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>

            <Separator />

            {/* Desktop Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="desktop-toggle" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Desktop Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show browser notifications for new alerts
                </p>
              </div>
              <Switch
                id="desktop-toggle"
                checked={desktopNotificationsEnabled}
                onCheckedChange={setDesktopNotificationsEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription className="mt-1">
                  Last 50 notifications (older notifications are automatically archived)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {FILTER_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={filter === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    Mark all as read
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {groupedNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications found</p>
                  {filter === 'unread' && (
                    <p className="text-xs mt-2">Try switching to "All Notifications"</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedNotifications.map((group) => (
                    <div
                      key={group.isGrouped ? `group-${group.type}-${group.latestTime.getTime()}` : group.notifications[0].id}
                      className={`p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        !group.notifications[0].read ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''
                      }`}
                      onClick={() => {
                        if (!group.notifications[0].read) {
                          group.notifications.forEach(n => markAsRead(n.id));
                        }
                      }}
                    >
                      {group.isGrouped ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getNotificationIcon(group.type)}
                              <span className="font-semibold">
                                {group.count} new {group.type.replace(/_/g, ' ')} notifications
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(group.latestTime.toISOString())}
                            </span>
                          </div>
                          <div className="pl-7 space-y-1">
                            {group.notifications.slice(0, 3).map((notif) => (
                              <p key={notif.id} className="text-sm text-muted-foreground">
                                • {notif.title}
                              </p>
                            ))}
                            {group.notifications.length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                +{group.notifications.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(group.notifications[0].type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold">{group.notifications[0].title}</h4>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTimeAgo(group.notifications[0].created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {group.notifications[0].message}
                            </p>
                          </div>
                          {!group.notifications[0].read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

