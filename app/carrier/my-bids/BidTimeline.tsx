"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Package,
  Paperclip,
  Truck,
  User
} from "lucide-react";
import { useState } from "react";

interface DriverInfo {
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  truck_number?: string;
  trailer_number?: string;
  second_driver_name?: string;
  second_driver_phone?: string;
  second_driver_email?: string;
  second_driver_license_number?: string;
  second_driver_license_state?: string;
  second_truck_number?: string;
  second_trailer_number?: string;
}

interface LifecycleEvent {
  id: string;
  bid_id: string;
  event_type: string;
  event_data?: any;
  timestamp: string;
  notes?: string;
  documents?: string[];
  location?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
  driver_license_number?: string;
  driver_license_state?: string;
  truck_number?: string;
  trailer_number?: string;
  second_driver_name?: string;
  second_driver_phone?: string;
  second_driver_email?: string;
  second_driver_license_number?: string;
  second_driver_license_state?: string;
  second_truck_number?: string;
  second_trailer_number?: string;
  check_in_time?: string;
  pickup_time?: string;
  departure_time?: string;
  check_in_delivery_time?: string;
  delivery_time?: string;
}

interface BidTimelineProps {
  events: LifecycleEvent[];
  currentStatus: string;
  bidId: string;
}

export function BidTimeline({ events, currentStatus, bidId }: BidTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    if (!status) return Clock;
    
    const iconMap: Record<string, any> = {
      bid_awarded: CheckCircle,
      load_assigned: Truck,
      driver_info_update: User,
      checked_in_origin: User,
      picked_up: MapPin,
      departed_origin: Navigation,
      in_transit: Truck,
      checked_in_destination: User,
      delivered: Package,
      completed: CheckCircle
    };
    return iconMap[status] || Clock;
  };

  const getStatusColor = (status: string) => {
    if (!status) return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    
    const colorMap: Record<string, string> = {
      bid_awarded: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      load_assigned: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      driver_info_update: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      checked_in_origin: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      picked_up: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      departed_origin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      in_transit: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      checked_in_destination: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      delivered: "bg-green-500/20 text-green-300 border-green-500/30",
      completed: "bg-gray-500/20 text-gray-300 border-gray-500/30"
    };
    return colorMap[status] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'Unknown Status';
    
    const labelMap: Record<string, string> = {
      bid_awarded: "Bid Awarded",
      load_assigned: "Load Assigned",
      driver_info_update: "Driver Info Updated",
      checked_in_origin: "Checked In - Origin",
      picked_up: "Picked Up",
      departed_origin: "Departed - Origin",
      in_transit: "In Transit",
      checked_in_destination: "Checked In - Destination",
      delivered: "Delivered",
      completed: "Completed"
    };
    return labelMap[status] || status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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

  const getStatusSpecificDateTime = (event: LifecycleEvent) => {
    switch (event.event_type) {
      case 'checked_in_origin':
        return event.check_in_time;
      case 'picked_up':
        return event.pickup_time;
      case 'departed_origin':
        return event.departure_time;
      case 'checked_in_destination':
        return event.check_in_delivery_time;
      case 'delivered':
        return event.delivery_time;
      default:
        return null;
    }
  };

  const getStatusSpecificDateTimeLabel = (eventType: string) => {
    switch (eventType) {
      case 'checked_in_origin':
        return 'Check-in Time';
      case 'picked_up':
        return 'Pickup Time';
      case 'departed_origin':
        return 'Departure Time';
      case 'checked_in_destination':
        return 'Check-in Time (Destination)';
      case 'delivered':
        return 'Delivery Time';
      default:
        return null;
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No timeline events yet</p>
        <p className="text-sm">Events will appear here as you update the bid status</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Timeline Events</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
        >
          {isTimelineExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </div>

      {isTimelineExpanded && (
        <div className="space-y-3">
          {events.map((event, index) => {
            const isExpanded = expandedEvents.has(event.id);
            const Icon = getStatusIcon(event.event_type);
            const isLast = index === events.length - 1;
            
            return (
              <div key={event.id} className="relative">
                {/* Timeline Line */}
                {!isLast && (
                  <div className="absolute left-4 top-8 w-0.5 h-8 bg-border" />
                )}
                
                <Card className="ml-8">
                  <CardHeader 
                    className="pb-3 cursor-pointer"
                    onClick={() => toggleEventExpansion(event.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(event.event_type)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{getStatusLabel(event.event_type)}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getStatusColor(event.event_type)}>
                          {getStatusLabel(event.event_type)}
                        </Badge>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      
                      <div className="space-y-4">
                        {/* Event Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Event Created:</span>
                            <p className="font-medium">{formatDateTime(event.timestamp)}</p>
                          </div>
                          {event.location && (
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <p className="font-medium">{event.location}</p>
                            </div>
                          )}
                        </div>

                        {/* Status-Specific Date/Time */}
                        {getStatusSpecificDateTime(event) && (
                          <div>
                            <span className="text-muted-foreground text-sm">{getStatusSpecificDateTimeLabel(event.event_type)}:</span>
                            <p className="text-sm mt-1 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg font-medium">
                              {formatDateTime(getStatusSpecificDateTime(event)!)}
                            </p>
                          </div>
                        )}

                        {/* Event Data - Hidden from carrier view for cleaner interface */}

                        {/* Notes */}
                        {event.notes && (
                          <div>
                            <span className="text-muted-foreground text-sm">Notes:</span>
                            <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{event.notes}</p>
                          </div>
                        )}

                        {/* Driver Information */}
                        {(event.driver_name || event.driver_phone || event.driver_email || event.driver_license_number || event.driver_license_state || event.truck_number || event.trailer_number || event.second_driver_name || event.second_driver_phone || event.second_driver_email || event.second_driver_license_number || event.second_driver_license_state || event.second_truck_number || event.second_trailer_number) && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">Driver Information</span>
                            </div>
                            
                            {/* Primary Driver */}
                            {(event.driver_name || event.driver_phone || event.driver_email || event.driver_license_number || event.driver_license_state || event.truck_number || event.trailer_number) && (
                              <div className="mb-4">
                                <h5 className="text-sm font-medium mb-2 text-muted-foreground">Primary Driver</h5>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {event.driver_name && (
                                    <div>
                                      <span className="text-muted-foreground">Driver:</span>
                                      <p className="font-medium">{event.driver_name}</p>
                                    </div>
                                  )}
                                  {event.driver_phone && (
                                    <div>
                                      <span className="text-muted-foreground">Phone:</span>
                                      <p className="font-medium">{event.driver_phone}</p>
                                    </div>
                                  )}
                                  {event.driver_email && (
                                    <div>
                                      <span className="text-muted-foreground">Email:</span>
                                      <p className="font-medium">{event.driver_email}</p>
                                    </div>
                                  )}
                                  {event.driver_license_number && (
                                    <div>
                                      <span className="text-muted-foreground">License #:</span>
                                      <p className="font-medium">{event.driver_license_number}</p>
                                    </div>
                                  )}
                                  {event.driver_license_state && (
                                    <div>
                                      <span className="text-muted-foreground">License State:</span>
                                      <p className="font-medium">{event.driver_license_state}</p>
                                    </div>
                                  )}
                                  {event.truck_number && (
                                    <div>
                                      <span className="text-muted-foreground">Truck:</span>
                                      <p className="font-medium">{event.truck_number}</p>
                                    </div>
                                  )}
                                  {event.trailer_number && (
                                    <div>
                                      <span className="text-muted-foreground">Trailer:</span>
                                      <p className="font-medium">{event.trailer_number}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Secondary Driver */}
                            {(event.second_driver_name || event.second_driver_phone || event.second_driver_email || event.second_driver_license_number || event.second_driver_license_state || event.second_truck_number || event.second_trailer_number) && (
                              <div>
                                <h5 className="text-sm font-medium mb-2 text-muted-foreground">Secondary Driver</h5>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {event.second_driver_name && (
                                    <div>
                                      <span className="text-muted-foreground">Driver:</span>
                                      <p className="font-medium">{event.second_driver_name}</p>
                                    </div>
                                  )}
                                  {event.second_driver_phone && (
                                    <div>
                                      <span className="text-muted-foreground">Phone:</span>
                                      <p className="font-medium">{event.second_driver_phone}</p>
                                    </div>
                                  )}
                                  {event.second_driver_email && (
                                    <div>
                                      <span className="text-muted-foreground">Email:</span>
                                      <p className="font-medium">{event.second_driver_email}</p>
                                    </div>
                                  )}
                                  {event.second_driver_license_number && (
                                    <div>
                                      <span className="text-muted-foreground">License #:</span>
                                      <p className="font-medium">{event.second_driver_license_number}</p>
                                    </div>
                                  )}
                                  {event.second_driver_license_state && (
                                    <div>
                                      <span className="text-muted-foreground">License State:</span>
                                      <p className="font-medium">{event.second_driver_license_state}</p>
                                    </div>
                                  )}
                                  {event.second_truck_number && (
                                    <div>
                                      <span className="text-muted-foreground">Truck:</span>
                                      <p className="font-medium">{event.second_truck_number}</p>
                                    </div>
                                  )}
                                  {event.second_trailer_number && (
                                    <div>
                                      <span className="text-muted-foreground">Trailer:</span>
                                      <p className="font-medium">{event.second_trailer_number}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Documents */}
                        {event.documents && event.documents.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Paperclip className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">Documents</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {event.documents.map((doc: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-sm">Document {idx + 1}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
