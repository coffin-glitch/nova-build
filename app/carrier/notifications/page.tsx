"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  MessageSquare, 
  FileText, 
  Target,
  Info,
  Filter,
  Search,
  Volume2,
  VolumeX
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/safe-fetcher";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useAccentColor } from "@/hooks/useAccentColor";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

// Notification types for filtering
const NOTIFICATION_TYPES = [
  { value: 'all', label: 'All', icon: Bell },
  { value: 'exact_match', label: 'Exact Match', icon: Target },
  { value: 'state_match', label: 'State Match', icon: Target },
  { value: 'state_pref_bid', label: 'State Pref Bid', icon: Target },
  { value: 'deadline_approaching', label: 'Deadline Approaching', icon: AlertTriangle },
  { value: 'bid_won', label: 'Bid Won', icon: CheckCircle },
  { value: 'bid_lost', label: 'Bid Lost', icon: XCircle },
  { value: 'admin_message', label: 'Messages', icon: MessageSquare },
  { value: 'system', label: 'System', icon: Info },
] as const;

export default function NotificationsPage() {
  const { isCarrier } = useUnifiedRole();
  const { accentColor } = useAccentColor();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Build API endpoint with filters
  const notificationsEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType !== 'all') {
      params.append('type', selectedType);
    }
    return `/api/carrier/notifications?${params.toString()}`;
  }, [selectedType]);

  const { data, mutate, error } = useSWR(
    isCarrier ? notificationsEndpoint : null,
    swrFetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const notifications: Notification[] = data?.notifications || [];

  // Group notifications by type and time window (5 minutes)
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

      // Create groups - if more than 2 in a 5-minute window, group them
      timeGroups.forEach((windowNotifs, windowKey) => {
        if (windowNotifs.length > 2 && ['exact_match', 'state_match', 'state_pref_bid'].includes(type)) {
          // Group these notifications
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

  // Filter by search term
  const filteredNotifications = useMemo(() => {
    if (!searchTerm) return groupedNotifications;
    
    const term = searchTerm.toLowerCase();
    return groupedNotifications.filter((group) => {
      return group.notifications.some((notif) => 
        notif.title.toLowerCase().includes(term) ||
        notif.message.toLowerCase().includes(term)
      );
    });
  }, [groupedNotifications, searchTerm]);

  // Track previous unread notification IDs to only play sound for NEW notifications
  const [previousUnreadIds, setPreviousUnreadIds] = useState<Set<string>>(new Set());

  // Play sound for new notifications
  useEffect(() => {
    if (soundEnabled && notifications.length > 0) {
      const unread = notifications.filter(n => !n.read);
      const currentUnreadIds = new Set(unread.map(n => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter(n => !previousUnreadIds.has(n.id));
      
      // Only play sound if there are new unread notifications (and we had previous data)
      if (newUnread.length > 0 && previousUnreadIds.size > 0) {
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
      
      setPreviousUnreadIds(currentUnreadIds);
    }
  }, [notifications, soundEnabled, previousUnreadIds]);

  // Track previous unread notifications to only show desktop notifications for NEW ones
  const [previousUnreadIds, setPreviousUnreadIds] = useState<Set<string>>(new Set());

  // Show desktop notifications for new unread
  useEffect(() => {
    if (desktopNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const unread = notifications.filter(n => !n.read);
      const currentUnreadIds = new Set(unread.map(n => n.id));
      
      // Find new unread notifications (not in previous set)
      const newUnread = unread.filter(n => !previousUnreadIds.has(n.id));
      
      if (newUnread.length > 0) {
        // Show notification for the latest new unread
        const latest = newUnread[0];
        new Notification(latest.title, {
          body: latest.message,
          icon: '/favicon.ico',
          tag: latest.id, // Prevent duplicate notifications
          requireInteraction: false,
        });
      }
      
      setPreviousUnreadIds(currentUnreadIds);
    }
  }, [notifications, desktopNotificationsEnabled, previousUnreadIds]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/carrier/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      mutate();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/carrier/notifications/read-all', {
        method: 'POST',
      });
      mutate();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
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
        title="Notifications" 
        subtitle="View and manage your notifications"
        breadcrumbs={[
          { label: "Carrier", href: "/carrier" },
          { label: "Notifications" }
        ]}
      />

      <div className="space-y-6 mt-6">
        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>

              {/* Type Filter */}
              <div className="flex gap-2 overflow-x-auto">
                {NOTIFICATION_TYPES.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={selectedType === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(value)}
                    className="whitespace-nowrap"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </Button>
                ))}
              </div>

              {/* Sound/Desktop Toggles */}
              <div className="flex gap-2">
                <Button
                  variant={soundEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Disable sound' : 'Enable sound'}
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button
                  variant={desktopNotificationsEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDesktopNotificationsEnabled(!desktopNotificationsEnabled)}
                  title={desktopNotificationsEnabled ? 'Disable desktop notifications' : 'Enable desktop notifications'}
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Badge variant="default">{unreadCount} unread</Badge>
                )}
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
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((group) => (
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
                                {group.count} new {NOTIFICATION_TYPES.find(t => t.value === group.type)?.label || group.type} notifications
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

