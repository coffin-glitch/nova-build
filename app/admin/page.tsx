import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminStats } from "@/lib/actions";
import { requireAdmin } from "@/lib/clerk-server";
import {
    FileText,
    TrendingUp,
    Truck,
    Upload,
    Users
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  await requireAdmin();
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold color: hsl(var(--foreground))">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor system performance and manage operations.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="card-premium p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Published Loads</p>
              <p className="text-2xl font-bold color: hsl(var(--foreground))">{stats.publishedLoads}</p>
            </div>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
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
              <p className="text-2xl font-bold color: hsl(var(--foreground))">{stats.todayBids}</p>
            </div>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
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
              <p className="text-2xl font-bold color: hsl(var(--foreground))">{stats.activeCarriers}</p>
            </div>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-foreground" />
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
        <h2 className="text-2xl font-bold color: hsl(var(--foreground))">Quick Actions</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Manage Loads</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Publish, unpublish, and edit load details and rates.
              </p>
              <Button asChild className="w-full btn-primary">
                <Link href="/admin/loads">Manage Loads</Link>
              </Button>
            </div>
          </Card>

          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold color: hsl(var(--foreground))">Manage Bids</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                View Telegram bids and carrier offers in real-time.
              </p>
              <Button asChild className="w-full btn-primary">
                <Link href="/admin/bids">Manage Bids</Link>
              </Button>
            </div>
          </Card>

          <Card className="card-premium p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold color: hsl(var(--foreground))">EAX Updater</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Update load data from EAX system or upload Excel files.
              </p>
              <Button asChild className="w-full btn-primary">
                <Link href="/admin/eax-updater">EAX Updater</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
