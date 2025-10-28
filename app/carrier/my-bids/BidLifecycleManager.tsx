"use client";

import { DriverInfoDialog } from "@/components/carrier/DriverInfoDialog";
import { LoadAssignedDialog } from "@/components/carrier/LoadAssignedDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@clerk/nextjs";
import {
    CheckCircle,
    Clock,
    MapPin,
    Navigation,
    Plus,
    Truck,
    User
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { BidTimeline } from "./BidTimeline";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LifecycleEvent {
  id: string;
  status: string;
  timestamp: string;
  notes?: string;
  location?: string;
  photos?: string[];
  documents?: string[];
  event_type?: string;
  driver_info?: {
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
  };
}

interface BidLifecycleManagerProps {
  bidId: string;
  bidData: any;
}

export function BidLifecycleManager({ bidId, bidData }: BidLifecycleManagerProps) {
  const { user } = useUser();
  const [selectedEvent, setSelectedEvent] = useState<LifecycleEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [driverInfoDialogOpen, setDriverInfoDialogOpen] = useState(false);
  const [loadAssignedDialogOpen, setLoadAssignedDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    location: ''
  });

  // Fetch lifecycle events
  const { data: eventsData, mutate } = useSWR(
    user ? `/api/carrier/bid-lifecycle/${bidId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const events: LifecycleEvent[] = eventsData?.data?.events || [];
  const currentStatus = eventsData?.data?.currentStatus || 'bid_awarded';
  const bidDetails = eventsData?.data?.bidDetails || null;

  const statusFlow = [
    { key: 'bid_awarded', label: 'Bid Awarded', icon: CheckCircle, color: 'bg-blue-500/20 text-blue-300' },
    { key: 'load_assigned', label: 'Load Assigned', icon: Truck, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'checked_in_origin', label: 'Checked In - Origin', icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'picked_up', label: 'Picked Up', icon: MapPin, color: 'bg-orange-500/20 text-orange-300' },
    { key: 'departed_origin', label: 'Departed - Origin', icon: Navigation, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'in_transit', label: 'In Transit', icon: Truck, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'checked_in_destination', label: 'Checked In - Destination', icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-gray-500/20 text-gray-300' }
  ];

  // Generate stages for multi-stop loads
  const generateMultiStopStages = (stops: any) => {
    if (!stops || typeof stops !== 'object') return statusFlow;
    
    const stages = [...statusFlow];
    const stopCount = Object.keys(stops).length;
    
    if (stopCount > 2) {
      // Insert additional stop stages
      const additionalStages = [];
      for (let i = 1; i < stopCount - 1; i++) {
        additionalStages.push(
          { key: `checked_in_stop_${i}`, label: `Checked In - Stop ${i}`, icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
          { key: `picked_up_stop_${i}`, label: `Picked Up - Stop ${i}`, icon: MapPin, color: 'bg-orange-500/20 text-orange-300' },
          { key: `departed_stop_${i}`, label: `Departed - Stop ${i}`, icon: Navigation, color: 'bg-purple-500/20 text-purple-300' },
          { key: `in_transit_stop_${i}`, label: `In Transit - Stop ${i}`, icon: Truck, color: 'bg-purple-500/20 text-purple-300' }
        );
      }
      
      // Insert additional stages before final delivery
      const finalDeliveryIndex = stages.findIndex(s => s.key === 'checked_in_destination');
      stages.splice(finalDeliveryIndex, 0, ...additionalStages);
    }
    
    return stages;
  };

  const lifecycleStages = generateMultiStopStages(bidData.stops);
  
  // Get the actual current status from bidData or events
  const actualCurrentStatus = bidData?.status || currentStatus;
  const currentStatusIndex = lifecycleStages.findIndex(s => s.key === actualCurrentStatus);
  const progressPercentage = ((currentStatusIndex + 1) / lifecycleStages.length) * 100;

  const updateStatus = async (newStatus: string, updateData: any) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/carrier/bid-lifecycle/${bidId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          ...updateData
        }),
      });

      if (response.ok) {
        mutate();
        toast.success(`Status updated to ${lifecycleStages.find(s => s.key === newStatus)?.label}`);
        setUpdateDialogOpen(false);
        setUpdateData({
          status: '',
          notes: '',
          location: ''
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDriverInfoUpdate = () => {
    setDriverInfoDialogOpen(true);
  };

  const handleLoadAssigned = () => {
    setLoadAssignedDialogOpen(true);
  };

  const handleDriverInfoSuccess = () => {
    mutate(); // Refresh the timeline
    toast.success("Driver information updated successfully!");
  };

  const getNextStatus = (currentStatus: string) => {
    const statusTransitions = {
      bid_awarded: 'load_assigned',
      load_assigned: 'checked_in_origin',
      checked_in_origin: 'picked_up',
      picked_up: 'departed_origin',
      departed_origin: 'in_transit',
      in_transit: 'checked_in_destination',
      checked_in_destination: 'delivered',
      delivered: 'completed',
      completed: null // No further transitions
    };
    return statusTransitions[currentStatus as keyof typeof statusTransitions] || null;
  };

  const getAvailableStatuses = (currentStatus: string) => {
    const allStatuses = lifecycleStages.map(s => s.key);
    const currentIndex = allStatuses.indexOf(currentStatus);
    
    // Return all statuses from current to completed
    return allStatuses.slice(currentIndex + 1);
  };

  const canUpdateStatus = ['bid_awarded', 'load_assigned', 'checked_in_origin', 'picked_up', 'departed_origin', 'in_transit', 'checked_in_destination', 'delivered'].includes(actualCurrentStatus);
  const nextStatus = getNextStatus(actualCurrentStatus);

  const getStatusFields = (status: string) => {
    const baseFields = ['notes']; // Always include notes
    
    switch (status) {
      case 'checked_in_origin':
        return [...baseFields, 'check_in_time'];
      case 'picked_up':
        return [...baseFields, 'pickup_time'];
      case 'departed_origin':
        return [...baseFields, 'departure_time'];
      case 'checked_in_destination':
        return [...baseFields, 'check_in_delivery_time'];
      case 'delivered':
        return [...baseFields, 'delivery_time', 'location'];
      default:
        return [...baseFields, 'location'];
    }
  };

  // Get current driver info for auto-filling
  const getCurrentDriverInfo = () => {
    // First try to get from bidData
    if (bidData?.driver_name) {
      return {
        driver_name: bidData.driver_name || '',
        driver_phone: bidData.driver_phone || '',
        driver_email: bidData.driver_email || '',
        driver_license_number: bidData.driver_license_number || '',
        driver_license_state: bidData.driver_license_state || '',
        truck_number: bidData.truck_number || '',
        trailer_number: bidData.trailer_number || '',
        second_driver_name: bidData.second_driver_name || '',
        second_driver_phone: bidData.second_driver_phone || '',
        second_driver_email: bidData.second_driver_email || '',
        second_driver_license_number: bidData.second_driver_license_number || '',
        second_driver_license_state: bidData.second_driver_license_state || '',
        second_truck_number: bidData.second_truck_number || '',
        second_trailer_number: bidData.second_trailer_number || ''
      };
    }
    
    // Fallback to most recent driver info from lifecycle events
    const driverInfoEvent = events
      .filter(event => event.driver_info)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    return driverInfoEvent?.driver_info || {};
  };

  // Get current date in datetime-local format with default time
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T09:00`; // Default to 9:00 AM
  };

  const handleStatusUpdate = (status: string) => {
    const currentDateTime = getCurrentDateTime();
    
    let initialData = { status };
    
    // Auto-fill current date/time for checked_in, picked_up, departed, and checked_in_delivery status
    if (status === 'checked_in_origin') {
      initialData = {
        ...initialData,
        check_in_time: currentDateTime
      };
    } else if (status === 'picked_up') {
      initialData = {
        ...initialData,
        pickup_time: currentDateTime
      };
    } else if (status === 'departed_origin') {
      initialData = {
        ...initialData,
        departure_time: currentDateTime
      };
    } else if (status === 'checked_in_destination') {
      initialData = {
        ...initialData,
        check_in_delivery_time: currentDateTime
      };
    }
    
    setUpdateData(prev => ({ ...prev, ...initialData }));
    setUpdateDialogOpen(true);
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

  return (
    <div className="space-y-6">
      {/* Current Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Bid Status: {lifecycleStages.find(s => s.key === actualCurrentStatus)?.label || 'Unknown'}
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
            <div className="overflow-x-auto">
              <div className="flex items-center space-x-6 min-w-max px-4 py-2">
                {lifecycleStages.map((status, index) => {
                  const isActive = index <= currentStatusIndex;
                  const isCurrent = status.key === actualCurrentStatus;
                  const Icon = status.icon;
                  
                  return (
                    <div key={status.key} className="flex flex-col items-center space-y-2 min-w-[80px] p-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isActive ? status.color : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs text-center leading-tight ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {canUpdateStatus && nextStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (nextStatus === 'load_assigned') {
                    handleLoadAssigned();
                  } else {
                    handleStatusUpdate(nextStatus);
                  }
                }}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as {lifecycleStages.find(s => s.key === nextStatus)?.label}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bid Details */}
      <Card>
        <CardHeader>
          <CardTitle>Bid Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Bid Number</Label>
              <p className="font-medium">#{bidDetails?.bid_number || bidData?.bid_number || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Awarded Amount</Label>
              <p className="font-medium text-green-600">
                ${bidDetails?.winner_amount_cents ? (bidDetails.winner_amount_cents / 100).toFixed(2) : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Distance</Label>
              <p className="font-medium">
                {bidDetails?.distance_miles || bidData?.distance_miles ? 
                  `${bidDetails?.distance_miles || bidData?.distance_miles} miles` : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">State Tag</Label>
              <p className="font-medium">{bidDetails?.tag || bidData?.tag || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Pickup Date</Label>
              <p className="font-medium">
                {bidDetails?.pickup_timestamp || bidData?.pickup_timestamp ? 
                  new Date(bidDetails?.pickup_timestamp || bidData?.pickup_timestamp).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Delivery Date</Label>
              <p className="font-medium">
                {bidDetails?.delivery_timestamp || bidData?.delivery_timestamp ? 
                  new Date(bidDetails?.delivery_timestamp || bidData?.delivery_timestamp).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Awarded Date</Label>
              <p className="font-medium">
                {bidDetails?.awarded_at ? 
                  new Date(bidDetails.awarded_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          
          {/* Driver Information */}
          {(bidDetails?.driver_name || bidDetails?.driver_phone || bidDetails?.truck_number) && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-3">Driver Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Driver Name</Label>
                  <p className="font-medium">{bidDetails?.driver_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Driver Phone</Label>
                  <p className="font-medium">{bidDetails?.driver_phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Truck Number</Label>
                  <p className="font-medium">{bidDetails?.truck_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Trailer Number</Label>
                  <p className="font-medium">{bidDetails?.trailer_number || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Lifecycle Notes */}
          {bidDetails?.lifecycle_notes && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-3">Lifecycle Notes</h4>
              <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                {bidDetails.lifecycle_notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline Events
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDriverInfoUpdate}
                variant="outline"
                size="sm"
              >
                <User className="h-4 w-4 mr-2" />
                Update Driver Info
              </Button>
              <Button
                onClick={() => {
                  if (nextStatus === 'load_assigned') {
                    handleLoadAssigned();
                  } else {
                    setUpdateDialogOpen(true);
                  }
                }}
                disabled={isUpdating || !nextStatus}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {nextStatus ? `Mark as ${lifecycleStages.find(s => s.key === nextStatus)?.label}` : 'Update Status'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BidTimeline 
            events={events}
            currentStatus={currentStatus}
            bidId={bidId}
          />
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update Status: {nextStatus ? lifecycleStages.find(s => s.key === nextStatus)?.label : 'Select Status'}
            </DialogTitle>
            <DialogDescription>
              Current Status: <span className="font-medium">{lifecycleStages.find(s => s.key === actualCurrentStatus)?.label}</span>
              {nextStatus && (
                <> → Next: <span className="font-medium">{lifecycleStages.find(s => s.key === nextStatus)?.label}</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {getStatusFields(updateData.status).map(field => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>
                  {field === 'check_in_time' ? 'Check in Date & Time' : field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Label>
                {field.includes('time') ? (
                  <DateTimePicker
                    value={updateData[field as keyof typeof updateData] || ''}
                    onChange={(value) => setUpdateData(prev => ({ ...prev, [field]: value }))}
                    placeholder={`Select ${field.replace('_', ' ')}`}
                    className="w-full"
                  />
                ) : field === 'notes' ? (
                  <Textarea
                    id={field}
                    value={updateData[field as keyof typeof updateData]}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder="Add notes..."
                  />
                ) : (
                  <Input
                    id={field}
                    value={updateData[field as keyof typeof updateData]}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`Enter ${field.replace('_', ' ')}`}
                  />
                )}
              </div>
            ))}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (nextStatus) {
                    updateStatus(nextStatus, updateData);
                  }
                }}
                disabled={isUpdating || !nextStatus}
              >
                {isUpdating ? 'Updating...' : `Update to ${nextStatus ? lifecycleStages.find(s => s.key === nextStatus)?.label : 'Next Status'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Info Dialog */}
      <DriverInfoDialog
        isOpen={driverInfoDialogOpen}
        onOpenChange={setDriverInfoDialogOpen}
        loadId={bidId}
        onSuccess={handleDriverInfoSuccess}
        isBid={true}
      />

      {/* Load Assigned Dialog */}
      <LoadAssignedDialog
        isOpen={loadAssignedDialogOpen}
        onOpenChange={setLoadAssignedDialogOpen}
        bidId={bidId}
        onSuccess={() => {
          mutate(); // Refresh the timeline
          toast.success("Load assigned successfully!");
        }}
      />
    </div>
  );
}