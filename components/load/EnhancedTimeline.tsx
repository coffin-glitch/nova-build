"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import {
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    CreditCard,
    FileText,
    Image,
    Mail,
    MapPin,
    Navigation,
    Package,
    Paperclip,
    Phone,
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
  status: string;
  timestamp: string;
  check_in_time?: string;
  pickup_time?: string;
  departure_time?: string;
  check_in_delivery_time?: string;
  notes?: string;
  location?: string;
  photos?: string[];
  documents?: string[];
  event_type?: string;
  driver_info?: DriverInfo;
}

interface EnhancedTimelineProps {
  events: LifecycleEvent[];
  currentStatus: string;
  loadId: string;
}

export function EnhancedTimeline({ events, currentStatus, loadId }: EnhancedTimelineProps) {
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
    const iconMap: Record<string, any> = {
      pending: Clock,
      accepted: CheckCircle,
      assigned: Truck,
      checked_in: User,
      picked_up: MapPin,
      departed: Navigation,
      in_transit: Truck,
      checked_in_delivery: User,
      delivered: Package,
      completed: CheckCircle
    };
    return iconMap[status] || Clock;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      accepted: "bg-green-500/20 text-green-300 border-green-500/30",
      assigned: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      checked_in: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      picked_up: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      departed: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      in_transit: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      checked_in_delivery: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      delivered: "bg-green-500/20 text-green-300 border-green-500/30",
      completed: "bg-gray-500/20 text-gray-300 border-gray-500/30"
    };
    return colorMap[status] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      pending: "Pending Review",
      accepted: "Offer Accepted",
      assigned: "Load Assigned",
      checked_in: "Checked In",
      picked_up: "Picked Up",
      departed: "Departed",
      in_transit: "In Transit",
      checked_in_delivery: "Checked In - Delivery",
      delivered: "Delivered",
      completed: "Completed"
    };
    return labelMap[status] || status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getEventTypeLabel = (eventType?: string) => {
    const typeMap: Record<string, string> = {
      status_change: "Status Update",
      driver_info_update: "Driver Information",
      location_update: "Location Update",
      document_upload: "Document Upload",
      photo_upload: "Photo Upload"
    };
    return typeMap[eventType || 'status_change'] || "Event";
  };

  const formatDriverInfo = (driverInfo: DriverInfo, isSecondary = false) => {
    if (!driverInfo) return null;

    const prefix = isSecondary ? "Second Driver" : "Driver";
    const fields = [];

    if (driverInfo.driver_name) fields.push(`${prefix}: ${driverInfo.driver_name}`);
    if (driverInfo.driver_phone) fields.push(`Phone: ${driverInfo.driver_phone}`);
    if (driverInfo.driver_email) fields.push(`Email: ${driverInfo.driver_email}`);
    if (driverInfo.driver_license_number) fields.push(`License: ${driverInfo.driver_license_number}`);
    if (driverInfo.driver_license_state) fields.push(`State: ${driverInfo.driver_license_state}`);
    if (driverInfo.truck_number) fields.push(`Truck: ${driverInfo.truck_number}`);
    if (driverInfo.trailer_number) fields.push(`Trailer: ${driverInfo.trailer_number}`);

    return fields;
  };

  const DriverInfoDisplay = ({ driverInfo, title }: { driverInfo: DriverInfo; title: string }) => {
    if (!driverInfo) return null;

    const primaryFields = formatDriverInfo(driverInfo, false);
    const secondaryFields = formatDriverInfo(driverInfo, true);

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-gray-300 flex items-center gap-2">
          <User className="h-4 w-4" />
          {title}
        </h4>
        
        {primaryFields && primaryFields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {primaryFields.map((field, index) => (
              <div key={index} className="flex items-center gap-2 text-gray-400">
                {field.includes('Phone') && <Phone className="h-3 w-3" />}
                {field.includes('Email') && <Mail className="h-3 w-3" />}
                {field.includes('License') && <CreditCard className="h-3 w-3" />}
                {field.includes('Truck') && <Truck className="h-3 w-3" />}
                {field.includes('Trailer') && <Truck className="h-3 w-3" />}
                {field.includes('Driver:') && <User className="h-3 w-3" />}
                <span>{field}</span>
              </div>
            ))}
          </div>
        )}

        {secondaryFields && secondaryFields.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {secondaryFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2 text-gray-400">
                  {field.includes('Phone') && <Phone className="h-3 w-3" />}
                  {field.includes('Email') && <Mail className="h-3 w-3" />}
                  {field.includes('License') && <CreditCard className="h-3 w-3" />}
                  {field.includes('Truck') && <Truck className="h-3 w-3" />}
                  {field.includes('Trailer') && <Truck className="h-3 w-3" />}
                  {field.includes('Driver:') && <User className="h-3 w-3" />}
                  <span>{field}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Clock className="h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Timeline Events</h3>
          <p className="text-gray-500 text-center mb-4">
            Timeline events will appear here as the load progresses.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // This will be handled by the parent component
              console.log('Add driver information requested for load:', loadId);
            }}
          >
            <User className="h-4 w-4 mr-2" />
            Add Driver Information
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline Header with Expand/Collapse */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">Timeline Events</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          className="h-8 w-8 p-0"
        >
          {isTimelineExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Timeline Events */}
      {isTimelineExpanded && (
        <div className="space-y-4">
          {events.map((event, index) => {
        const Icon = getStatusIcon(event.status);
        const isExpanded = expandedEvents.has(event.id);
        const isDriverInfoUpdate = event.event_type === 'driver_info_update';

        return (
          <Card key={event.id} className="border-l-4 border-l-blue-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getStatusColor(event.status)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-200">
                        {getStatusLabel(event.status)}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {getEventTypeLabel(event.event_type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">
                      Submitted {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleEventExpansion(event.id)}
                >
                  {isExpanded ? "Show Less" : "Show Details"}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Driver Information */}
                  {isDriverInfoUpdate && event.driver_info && (
                    <DriverInfoDisplay 
                      driverInfo={event.driver_info} 
                      title="Driver Information Updated"
                    />
                  )}

                  {/* Check-in Date and Time (for checked_in events) */}
                  {event.status === 'checked_in' && event.check_in_time && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Clock className="h-4 w-4" />
                        Check-in Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Check-in Date: {new Date(event.check_in_time).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Check-in Time: {new Date(event.check_in_time).toLocaleTimeString('en-US', { hour12: false })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pickup Date and Time (for picked_up events) */}
                  {event.status === 'picked_up' && event.pickup_time && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Clock className="h-4 w-4" />
                        Pickup Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Pickup Date: {new Date(event.pickup_time).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Pickup Time: {new Date(event.pickup_time).toLocaleTimeString('en-US', { hour12: false })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Departure Date and Time (for departed events) */}
                  {event.status === 'departed' && event.departure_time && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Clock className="h-4 w-4" />
                        Departure Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Departure Date: {new Date(event.departure_time).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Departure Time: {new Date(event.departure_time).toLocaleTimeString('en-US', { hour12: false })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Check-in Delivery Date and Time (for checked_in_delivery events) */}
                  {event.status === 'checked_in_delivery' && event.check_in_delivery_time && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Clock className="h-4 w-4" />
                        Check-in Delivery Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Check-in Delivery Date: {new Date(event.check_in_delivery_time).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Check-in Delivery Time: {new Date(event.check_in_delivery_time).toLocaleTimeString('en-US', { hour12: false })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submission Information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                      <Clock className="h-4 w-4" />
                      Submission Information
                    </div>
                    <div className="pl-6 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>Submitted: {new Date(event.timestamp).toLocaleString('en-US', { hour12: false })}</span>
                      </div>
                    </div>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>Location: {event.location}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {event.notes && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FileText className="h-4 w-4" />
                        Notes
                      </div>
                      <p className="text-sm text-gray-400 pl-6">{event.notes}</p>
                    </div>
                  )}

                  {/* Photos */}
                  {event.photos && event.photos.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Image className="h-4 w-4" />
                        Photos ({event.photos.length})
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-6">
                        {event.photos.map((photo, photoIndex) => (
                          <div key={photoIndex} className="aspect-square bg-gray-700 rounded border border-gray-600 flex items-center justify-center">
                            <Image className="h-6 w-6 text-gray-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {event.documents && event.documents.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Paperclip className="h-4 w-4" />
                        Documents ({event.documents.length})
                      </div>
                      <div className="space-y-1 pl-6">
                        {event.documents.map((doc, docIndex) => (
                          <div key={docIndex} className="flex items-center gap-2 text-sm text-gray-400">
                            <Paperclip className="h-3 w-3" />
                            <span>{doc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button for Driver Info Updates */}
                  {isDriverInfoUpdate && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // This will be handled by the parent component
                          console.log('Driver info update requested for load:', loadId);
                        }}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Update Driver Information
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
        </div>
      )}
    </div>
  );
}

