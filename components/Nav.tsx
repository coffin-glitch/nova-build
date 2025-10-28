"use client";

import { Button } from "@/components/ui/button";
import { getUserRoleAction } from "@/lib/actions";
import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import {
    Book,
    Compass,
    DollarSign,
    FileText,
    Gavel,
    HandCoins,
    Home,
    Package,
    Settings,
    Shield,
    Star,
    Trophy,
    Truck,
    Upload,
    User
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationsMenu from "./NotificationsMenu";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ("admin" | "carrier" | "public")[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, roles: ["public"] },
  { href: "/find-loads", label: "Find Loads", icon: Compass, roles: ["public"] },
  { href: "/bid-board", label: "Live Auctions", icon: Gavel, roles: ["public"] },
  { href: "/my-loads", label: "My Loads", icon: Book, roles: ["carrier"] },
  { href: "/my-bids", label: "My Bids", icon: Trophy, roles: ["carrier"] },
  { href: "/current-offers", label: "My Offers", icon: DollarSign, roles: ["carrier"] },
  { href: "/dedicated-lanes", label: "Dedicated", icon: Star, roles: ["carrier"] },
  { href: "/profile", label: "Profile", icon: Settings, roles: ["carrier"] },
  { href: "/admin", label: "Admin", icon: Shield, roles: ["admin"] },
  { href: "/admin/auctions", label: "Auction Console", icon: Gavel, roles: ["admin"] },
  { href: "/admin/manage-loads", label: "Manage Loads", icon: Package, roles: ["admin"] },
  { href: "/admin/bids", label: "Manage Bids", icon: FileText, roles: ["admin"] },
  { href: "/admin/offers", label: "Manage Offers", icon: HandCoins, roles: ["admin"] },
  { href: "/admin/offers-bids", label: "Manage Offers-Bids", icon: Trophy, roles: ["admin"] },
  { href: "/admin/eax", label: "EAX Updater", icon: Upload, roles: ["admin"] },
];

export default function Nav() {
  const pathname = usePathname();
  const { isSignedIn, user } = useUser();
  const [userRole, setUserRole] = useState<"admin" | "carrier" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      getUserRoleAction()
        .then(role => setUserRole(role))
        .catch(() => setUserRole("carrier"));
    }
  }, [isSignedIn, user]);

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

  const visibleItems = getVisibleNavItems();

  return (
    <nav className="bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Truck className="h-8 w-8 text-blue-400" />
              <span className="ml-2 text-xl font-bold text-white">NOVA Build</span>
            </div>
          </div>

          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-8">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/20 border border-white/30"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="mr-2 w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center">
            <div className="ml-3 relative">
              <div className="flex items-center space-x-4">
                {isSignedIn ? (
                  <>
                    <span className="text-sm font-medium text-slate-300">
                      Welcome, {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                    </span>
                    <NotificationsMenu />
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <SignOutButton>
                      <Button variant="outline" size="sm" className="border-white/20 text-slate-300 hover:bg-white/10">
                        Sign out
                      </Button>
                    </SignOutButton>
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <SignInButton mode="modal">
                      <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
                        Sign in
                      </Button>
                    </SignInButton>
                    <SignInButton mode="modal">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        Get Started
                      </Button>
                    </SignInButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}