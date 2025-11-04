"use client";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPalette } from "@/components/ui/ColorPalette";
import FloatingBubbleLanding from "@/components/ui/FloatingBubbleLanding";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { cn } from "@/lib/utils";
import { Mail, MailOpen, Menu, Truck, User, X, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import RoleNavigation, { MobileRoleNavigation } from "./RoleNavigation";

// Check which auth provider is active
const USE_SUPABASE_AUTH = process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === 'true';

export default function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { role, isAdmin, isCarrier } = useUnifiedRole();
  const pathname = usePathname();
  const { user, isLoaded } = useUnifiedUser();
  const { preferences, updateAccentColor } = useUserPreferences();
  
  // Get Supabase client (always use Supabase now)
  const { supabase } = useSupabase();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  const unreadMessageCount = useUnreadMessageCount();
  
  // Smart color handling for white accent color
  const getIconColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#ffffff'; // White outline in light mode when white accent
    }
    return '#ffffff';
  };
  
  const getLogoBackgroundColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return accentColor;
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Show floating bubble landing for unauthenticated users
  if (!isLoaded || !user) {
    return (
      <>
        <header
          className={cn(
            "sticky top-0 z-50 w-full transition-all duration-200",
            isScrolled
              ? "bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm"
              : "bg-transparent"
          )}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo */}
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: getLogoBackgroundColor() }}>
                    <Truck className="h-5 w-5" style={{ color: getIconColor() }} />
                  </div>
                  <span className="text-xl font-bold text-foreground">NOVA</span>
                </Link>
              </div>

              {/* Right side actions */}
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                
                {isLoaded && (
                  <div className="flex items-center space-x-2">
                    {user ? (
                      <>
                        <ColorPalette 
                          currentColor={preferences.accentColor}
                          onColorChange={updateAccentColor}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {(user.email || user.firstName || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <div className="px-2 py-1.5 text-sm">
                              <div className="font-medium">{user.firstName || user.email}</div>
                              {user.email && (
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              )}
                            </div>
                            <DropdownMenuItem asChild>
                              <Link href="/profile">Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (supabase) {
                                  await supabase.auth.signOut();
                                  window.location.href = '/';
                                }
                              }}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Sign Out
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : (
                      <Button asChild variant="default" size="sm">
                        <Link href="/sign-in">Sign In</Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <FloatingBubbleLanding />
      </>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: getLogoBackgroundColor() }}>
                <Truck className="h-5 w-5" style={{ color: getIconColor() }} />
              </div>
              <span className="text-xl font-bold text-foreground">NOVA</span>
              {/* Role Badge */}
              {role !== "none" && (
                <Badge 
                  variant={isAdmin ? "default" : "secondary"}
                  className={cn(
                    "ml-2 text-xs",
                    isAdmin 
                      ? "bg-purple-500/20 text-purple-200 border-purple-500/30" 
                      : "bg-blue-500/20 text-blue-200 border-blue-500/30"
                  )}
                >
                  {role.toUpperCase()}
                </Badge>
              )}
            </Link>
          </div>

          {/* Role-based Navigation */}
          {(isAdmin || isCarrier) && (
            <RoleNavigation role={isAdmin ? "admin" : "carrier"} />
          )}

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <NotificationBell />

            {/* Messages for Carriers */}
            {isCarrier && (
              <Button variant="ghost" size="icon" asChild>
                <Link href="/carrier/messages">
                  <Mail className="h-5 w-5" />
                </Link>
              </Button>
            )}

            {/* Messages for Admins */}
            {isAdmin && (
              <Button variant="ghost" size="icon" asChild>
                <Link href="/admin/messages">
                  <Mail className="h-5 w-5" />
                </Link>
              </Button>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {user && (
              <div className="flex items-center space-x-2">
                <ColorPalette 
                  currentColor={preferences.accentColor}
                  onColorChange={updateAccentColor}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.email || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{role}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        if (supabase) {
                          await supabase.auth.signOut();
                          window.location.href = '/';
                        }
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: getLogoBackgroundColor() }}>
                      <Truck className="h-5 w-5" style={{ color: getIconColor() }} />
                    </div>
                    <span className="text-lg font-bold">NOVA</span>
                    {role !== "none" && (
                      <Badge 
                        variant={isAdmin ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          isAdmin 
                            ? "bg-purple-500/20 text-purple-200 border-purple-500/30" 
                            : "bg-blue-500/20 text-blue-200 border-blue-500/30"
                        )}
                      >
                        {role.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                
                {/* Role-based Mobile Navigation */}
                {(isAdmin || isCarrier) && (
                  <MobileRoleNavigation role={isAdmin ? "admin" : "carrier"} />
                )}
                
                <div className="mt-8 border-t border-border pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Accent Color</span>
                      <ColorPalette 
                        currentColor={preferences.accentColor}
                        onColorChange={updateAccentColor}
                      />
                    </div>
                    
                    {/* Messages for Mobile */}
                    {(isAdmin || isCarrier) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Messages</span>
                        <Button variant="ghost" size="sm" asChild className="relative">
                          <Link href={isAdmin ? "/admin/messages" : "/carrier/messages"}>
                            {unreadMessageCount > 0 ? (
                              <Mail className="h-4 w-4 mr-2" />
                            ) : (
                              <MailOpen className="h-4 w-4 mr-2" />
                            )}
                            Messages
                            {unreadMessageCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
                              >
                                {unreadMessageCount}
                              </Badge>
                            )}
                          </Link>
                        </Button>
                      </div>
                    )}
                    {user && (
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.email || 'User'}</p>
                          <p className="text-xs text-muted-foreground">{role}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (supabase) {
                              await supabase.auth.signOut();
                              window.location.href = '/';
                            }
                          }}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign Out
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
