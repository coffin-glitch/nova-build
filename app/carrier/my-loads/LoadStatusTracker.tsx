"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@clerk/nextjs";
import {
    CheckCircle,
    Clock,
    MapPin,
    Play,
    RefreshCw,
    Truck
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LoadStatusTrackerProps {
  loadId: string;
  currentStatus: string;
  onStatusUpdate?: (newStatus: string) => void;
}

export function LoadStatusTracker({ loadId, currentStatus, onStatusUpdate }: LoadStatusTrackerProps) {
  const { user } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch real-time status updates
  const { data: statusData, mutate } = useSWR(
    user ? `/api/carrier/load-status/${loadId}` : null,
    fetcher,
    { refreshInterval: 10000 } // Update every 10 seconds
  );

  const status = statusData?.status || currentStatus;
  const lastUpdated = statusData?.lastUpdated;

  const statusConfig = {
    pending: {
      label: "Pending Review",
      icon: Clock,
      color: "bg-yellow-500/20 text-yellow-300 border-yellow-400",
      progress: 10,
      nextAction: "Waiting for admin review"
    },
    accepted: {
      label: "Offer Accepted",
      icon: CheckCircle,
      color: "bg-green-500/20 text-green-300 border-green-400",
      progress: 25,
      nextAction: "Load assigned to you"
    },
    assigned: {
      label: "Load Assigned",
      icon: Truck,
      color: "bg-blue-500/20 text-blue-300 border-blue-400",
      progress: 40,
      nextAction: "Ready to start"
    },
    picked_up: {
      label: "Picked Up",
      icon: MapPin,
      color: "bg-orange-500/20 text-orange-300 border-orange-400",
      progress: 60,
      nextAction: "In transit"
    },
    in_transit: {
      label: "In Transit",
      icon: Truck,
      color: "bg-purple-500/20 text-purple-300 border-purple-400",
      progress: 80,
      nextAction: "Approaching destination"
    },
    delivered: {
      label: "Delivered",
      icon: CheckCircle,
      color: "bg-green-500/20 text-green-300 border-green-400",
      progress: 95,
      nextAction: "Awaiting confirmation"
    },
    completed: {
      label: "Completed",
      icon: CheckCircle,
      color: "bg-gray-500/20 text-gray-300 border-gray-400",
      progress: 100,
      nextAction: "Load completed"
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  const updateStatus = async (newStatus: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/carrier/load-status/${loadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        mutate(); // Refresh the data
        onStatusUpdate?.(newStatus);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = {
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
      delivered: 'completed'
    };
    return statusFlow[currentStatus as keyof typeof statusFlow];
  };

  const canUpdateStatus = ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(status);
  const nextStatus = getNextStatus(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          Load Status Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {config.nextAction}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isUpdating}
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{config.progress}%</span>
          </div>
          <Progress value={config.progress} className="h-2" />
        </div>

        {/* Status Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Status Timeline</h4>
          <div className="space-y-1">
            {Object.entries(statusConfig).map(([key, config]) => {
              const isActive = key === status;
              const isCompleted = ['pending', 'accepted', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed']
                .slice(0, Object.keys(statusConfig).indexOf(status) + 1)
                .includes(key);
              
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-300'
                  }`} />
                  <span className={isActive ? 'font-medium' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}>
                    {config.label}
                  </span>
                  {isActive && <span className="text-xs text-blue-500">(Current)</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        {canUpdateStatus && nextStatus && (
          <div className="pt-4 border-t">
            <Button
              onClick={() => updateStatus(nextStatus)}
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isUpdating ? 'Updating...' : `Mark as ${statusConfig[nextStatus as keyof typeof statusConfig]?.label}`}
            </Button>
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
