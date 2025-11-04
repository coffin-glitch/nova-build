"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, BookOpen, DollarSign, Gavel, Search, TrendingUp, Truck, User } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Suspense } from "react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Inner component that uses useSearchParams
function CarrierDashboardInner() {
  const searchParams = useSearchParams();
  const setupMode = searchParams.get('setup') === 'true';
  const status = searchParams.get('status');

  const { data: profileData, isLoading: profileLoading } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null }
    }
  );

  const profile = profileData?.data;

  // Show status banner for unapproved users
  const renderStatusBanner = () => {
    if (profileLoading) return null;
    
    if (!profile || profile.profile_status !== 'approved') {
      return (
        <Card className="border-l-4 border-l-red-500 dark:border-l-red-400 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 dark:text-red-400">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Access to website features are restricted until you setup your profile and it has been reviewed by an admin.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your profile to gain access to all features and start bidding on loads.
                </p>
              </div>
              <Button asChild>
                <Link href="/carrier/profile">
                  <User className="h-4 w-4 mr-2" />
                  Complete Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Status Banner */}
        {renderStatusBanner()}
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Carrier Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back! Manage your loads and bids efficiently.
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border-blue-500/30">
            CARRIER
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                +2 from last week
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bids</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">
                +1 from yesterday
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,230</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94%</div>
              <p className="text-xs text-muted-foreground">
                +3% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className={`hover:shadow-lg transition-shadow ${(!profile || profile.profile_status !== 'approved') ? 'opacity-50' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-blue-500" />
                <span>Find Loads</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Browse available loads and find the perfect match for your equipment.
              </p>
              {(!profile || profile.profile_status !== 'approved') ? (
                <Button disabled className="w-full">
                  Complete Profile First
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/find-loads">Browse Loads</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={`hover:shadow-lg transition-shadow ${(!profile || profile.profile_status !== 'approved') ? 'opacity-50' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gavel className="h-5 w-5 text-purple-500" />
                <span>Live Auctions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Participate in real-time bidding for premium freight opportunities.
              </p>
              {(!profile || profile.profile_status !== 'approved') ? (
                <Button disabled className="w-full">
                  Complete Profile First
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/bid-board">View Auctions</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={`hover:shadow-lg transition-shadow ${(!profile || profile.profile_status !== 'approved') ? 'opacity-50' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-green-500" />
                <span>My Loads</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manage your booked loads and track delivery progress.
              </p>
              {(!profile || profile.profile_status !== 'approved') ? (
                <Button disabled className="w-full">
                  Complete Profile First
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/carrier/my-loads">Manage My Loads</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Load #12345 delivered successfully</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
                <Badge variant="secondary">Completed</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New bid placed on Load #12346</p>
                  <p className="text-xs text-muted-foreground">4 hours ago</p>
                </div>
                <Badge variant="outline">Pending</Badge>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Load #12347 pickup scheduled</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
                <Badge variant="outline">Scheduled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function CarrierDashboard() {
  return (
    <Suspense fallback={
      <div className="py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <CarrierDashboardInner />
    </Suspense>
  );
}
