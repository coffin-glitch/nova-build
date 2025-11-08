"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccentColor } from "@/hooks/useAccentColor";
import { formatMoney } from "@/lib/format";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  MapPin,
  Calendar,
  Users,
  Award,
  Activity,
  PieChart,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface MarginAnalyticsProps {
  accentColor?: string;
}

export function MarginProfitAnalytics({ accentColor }: MarginAnalyticsProps) {
  const { accentColor: themeAccentColor } = useAccentColor();
  const finalAccentColor = accentColor || themeAccentColor;
  
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (stateFilter) queryParams.set("stateTag", stateFilter);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/margin-analytics?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const analytics = data?.data || {};
  const overall = analytics.overall || {};

  // Calculate key metrics
  const totalMargin = (overall.total_margin_cents || 0) / 100;
  const avgMargin = (overall.avg_margin_cents || 0) / 100;
  const totalCarrierBid = (overall.total_carrier_bid_cents || 0) / 100;
  const totalSubmitted = (overall.total_submitted_cents || 0) / 100;
  const bidsWithMargin = overall.bids_with_margin || 0;
  const totalAwards = overall.total_awards || 0;
  const marginRate = totalCarrierBid > 0 ? (totalMargin / totalCarrierBid) * 100 : 0;
  const marginCoverage = totalAwards > 0 ? (bidsWithMargin / totalAwards) * 100 : 0;

  // Format currency helper
  const formatCurrency = (cents: number) => formatMoney(cents);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Glass className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>State Filter</Label>
            <Input
              placeholder="State tag (e.g., CA)"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setStateFilter("");
              }}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </Glass>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: finalAccentColor }}></div>
          <p className="mt-4 text-muted-foreground">Loading margin analytics...</p>
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-destructive">Failed to load analytics data</p>
        </Card>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/50 dark:to-green-900/50 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Profit Margin</p>
                    <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                      {formatCurrency(totalMargin * 100)}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      {bidsWithMargin} bids with margin
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                    <DollarSign className="h-6 w-6 text-emerald-800 dark:text-emerald-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-900/50 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Average Margin</p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                      {formatCurrency(avgMargin * 100)}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Per bid with margin
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800">
                    <TrendingUp className="h-6 w-6 text-blue-800 dark:text-blue-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/50 dark:to-violet-900/50 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Margin Rate</p>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                      {marginRate.toFixed(2)}%
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Of carrier bid amount
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800">
                    <Target className="h-6 w-6 text-purple-800 dark:text-purple-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/50 dark:to-amber-900/50 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Margin Coverage</p>
                    <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                      {marginCoverage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      {bidsWithMargin} of {totalAwards} bids
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-200 dark:bg-orange-800">
                    <Activity className="h-6 w-6 text-orange-800 dark:text-orange-200" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Margin Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics.distribution || []).map((item: any, index: number) => {
                    const margin = (item.total_margin_cents || 0) / 100;
                    const percentage = totalMargin > 0 ? (margin / totalMargin) * 100 : 0;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.margin_range}</span>
                          <span className="text-muted-foreground">
                            {item.count} bids • {formatCurrency(margin * 100)}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: finalAccentColor
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Margin by State
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(analytics.byState || []).slice(0, 10).map((state: any, index: number) => {
                    const margin = (state.total_margin_cents || 0) / 100;
                    const avgMargin = (state.avg_margin_cents || 0) / 100;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{state.state || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">
                              {state.bid_count} bids
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Avg: {formatCurrency(avgMargin * 100)} • Total: {formatCurrency(margin * 100)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: finalAccentColor }}>
                            {formatCurrency(margin * 100)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trends and Top Routes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Daily Margin Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(analytics.trends || []).map((trend: any, index: number) => {
                    const margin = (trend.total_margin_cents || 0) / 100;
                    const avgMargin = (trend.avg_margin_cents || 0) / 100;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-semibold">
                            {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {trend.bid_count} bids • {trend.bids_with_margin} with margin
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: finalAccentColor }}>
                            {formatCurrency(margin * 100)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(avgMargin * 100)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Top Routes by Margin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(analytics.topRoutes || []).map((route: any, index: number) => {
                    const margin = (route.margin_cents || 0) / 100;
                    const carrierBid = (route.carrier_bid_cents || 0) / 100;
                    const submitted = (route.submitted_cents || 0) / 100;
                    return (
                      <div key={index} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">#{route.bid_number}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-muted">{route.state}</span>
                          </div>
                          <div className="text-lg font-bold" style={{ color: finalAccentColor }}>
                            {formatCurrency(margin * 100)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Carrier: {formatCurrency(carrierBid * 100)} • Submitted: {formatCurrency(submitted * 100)}</div>
                          <div>{route.distance_miles} miles • {route.margin_percentage}% margin</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Efficiency and Admin Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Margin Efficiency (per mile)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics.efficiency || []).slice(0, 10).map((eff: any, index: number) => {
                    const marginPerMile = (eff.margin_per_mile_cents || 0) / 100;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <span className="font-semibold">{eff.state || 'Unknown'}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {eff.bid_count} bids • {eff.total_miles} miles
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: finalAccentColor }}>
                            {formatCurrency(marginPerMile * 100)}/mile
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: finalAccentColor }} />
                  Admin Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics.adminPerformance || []).map((admin: any, index: number) => {
                    const margin = (admin.total_margin_cents || 0) / 100;
                    const avgMargin = (admin.avg_margin_cents || 0) / 100;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-semibold">{admin.admin_name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">
                            {admin.bid_count} bids • {admin.bids_with_margin} with margin
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: finalAccentColor }}>
                            {formatCurrency(margin * 100)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(avgMargin * 100)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

