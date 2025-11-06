"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { BarChart3, DollarSign, Package, TrendingUp, Truck } from "lucide-react";

interface BidAnalyticsProps {
  stats: {
    totalAwarded: number;
    activeBids: number;
    completedBids: number;
    totalRevenue: number;
    averageAmount: number;
  };
  bids: any[];
}

export function BidAnalytics({ stats, bids }: BidAnalyticsProps) {
  const { user } = useUnifiedUser();
  
  // Calculate additional metrics from real-time data
  const acceptanceRate = stats.totalAwarded > 0 ? (stats.completedBids / stats.totalAwarded) * 100 : 0;
  const averageRevenuePerBid = stats.totalAwarded > 0 ? stats.totalRevenue / stats.totalAwarded : 0;
  
  // Calculate average distance from ALL bids in the My Bids section
  // Use distance_miles field (which is the correct field from the API)
  // Filter out bids with invalid distance values (null, undefined, 0, or negative)
  const allBids = bids || [];
  const bidsWithDistance = allBids.filter(bid => {
    const distance = bid.distance_miles;
    return distance != null && distance !== undefined && distance > 0 && isFinite(distance);
  });
  
  // Calculate sum and average
  const totalDistance = bidsWithDistance.reduce((sum, bid) => {
    const distance = Number(bid.distance_miles);
    return sum + (isFinite(distance) ? distance : 0);
  }, 0);
  
  const averageDistancePerBid = bidsWithDistance.length > 0
    ? totalDistance / bidsWithDistance.length
    : 0;

  // Calculate monthly trends from real-time data
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Group bids by month for trend analysis
  const monthlyBids = bids.reduce((acc, bid) => {
    const bidDate = new Date(bid.awarded_at);
    const monthKey = `${bidDate.getFullYear()}-${bidDate.getMonth()}`;
    if (!acc[monthKey]) {
      acc[monthKey] = { awarded: 0, completed: 0, revenue: 0 };
    }
    acc[monthKey].awarded++;
    if (bid.status === 'completed') {
      acc[monthKey].completed++;
      acc[monthKey].revenue += bid.winner_amount_cents || 0;
    }
    return acc;
  }, {});

  // Generate last 6 months of data
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthData = monthlyBids[monthKey] || { awarded: 0, completed: 0, revenue: 0 };
    
    monthlyData.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      awarded: monthData.awarded,
      completed: monthData.completed,
      revenue: monthData.revenue
    });
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acceptanceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Completion rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(averageRevenuePerBid)}</div>
            <p className="text-xs text-muted-foreground">
              Per bid
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Distance</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageDistancePerBid.toFixed(0)} mi</div>
            <p className="text-xs text-muted-foreground">
              Per bid
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bids</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBids}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyData.map((month, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="font-medium">{month.month}</div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">{month.awarded}</div>
                    <div className="text-muted-foreground">Awarded</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{month.completed}</div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{formatMoney(month.revenue)}</div>
                    <div className="text-muted-foreground">Revenue</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Bid Performance</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Bids Awarded:</span>
                  <span className="font-medium">{stats.totalAwarded}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-medium">{acceptanceRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Bid Amount:</span>
                  <span className="font-medium">{formatMoney(stats.averageAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-medium">{formatMoney(stats.totalRevenue)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Current Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Active Bids:</span>
                  <span className="font-medium">{stats.activeBids}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed Bids:</span>
                  <span className="font-medium">{stats.completedBids}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Distance:</span>
                  <span className="font-medium">{averageDistancePerBid.toFixed(0)} miles</span>
                </div>
                <div className="flex justify-between">
                  <span>Revenue per Bid:</span>
                  <span className="font-medium">{formatMoney(averageRevenuePerBid)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
