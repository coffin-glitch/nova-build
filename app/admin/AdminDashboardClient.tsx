"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
  FileText,
  Store,
  TrendingUp,
  Truck,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface AdminDashboardClientProps {
  stats: {
    publishedLoads: number;
    totalLoads: number;
    todayBids: number;
    activeBids: number;
    activeCarriers: number;
    totalCarriers: number;
  };
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AdminDashboardClient({ stats }: AdminDashboardClientProps) {
  const { accentColor, accentColorStyle, accentBgStyle } = useAccentColor();
  const [isToggling, setIsToggling] = useState(false);
  
  const { data: shopStatusData, mutate: mutateShopStatus } = useSWR(
    '/api/admin/shop-status',
    fetcher,
    { refreshInterval: 5000 }
  );
  
  const shopStatus = shopStatusData?.status || 'open';
  const isShopOpen = shopStatus === 'open';
  
  const handleToggleShop = async () => {
    setIsToggling(true);
    try {
      const newStatus = isShopOpen ? 'closed' : 'open';
      const response = await fetch('/api/admin/shop-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        toast.success(`Shop is now ${newStatus === 'open' ? 'open' : 'closed'}`);
        mutateShopStatus();
      } else {
        toast.error(data.error || 'Failed to update shop status');
      }
    } catch (error) {
      console.error('Error toggling shop status:', error);
      toast.error('Failed to update shop status');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor system performance and manage operations.
        </p>
      </div>

      {/* Shop Status Toggle */}
      <Card className="card-premium p-6 border-2" style={{ 
        borderColor: isShopOpen ? `${accentColor}40` : '#ef444440',
        backgroundColor: isShopOpen ? `${accentColor}05` : '#ef444405'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300"
              style={isShopOpen ? accentBgStyle : { backgroundColor: '#ef4444', color: 'white' }}
            >
              <Store className="w-7 h-7" style={{ color: 'white' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Shop Status</h3>
              <p className="text-sm text-muted-foreground">
                {isShopOpen ? 'Shop is currently open' : 'Shop is currently closed'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggleShop}
            disabled={isToggling}
            size="lg"
            className="min-w-[140px] font-semibold transition-all duration-300"
            style={isShopOpen ? {
              backgroundColor: '#ef4444',
              color: 'white',
              borderColor: '#ef4444',
            } : accentBgStyle}
          >
            {isToggling ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Updating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {isShopOpen ? (
                  <>
                    <span>Close Shop</span>
                  </>
                ) : (
                  <>
                    <span>Open Shop</span>
                  </>
                )}
              </span>
            )}
          </Button>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="card-premium p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Published Loads</p>
              <p className="text-2xl font-bold text-foreground">{stats.publishedLoads}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={accentBgStyle}>
              <Truck className="w-6 h-6" style={{ color: 'white' }} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              {stats.totalLoads} total loads
            </p>
          </div>
        </Card>

        <Card className="card-premium p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today's Bids</p>
              <p className="text-2xl font-bold text-foreground">{stats.todayBids}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={accentBgStyle}>
              <TrendingUp className="w-6 h-6" style={{ color: 'white' }} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              {stats.activeBids} active bids
            </p>
          </div>
        </Card>

        <Card className="card-premium p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Carriers</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeCarriers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={accentBgStyle}>
              <Users className="w-6 h-6" style={{ color: 'white' }} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              {stats.totalCarriers} total carriers
            </p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5" style={accentColorStyle} />
                <h3 className="text-lg font-semibold text-foreground">Manage Loads</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Publish, unpublish, and edit load details and rates.
              </p>
              <Button asChild className="w-full" style={accentBgStyle}>
                <Link href="/admin/loads">Manage Loads</Link>
              </Button>
            </div>
          </Card>

          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" style={accentColorStyle} />
                <h3 className="text-lg font-semibold text-foreground">Manage Bids</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                View Telegram bids and carrier offers in real-time.
              </p>
              <Button asChild className="w-full" style={accentBgStyle}>
                <Link href="/admin/bids">Manage Bids</Link>
              </Button>
            </div>
          </Card>

          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5" style={accentColorStyle} />
                <h3 className="text-lg font-semibold text-foreground">Manage Carriers</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage carrier profiles, send messages, and lock/unlock accounts.
              </p>
              <Button asChild className="w-full" style={accentBgStyle}>
                <Link href="/admin/users">Manage Carriers</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

