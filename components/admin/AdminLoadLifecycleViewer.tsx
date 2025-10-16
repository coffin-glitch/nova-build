"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle,
    Clock,
    MapPin,
    Navigation,
    Truck,
    User
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LifecycleEvent {
  id: string;
  status: string;
  timestamp: string;
  notes?: string;
  location?: string;
  photos?: string[];
  documents?: string[];
  check_in_time?: string;
  pickup_time?: string;
  departure_time?: string;
  delivery_time?: string;
  driver_name?: string;
  truck_number?: string;
  trailer_number?: string;
}

interface AdminLoadLifecycleViewerProps {
  offerId: string;
  loadData: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AdminLoadLifecycleViewer({ offerId, loadData, isOpen, onClose }: AdminLoadLifecycleViewerProps) {
  const [selectedTab, setSelectedTab] = useState("timeline");

  // Fetch lifecycle events
  const { data: eventsData, mutate } = useSWR(
    offerId ? `/api/admin/load-lifecycle/${offerId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const events: LifecycleEvent[] = eventsData?.events || [];
  const currentStatus = eventsData?.currentStatus || 'pending';

  const statusFlow = [
    { key: 'pending', label: 'Pending Review', icon: Clock, color: 'bg-yellow-500/20 text-yellow-300' },
    { key: 'accepted', label: 'Offer Accepted', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'assigned', label: 'Load Assigned', icon: Truck, color: 'bg-blue-500/20 text-blue-300' },
    { key: 'checked_in', label: 'Checked In', icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'picked_up', label: 'Picked Up', icon: MapPin, color: 'bg-orange-500/20 text-orange-300' },
    { key: 'departed', label: 'Departed', icon: Navigation, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'in_transit', label: 'In Transit', icon: Truck, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-gray-500/20 text-gray-300' }
  ];

  const currentStatusIndex = statusFlow.findIndex(s => s.key === currentStatus);
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Not set';
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    const statusInfo = statusFlow.find(s => s.key === status);
    return statusInfo?.icon || Clock;
  };

  const getStatusColor = (status: string) => {
    const statusInfo = statusFlow.find(s => s.key === status);
    return statusInfo?.color || 'bg-gray-200';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Load Lifecycle Tracking - {loadData?.rr_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="details">Load Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Current Status: {statusFlow.find(s => s.key === currentStatus)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Flow */}
                  <div className="flex justify-between items-center">
                    {statusFlow.map((status, index) => {
                      const isActive = index <= currentStatusIndex;
                      const isCurrent = status.key === currentStatus;
                      const Icon = status.icon;
                      
                      return (
                        <div key={status.key} className="flex flex-col items-center space-y-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isActive ? status.color : 'bg-gray-200 text-gray-400'
                          } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-xs text-center ${
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Events</p>
                      <p className="text-lg font-semibold">{events.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Last Location</p>
                      <p className="text-sm font-medium">
                        {events.find(e => e.location)?.location || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Driver</p>
                      <p className="text-sm font-medium">
                        {events.find(e => e.driver_name)?.driver_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Truck #</p>
                      <p className="text-sm font-medium">
                        {events.find(e => e.truck_number)?.truck_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Timeline Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No timeline events yet</p>
                    </div>
                  ) : (
                    events.map((event, index) => {
                      const Icon = getStatusIcon(event.status);
                      const colorClass = getStatusColor(event.status);
                      
                      return (
                        <div key={event.id} className="flex gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{statusFlow.find(s => s.key === event.status)?.label}</h4>
                              <span className="text-sm text-muted-foreground">
                                {formatDateTime(event.timestamp)}
                              </span>
                            </div>
                            {event.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                            )}
                            {event.location && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                {event.location}
                              </p>
                            )}
                            {event.check_in_time && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <Clock className="w-3 h-3 inline mr-1" />
                                Check-in: {formatTime(event.check_in_time)}
                              </p>
                            )}
                            {event.pickup_time && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                Pickup: {formatTime(event.pickup_time)}
                              </p>
                            )}
                            {event.departure_time && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <Navigation className="w-3 h-3 inline mr-1" />
                                Departure: {formatTime(event.departure_time)}
                              </p>
                            )}
                            {event.delivery_time && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                Delivery: {formatTime(event.delivery_time)}
                              </p>
                            )}
                            {event.driver_name && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <User className="w-3 h-3 inline mr-1" />
                                Driver: {event.driver_name}
                              </p>
                            )}
                            {event.truck_number && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <Truck className="w-3 h-3 inline mr-1" />
                                Truck: {event.truck_number}
                              </p>
                            )}
                            {event.trailer_number && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <Truck className="w-3 h-3 inline mr-1" />
                                Trailer: {event.trailer_number}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Load Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Route</p>
                    <p className="font-medium">
                      {loadData?.origin_city}, {loadData?.origin_state} → {loadData?.destination_city}, {loadData?.destination_state}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Equipment</p>
                    <p className="font-medium">{loadData?.equipment || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pickup Date</p>
                    <p className="font-medium">{loadData?.pickup_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delivery Date</p>
                    <p className="font-medium">{loadData?.delivery_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Customer</p>
                    <p className="font-medium">{loadData?.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Distance</p>
                    <p className="font-medium">{loadData?.total_miles ? `${loadData.total_miles} miles` : 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
