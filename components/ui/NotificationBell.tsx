"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, CheckCircle, Info, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Notification {
  id: string;
  type: 'bid_won' | 'bid_lost' | 'bid_expired' | 'load_assigned' | 'bid_received' | 'system' | 'info';
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
  
  // Use carrier-specific notifications endpoint
  const { data, mutate } = useSWR('/api/carrier/notifications', fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
    onError: (err) => console.error('Notification fetch error:', err),
  });

  // Get pagination data to calculate unread count
  const notifications = data?.data?.notifications || [];
  const pagination = data?.data?.pagination;
  
  // Calculate unread count from notifications
  const unreadCount = notifications.filter((n: Notification) => !n.read).length;
  const recentNotifications = notifications.slice(0, 3); // Show only 3 most recent for preview

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bid_won':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'bid_lost':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'bid_expired':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'bid_received':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'load_assigned':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'system':
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'bid_won':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
      case 'bid_lost':
        return 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200';
      case 'bid_expired':
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
      case 'bid_received':
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
      case 'load_assigned':
        return 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200';
      case 'system':
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
      default:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/carrier/notifications/${notificationId}/read`, {
        method: 'POST'
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
      const response = await fetch('/api/carrier/notifications/read-all', {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('Failed to mark all notifications as read:', await response.text());
        return;
      }
      
      mutate(); // Refresh the data
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

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
          className="absolute top-12 right-0 z-50 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Notifications</h3>
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            </div>
          </div>
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-2">
              {recentNotifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer ${
                    notification.read ? 'opacity-60' : ''
                  } ${getNotificationColor(notification.type)}`}
                  onClick={() => {
                    if (!notification.read) markAsRead(notification.id);
                    setIsOpen(true);
                    setShowPreview(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`text-sm font-medium truncate ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setIsOpen(true);
                setShowPreview(false);
              }}
            >
              View All Notifications
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
        
        <DialogContent className="max-w-lg max-h-[85vh] bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between text-xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Notifications
                </span>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs bg-white/50 backdrop-blur-sm hover:bg-white/80"
                >
                  Mark all read
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No notifications yet</h3>
                <p className="text-gray-500">We'll notify you when something important happens!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification: Notification) => (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                      notification.read ? 'opacity-60' : 'ring-2 ring-blue-100 dark:ring-blue-900'
                    } ${getNotificationColor(notification.type)} border-0 shadow-md`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 p-1 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`text-sm font-semibold ${notification.read ? 'text-gray-600' : 'text-gray-900 dark:text-white'}`}>
                              {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notification.message}
                          </p>
                          {!notification.read && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">New</span>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
