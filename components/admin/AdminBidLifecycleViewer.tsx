"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowDown,
    ArrowUp,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    MapPin,
    Navigation,
    Paperclip,
    Search,
    Truck,
    User
} from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface BidLifecycleEvent {
  id: string;
  bid_id: string;
  event_type: string;
  event_data: any;
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

interface AwardedBid {
  id: string;
  bid_number: string;
  carrier_id: string;
  carrier_name: string;
  status: string;
  lifecycle_notes: string;
  driver_name?: string;
  driver_phone?: string;
  truck_number?: string;
  trailer_number?: string;
  driver_info_submitted_at?: string;
  bid_amount?: number;
  miles?: number;
  equipment_type?: string;
  stops?: any;
  created_at: string;
}

interface LoadInfo {
  pickup_timestamp?: string;
  delivery_timestamp?: string;
  distance_miles?: number;
  stops?: any;
  tag?: string;
}

interface AdminBidLifecycleViewerProps {
  bidId?: string;
  onBidSelect?: (bid: AwardedBid) => void;
}

export default function AdminBidLifecycleViewer({ bidId, onBidSelect }: AdminBidLifecycleViewerProps) {
  const [selectedBid, setSelectedBid] = useState<AwardedBid | null>(null);
  const [loadInfo, setLoadInfo] = useState<LoadInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"bid_number" | "created_at" | "carrier_name">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const bidsPerPage = 20;

  // Fetch awarded bids with server-side pagination
  const { data: bidsResponse, error: bidsError } = useSWR(
    `/api/admin/awarded-bids?page=${currentPage}&limit=${bidsPerPage}&search=${encodeURIComponent(searchTerm)}&status=${statusFilter}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
    fetcher
  );
  
  const bidsData = bidsResponse?.bids;
  const pagination = bidsResponse?.pagination;

  // Fetch lifecycle events for selected bid
  const { data: eventsData, error: eventsError } = useSWR<BidLifecycleEvent[]>(
    selectedBid ? `/api/admin/bid-lifecycle/${selectedBid.bid_number}` : null,
    fetcher
  );

  // Auto-select bid when bidId prop is provided
  useEffect(() => {
    if (bidId && bidsData && !selectedBid) {
      const bid = bidsData.find(b => b.bid_number === bidId);
      if (bid) {
        setSelectedBid(bid);
        fetchLoadInfo(bid.bid_number);
      }
    }
  }, [bidId, bidsData, selectedBid]);

  // Reset selectedBid when bidId changes or is removed
  useEffect(() => {
    if (!bidId && selectedBid) {
      setSelectedBid(null);
      setLoadInfo(null);
    }
  }, [bidId, selectedBid]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const fetchLoadInfo = async (bidNumber: string) => {
    try {
      const response = await fetch(`/api/admin/bid-load-info/${bidNumber}`);
      if (response.ok) {
        const data = await response.json();
        setLoadInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch load info:', error);
    }
  };

  // Server-side pagination data
  const totalPages = pagination?.totalPages || 0;
  const totalCount = pagination?.totalCount || 0;

  const handleBidClick = (bid: AwardedBid) => {
    setSelectedBid(bid);
    fetchLoadInfo(bid.bid_number);
    // If we have a parent callback, call it to update the parent's state
    if (onBidSelect) {
      onBidSelect(bid);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awarded":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      case "cancelled":
        return <Clock className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventIcon = (eventType: string) => {
    if (!eventType) return Clock;
    
    const iconMap: Record<string, any> = {
      bid_awarded: CheckCircle,
      load_assigned: Truck,
      driver_info_update: User,
      checked_in_origin: User,
      checked_in: MapPin,
      picked_up: MapPin,
      departed_origin: Navigation,
      departed: Navigation,
      in_transit: Truck,
      checked_in_destination: User,
      delivered: CheckCircle,
      completed: CheckCircle
    };
    return iconMap[eventType] || Clock;
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
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

  const getStatusSpecificDateTime = (event: BidLifecycleEvent) => {
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

  if (bidsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load bid lifecycle data
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we have a selected bid (either from bidId prop or user selection), show the details
  if (selectedBid) {
    return (
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="driver">Driver Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Bid Number</div>
              <div className="text-lg font-semibold">{selectedBid.bid_number}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Carrier</div>
              <div className="text-lg font-semibold">{selectedBid.carrier_name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedBid.status)}
                <span className="capitalize">{selectedBid.status}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Carrier ID</div>
              <div className="text-sm font-mono">{selectedBid.carrier_id}</div>
            </div>
            {selectedBid.bid_amount && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Bid Amount</div>
                <div className="text-lg font-semibold">
                  ${(selectedBid.bid_amount / 100).toLocaleString()}
                </div>
              </div>
            )}
            {loadInfo?.distance_miles && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Distance</div>
                <div className="text-lg font-semibold">
                  {loadInfo.distance_miles.toLocaleString()} miles
                </div>
              </div>
            )}
            {loadInfo?.tag && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Equipment Type</div>
                <div className="text-lg font-semibold">{loadInfo.tag}</div>
              </div>
            )}
            {loadInfo?.pickup_timestamp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Pickup Time</div>
                <div className="text-lg font-semibold">
                  {new Date(loadInfo.pickup_timestamp).toLocaleString()}
                </div>
              </div>
            )}
            {loadInfo?.delivery_timestamp && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Delivery Time</div>
                <div className="text-lg font-semibold">
                  {new Date(loadInfo.delivery_timestamp).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Route Information */}
          {loadInfo?.stops && Array.isArray(loadInfo.stops) && loadInfo.stops.length >= 2 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Route</div>
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Origin:</span>
                  <span>{loadInfo.stops[0]}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span className="font-medium">Destination:</span>
                  <span>{loadInfo.stops[loadInfo.stops.length - 1]}</span>
                </div>
                {loadInfo.stops.length > 2 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Additional Stops:</div>
                    <div className="text-sm">
                      {loadInfo.stops.slice(1, -1).map((stop: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <Navigation className="h-3 w-3 text-blue-600" />
                          <span>{stop}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedBid.lifecycle_notes && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Lifecycle Notes</div>
              <div className="p-3 bg-muted rounded-md text-sm">
                {selectedBid.lifecycle_notes}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-4">
          {eventsError ? (
            <div className="text-center text-red-600 py-8">
              Failed to load lifecycle events
            </div>
          ) : !eventsData ? (
            <div className="text-center py-8">Loading lifecycle events...</div>
          ) : eventsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No lifecycle events found
            </div>
          ) : (
            <div className="space-y-3">
              {eventsData.map((event, index) => {
                const isExpanded = expandedEvents.has(event.id);
                const Icon = getEventIcon(event.event_type);
                const isLast = index === eventsData.length - 1;
                
                return (
                  <div key={event.id} className="relative">
                    {/* Timeline Line */}
                    {!isLast && (
                      <div className="absolute left-4 top-8 w-0.5 h-8 bg-border" />
                    )}
                    
                    <Card className="ml-8">
                      <CardHeader 
                        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleEventExpansion(event.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{formatEventType(event.event_type)}</h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(event.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
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
                          <div className="space-y-4 border-t pt-4">
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
        </TabsContent>

        <TabsContent value="driver" className="space-y-4">
          {selectedBid.driver_name ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Driver Name</div>
                <div className="text-lg font-semibold">{selectedBid.driver_name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Phone</div>
                <div className="text-lg font-semibold">{selectedBid.driver_phone || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Truck Number</div>
                <div className="text-lg font-semibold">{selectedBid.truck_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Trailer Number</div>
                <div className="text-lg font-semibold">{selectedBid.trailer_number || 'N/A'}</div>
              </div>
              {selectedBid.driver_info_submitted_at && (
                <div className="col-span-2">
                  <div className="text-sm font-medium text-muted-foreground">Submitted At</div>
                  <div className="text-sm">
                    {new Date(selectedBid.driver_info_submitted_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No driver information available
            </div>
          )}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bid Lifecycle Management</CardTitle>
          <div className="text-sm text-muted-foreground">
            Showing {bidsData?.length || 0} of {totalCount} bids
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by bid number or carrier name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="awarded">Awarded</SelectItem>
                    <SelectItem value="bid_awarded">Bid Awarded</SelectItem>
                    <SelectItem value="load_assigned">Load Assigned</SelectItem>
                    <SelectItem value="checked_in_origin">Checked In - Origin</SelectItem>
                    <SelectItem value="picked_up">Picked Up</SelectItem>
                    <SelectItem value="departed_origin">Departed - Origin</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="checked_in_destination">Checked In - Destination</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date</SelectItem>
                    <SelectItem value="bid_number">Bid Number</SelectItem>
                    <SelectItem value="carrier_name">Carrier</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="px-3"
                >
                  {sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Bids Grid */}
            {!bidsData ? (
              <div className="text-center py-8">Loading bids...</div>
            ) : bidsData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No bids match your search criteria" 
                  : "No awarded bids found"}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bidsData.map((bid, index) => (
                    <div
                      key={`${bid.bid_number}-${bid.id}-${index}`}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleBidClick(bid)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Bid #{bid.bid_number}</div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(bid.status)}
                          <Badge variant="outline" className="text-xs">
                            {bid.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {bid.carrier_name}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {new Date(bid.created_at).toLocaleDateString()}
                      </div>
                      {bid.bid_amount && (
                        <div className="text-sm font-medium mb-1">
                          ${(bid.bid_amount / 100).toLocaleString()}
                        </div>
                      )}
                      {bid.driver_name && (
                        <div className="text-sm mt-1">
                          Driver: <span className="font-medium">{bid.driver_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * bidsPerPage) + 1} to {Math.min(currentPage * bidsPerPage, totalCount)} of {totalCount} bids
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
