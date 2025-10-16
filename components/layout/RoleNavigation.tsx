"use client";

import { cn } from "@/lib/utils";
import {
    BarChart3,
    BookOpen,
    FileText,
    Gavel,
    HandCoins,
    Package,
    Search,
    Settings,
    Truck,
    Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavigation = [
  { name: "Dashboard", href: "/admin", icon: BarChart3 },
  { name: "Bids", href: "/admin/bids", icon: FileText },
  { name: "Loads", href: "/admin/manage-loads", icon: Package },
  { name: "Offers", href: "/admin/offers", icon: HandCoins },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

const carrierNavigation = [
  { name: "Dashboard", href: "/carrier", icon: Truck },
  { name: "Find Loads", href: "/find-loads", icon: Search },
  { name: "Live Auctions", href: "/bid-board", icon: Gavel },
  { name: "My Loads", href: "/carrier/my-loads", icon: BookOpen },
  { name: "Bids", href: "/carrier/bids", icon: HandCoins },
  { name: "Profile", href: "/carrier/profile", icon: Settings },
];

interface RoleNavigationProps {
  role: "admin" | "carrier";
}

export default function RoleNavigation({ role }: RoleNavigationProps) {
  const pathname = usePathname();
  const navigation = role === "admin" ? adminNavigation : carrierNavigation;

  return (
    <nav className="hidden md:flex md:items-center md:space-x-1">
      {navigation.map((item) => {
        // Fix: Dashboard should only be active when exactly on /carrier or /admin, not sub-pages
        const isActive = item.name === "Dashboard" 
          ? pathname === item.href 
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? role === "admin"
                  ? "bg-purple-500/20 dark:bg-purple-500/30 backdrop-blur-sm border border-purple-500/30 text-purple-200 shadow-sm"
                  : "bg-blue-500/20 dark:bg-blue-500/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 shadow-sm"
                : role === "admin"
                  ? "text-muted-foreground hover:bg-purple-500/20 hover:text-purple-200 dark:hover:bg-purple-500/30 hover:backdrop-blur-sm hover:border hover:border-purple-500/20"
                  : "text-muted-foreground hover:bg-blue-500/20 hover:text-blue-200 dark:hover:bg-blue-500/30 hover:backdrop-blur-sm hover:border hover:border-blue-500/20"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileRoleNavigation({ role }: RoleNavigationProps) {
  const pathname = usePathname();
  const navigation = role === "admin" ? adminNavigation : carrierNavigation;

  return (
    <nav className="mt-6 space-y-2">
      {navigation.map((item) => {
        // Fix: Dashboard should only be active when exactly on /carrier or /admin, not sub-pages
        const isActive = item.name === "Dashboard" 
          ? pathname === item.href 
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
              isActive
                ? role === "admin"
                  ? "bg-purple-500/20 dark:bg-purple-500/30 backdrop-blur-sm border border-purple-500/30 text-purple-200 shadow-sm"
                  : "bg-blue-500/20 dark:bg-blue-500/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 shadow-sm"
                : role === "admin"
                  ? "text-muted-foreground hover:bg-purple-500/20 hover:text-purple-200 dark:hover:bg-purple-500/30 hover:backdrop-blur-sm hover:border hover:border-purple-500/20"
                  : "text-muted-foreground hover:bg-blue-500/20 hover:text-blue-200 dark:hover:bg-blue-500/30 hover:backdrop-blur-sm hover:border hover:border-blue-500/20"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
