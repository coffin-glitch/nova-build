"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistance, formatMoney } from "@/lib/format";
import { useUser } from "@clerk/nextjs";
import {
    Activity,
    BarChart3,
    Calendar,
    DollarSign,
    MapPin,
    PieChart,
    TrendingUp
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LoadAnalyticsProps {
  stats: any;
  offers: any[];
  bookedLoads: any[];
}

export function LoadAnalytics({ stats, offers, bookedLoads }: LoadAnalyticsProps) {
  const { user } = useUser();
  
  // Fetch additional analytics data - disabled for now to prevent 500 errors
  // const { data: analyticsData } = useSWR(
  //   user ? "/api/carrier/load-analytics" : null,
  //   fetcher,
  //   { refreshInterval: 60000 }
  // );

  // Use real-time data from props and API
  const realTimeStats = stats || {
    totalOffers: 0,
    pendingOffers: 0,
    acceptedOffers: 0,
    rejectedOffers: 0,
    totalBooked: 0,
    activeLoads: 0,
    completedLoads: 0,
    totalRevenue: 0,
    averageOfferAmount: 0
  };

  const realTimeOffers = offers || [];
  const realTimeBookedLoads = bookedLoads || [];

  // Calculate additional metrics from real-time data
  const acceptanceRate = realTimeStats.totalOffers > 0 ? (realTimeStats.acceptedOffers / realTimeStats.totalOffers) * 100 : 0;
  const averageRevenuePerLoad = realTimeStats.totalBooked > 0 ? realTimeStats.totalRevenue / realTimeStats.totalBooked : 0;
  const averageMilesPerLoad = realTimeBookedLoads.length > 0 
    ? realTimeBookedLoads.reduce((sum, load) => sum + (load.miles || 0), 0) / realTimeBookedLoads.length 
    : 0;

  // Calculate monthly trends from real-time data
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Group offers by month for trend analysis
  const monthlyOffers = realTimeOffers.reduce((acc, offer) => {
    const offerDate = new Date(offer.created_at);
    const monthKey = `${offerDate.getFullYear()}-${offerDate.getMonth()}`;
    if (!acc[monthKey]) {
      acc[monthKey] = { offers: 0, accepted: 0, revenue: 0 };
    }
    acc[monthKey].offers++;
    if (offer.status === 'accepted') {
      acc[monthKey].accepted++;
      acc[monthKey].revenue += offer.offer_amount || 0;
    }
    return acc;
  }, {});

  // Generate last 6 months of data
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthData = monthlyOffers[monthKey] || { offers: 0, accepted: 0, revenue: 0 };
    
    monthlyData.push({
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      offers: monthData.offers,
      accepted: monthData.accepted,
      revenue: monthData.revenue
    });
  }

  const currentMonthData = monthlyData[monthlyData.length - 1];
  const previousMonthData = monthlyData[monthlyData.length - 2];

  const offersGrowth = previousMonthData && previousMonthData.offers > 0 ? 
    ((currentMonthData.offers - previousMonthData.offers) / previousMonthData.offers) * 100 : 0;
  const revenueGrowth = previousMonthData && previousMonthData.revenue > 0 ? 
    ((currentMonthData.revenue - previousMonthData.revenue) / previousMonthData.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acceptance Rate</p>
                <p className="text-2xl font-bold">{acceptanceRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {realTimeStats.acceptedOffers} of {realTimeStats.totalOffers} offers
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Revenue/Load</p>
                <p className="text-2xl font-bold">{formatMoney(averageRevenuePerLoad)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                From {realTimeStats.totalBooked} completed loads
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Distance</p>
                <p className="text-2xl font-bold">{formatDistance(averageMilesPerLoad)}</p>
              </div>
              <MapPin className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Per booked load
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Growth</p>
                <p className={`text-2xl font-bold ${revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Revenue vs last month
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Monthly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.map((month, index) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{month.month}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{month.offers} offers</span>
                      <span className="text-green-600">{month.accepted} accepted</span>
                      <span className="font-medium">{formatMoney(month.revenue)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: month.offers > 0 ? `${(month.accepted / month.offers) * 100}%` : '0%' 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">Pending Offers</span>
                </div>
                <span className="font-medium">{realTimeStats.pendingOffers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Accepted Offers</span>
                </div>
                <span className="font-medium">{realTimeStats.acceptedOffers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Active Loads</span>
                </div>
                <span className="font-medium">{realTimeStats.activeLoads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-sm">Completed Loads</span>
                </div>
                <span className="font-medium">{realTimeStats.completedLoads}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Current Status</h4>
              <div className="space-y-2">
                {realTimeStats.totalOffers === 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-sm">No offers submitted yet</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">{realTimeStats.totalOffers} total offers submitted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">{acceptanceRate.toFixed(1)}% acceptance rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-sm">{realTimeStats.totalBooked} loads booked</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Next Steps</h4>
              <div className="space-y-2">
                {realTimeStats.totalOffers === 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Start by submitting offers on available loads</span>
                  </div>
                ) : realTimeStats.pendingOffers > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Wait for responses on pending offers</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Great! All offers have been processed</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Continue submitting competitive offers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm">Track performance and optimize strategy</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Real-Time Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-500">{realTimeOffers.length}</div>
              <div className="text-sm text-muted-foreground">Total Offers</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-500">{realTimeBookedLoads.length}</div>
              <div className="text-sm text-muted-foreground">Booked Loads</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-500">{formatMoney(realTimeStats.totalRevenue)}</div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
