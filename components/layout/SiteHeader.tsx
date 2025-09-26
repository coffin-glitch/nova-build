"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu, X, Bell, Truck, Search, Gavel, BookOpen, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/", icon: Truck },
  { name: "Find Loads", href: "/find-loads", icon: Search },
  { name: "Live Auctions", href: "/bid-board", icon: Gavel },
  { name: "Booked Loads", href: "/booked-loads", icon: BookOpen },
  { name: "Pricing", href: "/pricing", icon: DollarSign },
];

export default function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Truck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">NOVA Build</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-white/60 dark:bg-surface-800/80 dark:border-surface-600/30 backdrop-blur-sm border border-white/20 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-surface-800/60 dark:hover:border-surface-600/20 hover:backdrop-blur-sm hover:border hover:border-white/10"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
              >
                3
              </Badge>
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {isLoaded && (
              <div className="flex items-center space-x-2">
                {user ? (
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
                ) : (
                  <Button asChild variant="default" size="sm">
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                )}
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
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                      <Truck className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold">NOVA Build</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <nav className="mt-6 space-y-2">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-white/60 dark:bg-surface-800/80 dark:border-surface-600/30 backdrop-blur-sm border border-white/20 text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-surface-800/60 dark:hover:border-surface-600/20 hover:backdrop-blur-sm hover:border hover:border-white/10"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-8 border-t border-border pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                    {user ? (
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
                    ) : (
                      <Button asChild variant="default" className="w-full">
                        <Link href="/sign-in">Sign In</Link>
                      </Button>
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
