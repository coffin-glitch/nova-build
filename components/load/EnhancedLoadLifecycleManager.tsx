"use client";

import { DriverInfoDialog } from "@/components/carrier/DriverInfoDialog";
import { EnhancedTimeline } from "@/components/load/EnhancedTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
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

interface EnhancedLoadLifecycleManagerProps {
  loadId: string;
  loadData: any;
}

export function EnhancedLoadLifecycleManager({ loadId, loadData }: EnhancedLoadLifecycleManagerProps) {
  const { user } = useUnifiedUser();
  const [selectedEvent, setSelectedEvent] = useState<LifecycleEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [driverInfoDialogOpen, setDriverInfoDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    location: ''
  });

  // Fetch lifecycle events
  const { data: eventsData, mutate } = useSWR(
    user ? `/api/carrier/load-lifecycle/${loadId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const events: LifecycleEvent[] = eventsData?.data?.events || [];
  const currentStatus = eventsData?.data?.currentStatus || 'pending';

  const statusFlow = [
    { key: 'pending', label: 'Pending Review', icon: Clock, color: 'bg-yellow-500/20 text-yellow-300' },
    { key: 'accepted', label: 'Offer Accepted', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'assigned', label: 'Load Assigned', icon: Truck, color: 'bg-blue-500/20 text-blue-300' },
    { key: 'checked_in', label: 'Checked In', icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'picked_up', label: 'Picked Up', icon: MapPin, color: 'bg-orange-500/20 text-orange-300' },
    { key: 'departed', label: 'Departed', icon: Navigation, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'in_transit', label: 'In Transit', icon: Truck, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'checked_in_delivery', label: 'Checked In - Delivery', icon: User, color: 'bg-indigo-500/20 text-indigo-300' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-gray-500/20 text-gray-300' }
  ];

  // Get the actual current status from loadData or events
  const actualCurrentStatus = loadData?.status || currentStatus;
  const currentStatusIndex = statusFlow.findIndex(s => s.key === actualCurrentStatus);
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  const updateStatus = async (newStatus: string, updateData: any) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/carrier/load-lifecycle/${loadId}`, {
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
        toast.success(`Status updated to ${statusFlow.find(s => s.key === newStatus)?.label}`);
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

  const handleDriverInfoSuccess = () => {
    mutate(); // Refresh the timeline
    toast.success("Driver information updated successfully!");
  };

  const getNextStatus = (currentStatus: string) => {
    const statusTransitions = {
      pending: 'accepted',
      accepted: 'assigned',
      assigned: 'checked_in',
      checked_in: 'picked_up',
      picked_up: 'departed',
      departed: 'in_transit',
      in_transit: 'checked_in_delivery',
      checked_in_delivery: 'delivered',
      delivered: 'completed',
      completed: null // No further transitions
    };
    return statusTransitions[currentStatus as keyof typeof statusTransitions] || null;
  };

  const getAvailableStatuses = (currentStatus: string) => {
    const allStatuses = statusFlow.map(s => s.key);
    const currentIndex = allStatuses.indexOf(currentStatus);
    
    // Return all statuses from current to completed
    return allStatuses.slice(currentIndex + 1);
  };

  const canUpdateStatus = ['pending', 'accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered'].includes(actualCurrentStatus);
  const nextStatus = getNextStatus(actualCurrentStatus);

  const getStatusFields = (status: string) => {
    const baseFields = ['notes']; // Always include notes
    
    switch (status) {
      case 'checked_in':
        return [...baseFields, 'check_in_time'];
      case 'picked_up':
        return [...baseFields, 'pickup_time'];
      case 'departed':
        return [...baseFields, 'departure_time'];
      case 'checked_in_delivery':
        return [...baseFields, 'check_in_delivery_time'];
      case 'delivered':
        return [...baseFields, 'delivery_time', 'location'];
      default:
        return [...baseFields, 'location'];
    }
  };

  // Get current driver info for auto-filling
  const getCurrentDriverInfo = () => {
    // First try to get from loadData (load_offers table)
    if (loadData?.driver_name) {
      return {
        driver_name: loadData.driver_name || '',
        driver_phone: loadData.driver_phone || '',
        driver_email: loadData.driver_email || '',
        driver_license_number: loadData.driver_license_number || '',
        driver_license_state: loadData.driver_license_state || '',
        truck_number: loadData.truck_number || '',
        trailer_number: loadData.trailer_number || '',
        second_driver_name: loadData.second_driver_name || '',
        second_driver_phone: loadData.second_driver_phone || '',
        second_driver_email: loadData.second_driver_email || '',
        second_driver_license_number: loadData.second_driver_license_number || '',
        second_driver_license_state: loadData.second_driver_license_state || '',
        second_truck_number: loadData.second_truck_number || '',
        second_trailer_number: loadData.second_trailer_number || ''
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
    if (status === 'checked_in') {
      initialData = {
        ...initialData,
        check_in_time: currentDateTime
      };
    } else if (status === 'picked_up') {
      initialData = {
        ...initialData,
        pickup_time: currentDateTime
      };
    } else if (status === 'departed') {
      initialData = {
        ...initialData,
        departure_time: currentDateTime
      };
    } else if (status === 'checked_in_delivery') {
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
            Load Status: {statusFlow.find(s => s.key === actualCurrentStatus)?.label || 'Unknown'}
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

      {/* Quick Actions */}
      {canUpdateStatus && nextStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={() => handleStatusUpdate(nextStatus)}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as {statusFlow.find(s => s.key === nextStatus)?.label}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load Details */}
      <Card>
        <CardHeader>
          <CardTitle>Load Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Route</Label>
              <p className="font-medium">
                {loadData?.origin_city}, {loadData?.origin_state} → {loadData?.destination_city}, {loadData?.destination_state}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Equipment</Label>
              <p className="font-medium">{loadData?.equipment || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Pickup Date</Label>
              <p className="font-medium">{loadData?.pickup_date || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Delivery Date</Label>
              <p className="font-medium">{loadData?.delivery_date || 'N/A'}</p>
            </div>
          </div>
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
                onClick={() => setUpdateDialogOpen(true)}
                disabled={isUpdating || !nextStatus}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                {nextStatus ? `Mark as ${statusFlow.find(s => s.key === nextStatus)?.label}` : 'Update Status'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnhancedTimeline 
            events={events}
            currentStatus={currentStatus}
            loadId={loadId}
          />
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update Status: {nextStatus ? statusFlow.find(s => s.key === nextStatus)?.label : 'Select Status'}
            </DialogTitle>
            <DialogDescription>
              Current Status: <span className="font-medium">{statusFlow.find(s => s.key === actualCurrentStatus)?.label}</span>
              {nextStatus && (
                <> → Next: <span className="font-medium">{statusFlow.find(s => s.key === nextStatus)?.label}</span></>
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
                {isUpdating ? 'Updating...' : `Update to ${nextStatus ? statusFlow.find(s => s.key === nextStatus)?.label : 'Next Status'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Info Dialog */}
      <DriverInfoDialog
        isOpen={driverInfoDialogOpen}
        onOpenChange={setDriverInfoDialogOpen}
        loadId={loadId}
        onSuccess={handleDriverInfoSuccess}
      />
    </div>
  );
}
