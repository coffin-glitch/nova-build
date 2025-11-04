"use client";

import { Button } from "@/components/ui/button";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
    Compass,
    Gavel,
    Home,
    Menu,
    Moon,
    Package,
    Sun,
    Truck,
    X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationsMenu from "../NotificationsMenu";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ("admin" | "carrier" | "public")[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, roles: ["public"] },
  { href: "/find-loads", label: "Find Loads", icon: Compass, roles: ["public"] },
  { href: "/bid-board", label: "Bid Board", icon: Gavel, roles: ["public"] },
  { href: "/admin/manage-loads", label: "Manage Loads", icon: Package, roles: ["admin"] },
  { href: "/admin/auctions", label: "Auctions", icon: Gavel, roles: ["admin"] },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUnifiedUser();
  const { role } = useUnifiedRole();
  const { supabase } = useSupabase();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const isSignedIn = !!user;
  const userRole = role;

  const getVisibleNavItems = () => {
    if (!isSignedIn) {
      return navItems.filter(item => item.roles.includes("public"));
    }
    
    if (userRole === "admin") {
      return navItems.filter(item => 
        item.roles.includes("admin") || item.roles.includes("public")
      );
    }
    
    if (userRole === "carrier") {
      return navItems.filter(item => 
        item.roles.includes("carrier") || item.roles.includes("public")
      );
    }
    
    return navItems.filter(item => item.roles.includes("public"));
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    }
  };

  const visibleItems = getVisibleNavItems();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-surface-900/30 border-b border-border/40">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">NOVA</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-primary bg-primary/10 border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="mr-2 w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDark(!isDark)}
              className="h-9 w-9 p-0"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {isSignedIn ? (
              <>
                <NotificationsMenu />
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user?.firstName?.[0] || user?.email?.[0] || "U"}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 py-4">
            <nav className="flex flex-col space-y-2">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-primary bg-primary/10 border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="mr-2 w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
