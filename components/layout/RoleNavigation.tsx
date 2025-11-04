"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
    BarChart3,
    BookOpen,
    ChevronDown,
    FileText,
    Gavel,
    HandCoins,
    Package,
    Search,
    Settings,
    Trophy,
    Truck,
    Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavigation = [
  { name: "Dashboard", href: "/admin", icon: BarChart3 },
  { name: "Users", href: "/admin/users", icon: Users },
];

const adminDropdowns = {
  bids: {
    name: "Bids",
    icon: FileText,
    items: [
      { name: "Manage Bids", href: "/admin/bids", icon: FileText },
      { name: "Offers-Bids", href: "/admin/offers-bids", icon: Trophy },
    ]
  },
  loads: {
    name: "Loads", 
    icon: Package,
    items: [
      { name: "Manage Loads", href: "/admin/manage-loads", icon: Package },
      { name: "Manage Offers", href: "/admin/offers", icon: HandCoins },
    ]
  }
};

const carrierNavigation = [
  { name: "Dashboard", href: "/carrier", icon: Truck },
  { name: "Profile", href: "/carrier/profile", icon: Settings },
];

const carrierDropdowns = {
  loads: {
    name: "Loads",
    icon: Package,
    items: [
      { name: "Find Loads", href: "/find-loads", icon: Search },
      { name: "My Loads", href: "/carrier/my-loads", icon: BookOpen },
    ]
  },
  bids: {
    name: "Bids",
    icon: Gavel,
    items: [
      { name: "Live Auctions", href: "/bid-board", icon: Gavel },
      { name: "My Bids", href: "/carrier/my-bids", icon: Trophy },
    ]
  }
};

interface RoleNavigationProps {
  role: "admin" | "carrier";
}

export default function RoleNavigation({ role }: RoleNavigationProps) {
  const pathname = usePathname();
  const navigation = role === "admin" ? adminNavigation : carrierNavigation;

  return (
    <nav className="hidden md:flex md:items-center md:space-x-1">
      {role === "admin" ? (
        <>
          {/* Regular admin navigation items */}
          {navigation.map((item) => {
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
                    ? "bg-purple-500/20 dark:bg-purple-500/30 backdrop-blur-sm border border-purple-500/30 text-purple-200 shadow-sm"
                    : "text-muted-foreground hover:bg-purple-500/20 hover:text-purple-200 dark:hover:bg-purple-500/30 hover:backdrop-blur-sm hover:border hover:border-purple-500/20"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          
          {/* Bids Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname === "/admin/bids" || pathname === "/admin/offers-bids"
                    ? "bg-purple-500/20 dark:bg-purple-500/30 backdrop-blur-sm border border-purple-500/30 text-purple-200 shadow-sm"
                    : "text-muted-foreground hover:bg-purple-500/20 hover:text-purple-200 dark:hover:bg-purple-500/30 hover:backdrop-blur-sm hover:border hover:border-purple-500/20"
                )}
              >
                <FileText className="h-4 w-4" />
                <span>Bids</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {adminDropdowns.bids.items.map((item) => (
                <DropdownMenuItem asChild key={item.name}>
                  <Link 
                    href={item.href} 
                    className={cn(
                      "flex items-center space-x-2 w-full",
                      pathname === item.href && "bg-purple-500/10"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Loads Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname === "/admin/manage-loads" || pathname === "/admin/offers"
                    ? "bg-purple-500/20 dark:bg-purple-500/30 backdrop-blur-sm border border-purple-500/30 text-purple-200 shadow-sm"
                    : "text-muted-foreground hover:bg-purple-500/20 hover:text-purple-200 dark:hover:bg-purple-500/30 hover:backdrop-blur-sm hover:border hover:border-purple-500/20"
                )}
              >
                <Package className="h-4 w-4" />
                <span>Loads</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {adminDropdowns.loads.items.map((item) => (
                <DropdownMenuItem asChild key={item.name}>
                  <Link 
                    href={item.href} 
                    className={cn(
                      "flex items-center space-x-2 w-full",
                      pathname === item.href && "bg-purple-500/10"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          {/* Regular carrier navigation items */}
          {navigation.map((item) => {
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
                    ? "bg-blue-500/20 dark:bg-blue-500/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 shadow-sm"
                    : "text-muted-foreground hover:bg-blue-500/20 hover:text-blue-200 dark:hover:bg-blue-500/30 hover:backdrop-blur-sm hover:border hover:border-blue-500/20"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Loads Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname === "/find-loads" || pathname === "/carrier/my-loads"
                    ? "bg-blue-500/20 dark:bg-blue-500/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 shadow-sm"
                    : "text-muted-foreground hover:bg-blue-500/20 hover:text-blue-200 dark:hover:bg-blue-500/30 hover:backdrop-blur-sm hover:border hover:border-blue-500/20"
                )}
              >
                <Package className="h-4 w-4" />
                <span>Loads</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {carrierDropdowns.loads.items.map((item) => (
                <DropdownMenuItem asChild key={item.name}>
                  <Link 
                    href={item.href} 
                    className={cn(
                      "flex items-center space-x-2 w-full",
                      pathname === item.href && "bg-blue-500/10"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bids Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  pathname === "/bid-board" || pathname === "/carrier/my-bids"
                    ? "bg-blue-500/20 dark:bg-blue-500/30 backdrop-blur-sm border border-blue-500/30 text-blue-200 shadow-sm"
                    : "text-muted-foreground hover:bg-blue-500/20 hover:text-blue-200 dark:hover:bg-blue-500/30 hover:backdrop-blur-sm hover:border hover:border-blue-500/20"
                )}
              >
                <Gavel className="h-4 w-4" />
                <span>Bids</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {carrierDropdowns.bids.items.map((item) => (
                <DropdownMenuItem asChild key={item.name}>
                  <Link 
                    href={item.href} 
                    className={cn(
                      "flex items-center space-x-2 w-full",
                      pathname === item.href && "bg-blue-500/10"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
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
