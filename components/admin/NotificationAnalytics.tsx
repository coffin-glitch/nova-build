"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3, Bell, TrendingUp, Users, Target, AlertCircle } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NotificationAnalytics() {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useSWR(
    isOpen ? `/api/admin/notification-analytics?days=${days}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const analytics = data?.data;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
        variant="default"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        View Analytics
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Notification Trigger Analytics
            </DialogTitle>
            <DialogDescription>
              Performance metrics for notification triggers and matches
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Period:</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-3 py-1 rounded border bg-background"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading analytics...
              </div>
            )}

            {error && (
              <div className="text-center py-8 text-red-500">
                Error loading analytics: {error.message}
              </div>
            )}

            {analytics && (
              <>
                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Triggers</p>
                        <p className="text-2xl font-bold">{analytics.overall.total_triggers || 0}</p>
                      </div>
                      <Target className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {analytics.overall.active_triggers || 0} active
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Notifications Sent</p>
                        <p className="text-2xl font-bold">{analytics.overall.total_notifications_sent || 0}</p>
                      </div>
                      <Bell className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {analytics.overall.unique_bids_notified || 0} unique bids
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold">{analytics.overall.total_users_with_triggers || 0}</p>
                      </div>
                      <Users className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Users with triggers
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg per Trigger</p>
                        <p className="text-2xl font-bold">
                          {analytics.overall.avg_notifications_per_trigger 
                            ? Math.round(analytics.overall.avg_notifications_per_trigger * 100) / 100 
                            : 0}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Notifications per trigger
                    </p>
                  </Card>
                </div>

                {/* Type Breakdown */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Trigger Type Breakdown</h3>
                  <div className="space-y-2">
                    {analytics.typeBreakdown?.map((type: any) => (
                      <div key={type.trigger_type} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/20 rounded">
                            <Bell className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{type.trigger_type.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {type.trigger_count} trigger{type.trigger_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{type.notification_count || 0}</p>
                          <p className="text-xs text-muted-foreground">
                            {type.unique_bids || 0} unique bids
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Top Triggers */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Top Performing Triggers</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {analytics.topTriggers?.length > 0 ? (
                      analytics.topTriggers.map((trigger: any) => (
                        <div key={trigger.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant={trigger.is_active ? "default" : "secondary"}>
                                {trigger.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <span className="text-sm font-medium capitalize">
                                {trigger.trigger_type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {trigger.carrier_email || 'Unknown user'}
                            </p>
                            {trigger.last_notification && (
                              <p className="text-xs text-muted-foreground">
                                Last: {new Date(trigger.last_notification).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-lg">{trigger.notification_count || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {trigger.unique_bids || 0} bids
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No trigger data for this period</p>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

