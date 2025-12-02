"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPickupDateTime } from "@/lib/format";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useCallback } from "react";
import {
    Bell,
    BellOff,
    CheckCircle,
    Clock,
    Info,
    Mail,
    MessageSquare,
    Settings,
    Truck,
    X
} from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface NotificationSystemProps {
  className?: string;
}

interface Notification {
  id: string;
  type: 'status_change' | 'offer_response' | 'load_update' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  loadId?: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
}

export function NotificationSystem({ className }: NotificationSystemProps) {
  const { user } = useUnifiedUser();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const { data: notificationsData, mutate } = useSWR(
    user ? "/api/carrier/notifications" : null,
    fetcher,
    { refreshInterval: 0 } // Disable polling - using Realtime instead
  );

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleNotificationInsert = useCallback(() => {
    console.log('[NotificationSystem] New notification received, refreshing...');
    mutate();
  }, [mutate]);

  const handleNotificationUpdate = useCallback(() => {
    console.log('[NotificationSystem] Notification updated, refreshing...');
    mutate();
  }, [mutate]);

  // Subscribe to real-time notification updates
  useRealtimeNotifications({
    enabled: !!user?.id,
    userId: user?.id,
    onInsert: handleNotificationInsert,
    onUpdate: handleNotificationUpdate,
  });

  const notifications: Notification[] = notificationsData?.notifications || [];

  // Update unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/carrier/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      mutate(); // Refresh notifications
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/carrier/notifications/read-all', {
        method: 'POST',
      });
      mutate(); // Refresh notifications
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `w-4 h-4 ${
      priority === 'high' ? 'text-red-500' : 
      priority === 'medium' ? 'text-yellow-500' : 
      'text-blue-500'
    }`;

    switch (type) {
      case 'status_change':
        return <CheckCircle className={iconClass} />;
      case 'offer_response':
        return <MessageSquare className={iconClass} />;
      case 'load_update':
        return <Truck className={iconClass} />;
      case 'system':
        return <Info className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50/50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50/50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50/50';
      default:
        return 'border-l-gray-500 bg-gray-50/50';
    }
  };

  return (
    <div className={className}>
      {/* Notification Bell */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="relative"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Notification Dropdown */}
        {isOpen && (
          <Card className="absolute right-0 top-12 w-96 z-50 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="secondary">{unreadCount} unread</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllAsRead}>
                      Mark All Read
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <BellOff className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No notifications yet</p>
                    <p className="text-sm">You'll receive updates about your loads here</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-l-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          getPriorityColor(notification.priority)
                        } ${!notification.read ? 'bg-muted/30' : ''}`}
                        onClick={() => {
                          if (!notification.read) {
                            markAsRead(notification.id);
                          }
                          if (notification.actionUrl) {
                            window.location.href = notification.actionUrl;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.type, notification.priority)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatPickupDateTime(notification.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Notification Settings Component
export function NotificationSettings() {
  const { user } = useUnifiedUser();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    statusChangeNotifications: true,
    offerResponseNotifications: true,
    loadUpdateNotifications: true,
    systemNotifications: false
  });

  const updateSettings = async (newSettings: typeof settings) => {
    try {
      await fetch('/api/carrier/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    updateSettings(newSettings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Notification Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Receive notifications via email</p>
            </div>
            <Button
              variant={settings.emailNotifications ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSetting('emailNotifications')}
            >
              {settings.emailNotifications ? <Mail className="w-4 h-4" /> : <Mail className="w-4 h-4 opacity-50" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Status Change Notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when load status changes</p>
            </div>
            <Button
              variant={settings.statusChangeNotifications ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSetting('statusChangeNotifications')}
            >
              {settings.statusChangeNotifications ? <CheckCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 opacity-50" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Offer Response Notifications</p>
              <p className="text-xs text-muted-foreground">Get notified about offer responses</p>
            </div>
            <Button
              variant={settings.offerResponseNotifications ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSetting('offerResponseNotifications')}
            >
              {settings.offerResponseNotifications ? <MessageSquare className="w-4 h-4" /> : <MessageSquare className="w-4 h-4 opacity-50" />}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Load Update Notifications</p>
              <p className="text-xs text-muted-foreground">Get notified about load updates</p>
            </div>
            <Button
              variant={settings.loadUpdateNotifications ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSetting('loadUpdateNotifications')}
            >
              {settings.loadUpdateNotifications ? <Truck className="w-4 h-4" /> : <Truck className="w-4 h-4 opacity-50" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
