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
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  Ban,
  Globe,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SecurityMonitoring() {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, error } = useSWR(
    isOpen ? `/api/admin/security-dashboard` : null,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  const dashboardData = data?.data;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityBadgeVariant = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
        variant="default"
      >
        <Shield className="h-4 w-4 mr-2" />
        Security Dashboard
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Monitoring Dashboard
            </DialogTitle>
            <DialogDescription>
              Real-time security events, alerts, and rate limit monitoring
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading security data...
              </div>
            )}

            {error && (
              <div className="text-center py-8 text-red-500">
                Error loading security data: {error.message}
              </div>
            )}

            {dashboardData && (
              <>
                {/* Security Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Events</p>
                        <p className="text-2xl font-bold">{dashboardData.metrics?.totalEvents || 0}</p>
                      </div>
                      <Activity className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {dashboardData.metrics?.eventsLast24h || 0} in last 24h
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Alerts</p>
                        <p className="text-2xl font-bold text-orange-500">
                          {dashboardData.metrics?.totalAlerts || 0}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="destructive" className="text-xs">
                        {dashboardData.metrics?.criticalAlerts || 0} Critical
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {dashboardData.metrics?.highAlerts || 0} High
                      </Badge>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Rate Limit Violations</p>
                        <p className="text-2xl font-bold text-red-500">
                          {dashboardData.metrics?.rateLimitViolations || 0}
                        </p>
                      </div>
                      <Ban className="h-8 w-8 text-red-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {dashboardData.metrics?.rateLimitViolationsLast24h || 0} in last 24h
                    </p>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Suspicious IPs</p>
                        <p className="text-2xl font-bold text-yellow-500">
                          {dashboardData.metrics?.suspiciousIPs || 0}
                        </p>
                      </div>
                      <Globe className="h-8 w-8 text-yellow-500 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {dashboardData.metrics?.blockedIPs || 0} blocked
                    </p>
                  </Card>
                </div>

                {/* Rate Limit Statistics */}
                {dashboardData.rateLimitStats && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Rate Limit Violations
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Top Violating IPs */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3">Top Violating IPs</h4>
                        <div className="space-y-2">
                          {dashboardData.rateLimitStats.topViolatingIPs?.length > 0 ? (
                            dashboardData.rateLimitStats.topViolatingIPs.slice(0, 5).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <code className="text-xs bg-muted px-2 py-1 rounded">{item.ip}</code>
                                <Badge variant="destructive">{item.count}</Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No violations</p>
                          )}
                        </div>
                      </Card>

                      {/* Top Violating Routes */}
                      <Card className="p-4">
                        <h4 className="font-medium mb-3">Top Violating Routes</h4>
                        <div className="space-y-2">
                          {dashboardData.rateLimitStats.topViolatingRoutes?.length > 0 ? (
                            dashboardData.rateLimitStats.topViolatingRoutes.slice(0, 5).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                                  {item.path}
                                </code>
                                <Badge variant="secondary">{item.count}</Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No violations</p>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Active Alerts */}
                {dashboardData.activeAlerts && dashboardData.activeAlerts.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Active Security Alerts
                    </h3>
                    <div className="space-y-2">
                      {dashboardData.activeAlerts.slice(0, 10).map((alert: any) => (
                        <Card key={alert.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                                  {alert.severity}
                                </Badge>
                                <span className="text-sm font-medium">{alert.alertType}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity Timeline */}
                {dashboardData.activityTimeline && dashboardData.activityTimeline.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activity Timeline
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dashboardData.activityTimeline.slice(0, 20).map((event: any) => (
                        <Card key={event.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${getSeverityColor(event.severity)}`} />
                                <span className="text-sm font-medium">{event.eventType}</span>
                                <Badge variant={getSeverityBadgeVariant(event.severity)} className="text-xs">
                                  {event.severity}
                                </Badge>
                              </div>
                              {event.path && (
                                <code className="text-xs bg-muted px-2 py-0.5 rounded block mb-1">
                                  {event.path}
                                </code>
                              )}
                              {event.ip && (
                                <p className="text-xs text-muted-foreground">
                                  IP: {event.ip} {event.userId && `• User: ${event.userId.substring(0, 8)}...`}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {new Date(event.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suspicious IPs */}
                {dashboardData.suspiciousIPs && dashboardData.suspiciousIPs.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Suspicious IP Addresses
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dashboardData.suspiciousIPs.slice(0, 10).map((ipData: any, idx: number) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <code className="text-sm font-mono">{ipData.ip}</code>
                              <p className="text-xs text-muted-foreground mt-1">
                                {ipData.count} events
                              </p>
                            </div>
                            {ipData.blocked ? (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Monitored
                              </Badge>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event Type Distribution */}
                {dashboardData.eventTypeDistribution && dashboardData.eventTypeDistribution.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Event Type Distribution</h3>
                    <div className="space-y-2">
                      {dashboardData.eventTypeDistribution.slice(0, 10).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{item.type}</span>
                              <span className="text-sm text-muted-foreground">{item.count}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{
                                  width: `${(item.count / (dashboardData.metrics?.totalEvents || 1)) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

