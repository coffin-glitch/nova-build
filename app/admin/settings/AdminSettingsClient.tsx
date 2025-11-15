"use client";

import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
  Bell,
  Database,
  Globe,
  Lock,
  Mail,
  Shield,
  Volume2,
  VolumeX,
  Zap,
  Settings as SettingsIcon,
  BarChart3,
  Users,
  MessageSquare,
  FileText,
  AlertTriangle
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export function AdminSettingsClient() {
  const { accentColor } = useAccentColor();
  
  // Notification preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const storedSound = localStorage.getItem('notification_sound_enabled');
      if (storedSound !== null) {
        setSoundEnabled(storedSound === 'true');
      }
      
      const storedDesktop = localStorage.getItem('notification_desktop_enabled');
      if (storedDesktop !== null) {
        setDesktopNotificationsEnabled(storedDesktop === 'true');
      }

      // Check notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
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
        setNotificationPermission(permission);
        if (permission !== 'granted') {
          setDesktopNotificationsEnabled(false);
          toast.error('Desktop notifications permission denied');
        } else {
          toast.success('Desktop notifications enabled');
        }
      });
    }
  }, [desktopNotificationsEnabled]);

  const handleTestSound = () => {
    try {
      const audio = new Audio('/notification-sound.wav');
      audio.volume = 0.5;
      audio.play().catch(() => {
        const mp3Audio = new Audio('/notification-sound.mp3');
        mp3Audio.volume = 0.5;
        mp3Audio.play().catch(() => {
          toast.error('Could not play notification sound');
        });
      });
      toast.success('Playing test sound');
    } catch (error) {
      toast.error('Could not play notification sound');
    }
  };

  const handleTestDesktopNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Test Notification', {
        body: 'This is a test desktop notification from Nova Build',
        icon: '/favicon.ico',
        tag: 'test-notification',
      });
      toast.success('Test notification sent');
    } else {
      toast.error('Desktop notifications not permitted');
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Admin Settings"
        description="Manage your admin preferences and system configurations"
      />

      {/* Notification Settings */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: accentColor ? `${accentColor}15` : 'rgba(99, 102, 241, 0.1)',
              }}
            >
              <Bell 
                className="h-5 w-5" 
                style={{ color: accentColor || '#6366f1' }}
              />
            </div>
            <div>
              <CardTitle className="text-2xl">Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sound Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-4 flex-1">
              <div 
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                }}
              >
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="sound-toggle" className="text-base font-semibold cursor-pointer">
                  Sound Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Play a sound when new notifications arrive
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSound}
                className="text-xs"
              >
                Test
              </Button>
              <Switch
                id="sound-toggle"
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>
          </div>

          <Separator />

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-4 flex-1">
              <div 
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                }}
              >
                <Bell className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
              </div>
              <div className="flex-1">
                <Label htmlFor="desktop-toggle" className="text-base font-semibold cursor-pointer">
                  Desktop Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Show browser notifications for new alerts
                </p>
                {isMounted && notificationPermission && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Permission: {notificationPermission === 'granted' ? '✓ Granted' : notificationPermission === 'denied' ? '✗ Denied' : '? Default'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestDesktopNotification}
                className="text-xs"
                disabled={!desktopNotificationsEnabled || !isMounted || notificationPermission !== 'granted'}
              >
                Test
              </Button>
              <Switch
                id="desktop-toggle"
                checked={desktopNotificationsEnabled}
                onCheckedChange={setDesktopNotificationsEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: accentColor ? `${accentColor}15` : 'rgba(99, 102, 241, 0.1)',
              }}
            >
              <Zap 
                className="h-5 w-5" 
                style={{ color: accentColor || '#6366f1' }}
              />
            </div>
            <div>
              <CardTitle className="text-2xl">Quick Links</CardTitle>
              <CardDescription>
                Access frequently used admin tools
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <BarChart3 className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Dashboard</h3>
                      <p className="text-xs text-muted-foreground">View system overview</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <Users className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Manage Carriers</h3>
                      <p className="text-xs text-muted-foreground">User management</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/messages">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <MessageSquare className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Messages</h3>
                      <p className="text-xs text-muted-foreground">Chat with carriers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/bids">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <FileText className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Bids</h3>
                      <p className="text-xs text-muted-foreground">Manage bids</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/manage-loads">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <Database className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Manage Loads</h3>
                      <p className="text-xs text-muted-foreground">Load management</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/profile">
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-2 h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(99, 102, 241, 0.1)',
                      }}
                    >
                      <SettingsIcon className="h-5 w-5" style={{ color: accentColor || '#6366f1' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Profile</h3>
                      <p className="text-xs text-muted-foreground">Edit your profile</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: accentColor ? `${accentColor}15` : 'rgba(99, 102, 241, 0.1)',
              }}
            >
              <Shield 
                className="h-5 w-5" 
                style={{ color: accentColor || '#6366f1' }}
              />
            </div>
            <div>
              <CardTitle className="text-2xl">System Information</CardTitle>
              <CardDescription>
                View system status and configuration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Environment</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'Development' : 'Production'}
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Security</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Admin access enabled
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

