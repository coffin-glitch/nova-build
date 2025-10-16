"use client";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPalette } from "@/components/ui/ColorPalette";
import FloatingBubbleLanding from "@/components/ui/FloatingBubbleLanding";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";
import { useClerkRole } from "@/lib/clerk-roles";
import { cn } from "@/lib/utils";
import { UserButton, useUser } from "@clerk/nextjs";
import { Mail, MailOpen, Menu, Truck, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import RoleNavigation, { MobileRoleNavigation } from "./RoleNavigation";

export default function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { role, isAdmin, isCarrier } = useClerkRole();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { preferences, updateAccentColor } = useUserPreferences();
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
                  <span className="text-xl font-bold text-foreground">NOVA Build</span>
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
                        <UserButton
                          afterSignOutUrl="/"
                          appearance={{
                            elements: {
                              avatarBox: "h-8 w-8",
                              userButtonPopoverCard: "shadow-card border-border",
                              userButtonPopoverActionButton: "hover:bg-accent",
                            },
                          }}
                        />
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
              <span className="text-xl font-bold text-foreground">NOVA Build</span>
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
            <div className="flex items-center space-x-2">
              <ColorPalette 
                currentColor={preferences.accentColor}
                onColorChange={updateAccentColor}
              />
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8",
                    userButtonPopoverCard: "shadow-card border-border",
                    userButtonPopoverActionButton: "hover:bg-accent",
                  },
                }}
              />
            </div>

            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: getLogoBackgroundColor() }}>
                      <Truck className="h-5 w-5" style={{ color: getIconColor() }} />
                    </div>
                    <span className="text-lg font-bold">NOVA Build</span>
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
                    <div className="flex items-center space-x-3">
                      <UserButton
                        afterSignOutUrl="/"
                        appearance={{
                          elements: {
                            avatarBox: "h-8 w-8",
                          },
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {user.firstName || user.emailAddresses[0]?.emailAddress}
                      </span>
                    </div>
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
