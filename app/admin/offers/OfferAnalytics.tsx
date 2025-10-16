"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Target,
    TrendingUp,
    Truck,
    Users,
    XCircle
} from "lucide-react";
import { useEffect, useState } from "react";

interface AnalyticsData {
  basicStats: {
    total_offers: number;
    pending_offers: number;
    accepted_offers: number;
    rejected_offers: number;
    countered_offers: number;
    expired_offers: number;
    avg_offer_amount: number;
    min_offer_amount: number;
    max_offer_amount: number;
    total_offer_value: number;
  };
  acceptanceRate: number;
  monthlyStats: Array<{
    month: string;
    total_offers: number;
    accepted_offers: number;
    rejected_offers: number;
    avg_offer_amount: number;
  }>;
  topCarriers: Array<{
    company_name: string;
    legal_name: string;
    offer_count: number;
    accepted_count: number;
    avg_offer_amount: number;
    total_offer_value: number;
  }>;
  equipmentStats: Array<{
    equipment: string;
    offer_count: number;
    accepted_count: number;
    avg_offer_amount: number;
  }>;
  recentActivity: Array<{
    date: string;
    offers_created: number;
    offers_accepted: number;
    offers_rejected: number;
  }>;
  responseTimeStats: {
    avg_response_hours: number;
    min_response_hours: number;
    max_response_hours: number;
  };
}

export default function OfferAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/offer-analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else {
      return `${Math.round(hours / 24)}d`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.basicStats.total_offers}</div>
            <p className="text-xs text-muted-foreground">
              All time offers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.acceptanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.basicStats.accepted_offers} accepted out of {analytics.basicStats.accepted_offers + analytics.basicStats.rejected_offers} processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Offer Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(analytics.basicStats.avg_offer_amount)}</div>
            <p className="text-xs text-muted-foreground">
              Range: {formatPrice(analytics.basicStats.min_offer_amount)} - {formatPrice(analytics.basicStats.max_offer_amount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(analytics.responseTimeStats.avg_response_hours)}</div>
            <p className="text-xs text-muted-foreground">
              Range: {formatHours(analytics.responseTimeStats.min_response_hours)} - {formatHours(analytics.responseTimeStats.max_response_hours)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Offer Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Accepted</span>
              </div>
              <Badge variant="secondary">{analytics.basicStats.accepted_offers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Rejected</span>
              </div>
              <Badge variant="secondary">{analytics.basicStats.rejected_offers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Countered</span>
              </div>
              <Badge variant="secondary">{analytics.basicStats.countered_offers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Pending</span>
              </div>
              <Badge variant="secondary">{analytics.basicStats.pending_offers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Expired</span>
              </div>
              <Badge variant="secondary">{analytics.basicStats.expired_offers}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Equipment Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.equipmentStats.map((equipment, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{equipment.equipment || 'Unknown'}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{equipment.offer_count} offers</div>
                  <div className="text-xs text-muted-foreground">
                    {equipment.accepted_count} accepted ({equipment.offer_count > 0 ? Math.round((equipment.accepted_count / equipment.offer_count) * 100) : 0}%)
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Carriers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Carriers by Offer Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.topCarriers.map((carrier, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium">{carrier.company_name || carrier.legal_name || 'Unknown Carrier'}</div>
                    <div className="text-sm text-muted-foreground">
                      {carrier.offer_count} offers • {carrier.accepted_count} accepted
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatPrice(carrier.avg_offer_amount)}</div>
                  <div className="text-sm text-muted-foreground">avg offer</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Activity (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{formatDate(activity.date)}</div>
                    <div className="text-sm text-muted-foreground">
                      {activity.offers_created} offers created
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-green-600">{activity.offers_accepted}</div>
                    <div className="text-xs text-muted-foreground">accepted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-red-600">{activity.offers_rejected}</div>
                    <div className="text-xs text-muted-foreground">rejected</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
