"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardGlass } from "@/components/ui/CardGlass";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Notification {
  id: string;
  type: "auction_won" | "auction_lost" | "bid_placed" | "bid_updated";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: {
    bid_number?: string;
    amount_cents?: number;
  };
}

export default function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const [timestampUpdate, setTimestampUpdate] = useState(0);

  // Update timestamps every 30 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestampUpdate(prev => prev + 1);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const { user } = useUnifiedUser();

  const { data, mutate, isLoading } = useSWR(
    "/api/notifications?unread=1",
    fetcher,
    { 
      refreshInterval: 0, // Disable polling - using Realtime instead
      revalidateOnFocus: true, // Revalidate when window regains focus
      revalidateOnReconnect: true, // Revalidate when network reconnects
      keepPreviousData: true, // Keep previous data during refetch to prevent flashing
      fallbackData: { ok: true, data: [] }
    }
  );

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleNotificationInsert = useCallback(() => {
    console.log('[NotificationsMenu] New notification received, refreshing...');
    mutate();
  }, [mutate]);

  const handleNotificationUpdate = useCallback(() => {
    console.log('[NotificationsMenu] Notification updated, refreshing...');
    mutate();
  }, [mutate]);

  const handleNotificationDelete = useCallback((payload: any) => {
    console.log('[NotificationsMenu] Notification deleted, removing from cache...', payload);
    // Optimistically remove the deleted notification from cache
    mutate((current: any) => {
      if (!current?.data) return current;
      
      const deletedId = payload.old?.id?.toString() || payload.old?.id;
      
      // Handle both data structures
      if (Array.isArray(current.data)) {
        // Format: { data: [...] }
        return {
          ...current,
          data: current.data.filter((n: Notification) => n.id?.toString() !== deletedId)
        };
      } else if (current.data?.notifications) {
        // Format: { data: { notifications: [...], unreadCount: ... } }
        const updatedNotifications = current.data.notifications.filter((n: Notification) => 
          n.id?.toString() !== deletedId
        );
        return {
          ...current,
          data: {
            ...current.data,
            notifications: updatedNotifications,
            unreadCount: updatedNotifications.filter((n: Notification) => !n.read).length
          }
        };
      }
      return current;
    }, false); // Don't revalidate - we've already updated the cache
  }, [mutate]);

  // Subscribe to real-time notification updates
  useRealtimeNotifications({
    enabled: !!user?.id,
    userId: user?.id,
    onInsert: handleNotificationInsert,
    onUpdate: handleNotificationUpdate,
    onDelete: handleNotificationDelete,
  });

  // Handle both response formats: { data: [...] } or { data: { notifications: [...] } }
  const notifications = data?.data?.notifications || data?.data || [];
  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  const handleMarkAllRead = async () => {
    // Optimistic update: Mark all as read immediately in UI
    mutate((current: any) => {
      if (!current?.data) return current;
      
      // Handle both data structures
      if (Array.isArray(current.data)) {
        // Format: { data: [...] }
        return {
          ...current,
          data: current.data.map((n: Notification) => ({ ...n, read: true }))
        };
      } else if (current.data?.notifications) {
        // Format: { data: { notifications: [...], unreadCount: ... } }
        return {
          ...current,
          data: {
            ...current.data,
            notifications: current.data.notifications.map((n: Notification) => ({ ...n, read: true })),
            unreadCount: 0
          }
        };
      }
      return current;
    }, false); // false = don't revalidate yet, let Realtime handle it

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      // Realtime will sync the actual state, so we don't need to mutate again
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      // Revert on error - Realtime will sync the correct state
      mutate();
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    // Optimistic update: Mark as read immediately in UI
    mutate((current: any) => {
      if (!current?.data) return current;
      
      // Handle both data structures
      if (Array.isArray(current.data)) {
        // Format: { data: [...] }
        return {
          ...current,
          data: current.data.map((n: Notification) => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        };
      } else if (current.data?.notifications) {
        // Format: { data: { notifications: [...], unreadCount: ... } }
        const updatedNotifications = current.data.notifications.map((n: Notification) => 
          n.id === notificationId ? { ...n, read: true } : n
        );
        return {
          ...current,
          data: {
            ...current.data,
            notifications: updatedNotifications,
            unreadCount: updatedNotifications.filter((n: Notification) => !n.read).length
          }
        };
      }
      return current;
    }, false); // false = don't revalidate yet, let Realtime handle it

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notificationId }),
      });
      // Realtime will sync the actual state, so we don't need to mutate again
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert on error - Realtime will sync the correct state
      mutate();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "auction_won":
        return "🎉";
      case "auction_lost":
        return "😔";
      case "bid_placed":
        return "💰";
      case "bid_updated":
        return "✏️";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "auction_won":
        return "text-green-400";
      case "auction_lost":
        return "text-red-400";
      case "bid_placed":
        return "text-blue-400";
      case "bid_updated":
        return "text-yellow-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 text-slate-300 hover:text-white hover:bg-white/10"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 bg-slate-800 border-slate-700 text-white"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs text-slate-400 hover:text-white"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleMarkRead(notification.id)}
                  className="cursor-pointer"
                >
                <CardGlass
                  className={`p-3 hover:bg-white/5 transition-colors ${
                    !notification.read ? "bg-blue-500/10 border-blue-500/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-lg ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></div>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {/* timestampUpdate forces re-render to update timestamp in real-time */}
                        {(() => {
                          // Access timestampUpdate to force recalculation when it changes
                          void timestampUpdate;
                          return formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
                        })()}
                      </p>
                    </div>
                  </div>
                </CardGlass>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}