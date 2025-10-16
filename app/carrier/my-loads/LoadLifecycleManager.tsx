"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatPickupDateTime } from "@/lib/format";
import { useUser } from "@clerk/nextjs";
import {
    Camera,
    CheckCircle,
    Clock,
    FileText,
    MapPin,
    Navigation,
    Play,
    Truck
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface LoadLifecycleManagerProps {
  loadId: string;
  loadData: any;
}

interface LifecycleEvent {
  id: string;
  status: string;
  timestamp: string;
  notes?: string;
  location?: string;
  photos?: string[];
  documents?: string[];
}

export function LoadLifecycleManager({ loadId, loadData }: LoadLifecycleManagerProps) {
  const { user } = useUser();
  const [selectedEvent, setSelectedEvent] = useState<LifecycleEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch lifecycle events
  const { data: eventsData, mutate } = useSWR(
    user ? `/api/carrier/load-lifecycle/${loadId}` : null,
    fetcher,
    { refreshInterval: 30000 } // Update every 30 seconds
  );

  const events: LifecycleEvent[] = eventsData?.events || [];
  const currentStatus = eventsData?.currentStatus || 'pending';

  const statusFlow = [
    { key: 'pending', label: 'Pending Review', icon: Clock, color: 'bg-yellow-500/20 text-yellow-300' },
    { key: 'accepted', label: 'Offer Accepted', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'assigned', label: 'Load Assigned', icon: Truck, color: 'bg-blue-500/20 text-blue-300' },
    { key: 'picked_up', label: 'Picked Up', icon: MapPin, color: 'bg-orange-500/20 text-orange-300' },
    { key: 'in_transit', label: 'In Transit', icon: Navigation, color: 'bg-purple-500/20 text-purple-300' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-green-500/20 text-green-300' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-gray-500/20 text-gray-300' }
  ];

  const currentStatusIndex = statusFlow.findIndex(s => s.key === currentStatus);
  const progressPercentage = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  const updateStatus = async (newStatus: string, notes?: string, location?: string) => {
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
          notes,
          location
        }),
      });

      if (response.ok) {
        mutate(); // Refresh the data
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const statusTransitions = {
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
      delivered: 'completed'
    };
    return statusTransitions[currentStatus as keyof typeof statusTransitions];
  };

  const canUpdateStatus = ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(currentStatus);
  const nextStatus = getNextStatus(currentStatus);

  return (
    <div className="space-y-6">
      {/* Current Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Load Lifecycle Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Load Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Load Number</p>
              <p className="font-semibold">{loadData?.rr_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Route</p>
              <p className="font-semibold">
                {loadData?.origin_city}, {loadData?.origin_state} → {loadData?.destination_city}, {loadData?.destination_state}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="font-semibold">{formatMoney(loadData?.offer_amount)}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{progressPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>

          {/* Current Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusFlow.map((status, index) => {
                const StatusIcon = status.icon;
                const isActive = status.key === currentStatus;
                const isCompleted = index <= currentStatusIndex;
                
                return (
                  <div key={status.key} className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${isActive ? status.color : isCompleted ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm ${isActive ? 'font-semibold' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {status.label}
                    </span>
                    {index < statusFlow.length - 1 && (
                      <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Update Actions */}
      {canUpdateStatus && nextStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full" disabled={isUpdating}>
                  {isUpdating ? (
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isUpdating ? 'Updating...' : `Mark as ${statusFlow.find(s => s.key === nextStatus)?.label}`}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Load Status</DialogTitle>
                </DialogHeader>
                <StatusUpdateForm
                  currentStatus={currentStatus}
                  nextStatus={nextStatus}
                  onUpdate={updateStatus}
                  isUpdating={isUpdating}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Lifecycle Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No lifecycle events yet</p>
                <p className="text-sm">Events will appear here as the load progresses</p>
              </div>
            ) : (
              events.map((event, index) => {
                const statusConfig = statusFlow.find(s => s.key === event.status);
                const StatusIcon = statusConfig?.icon || Clock;
                
                return (
                  <div key={event.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className={`p-2 rounded-full ${statusConfig?.color || 'bg-gray-500/20 text-gray-300'}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{statusConfig?.label}</h4>
                        <span className="text-sm text-muted-foreground">
                          {formatPickupDateTime(event.timestamp)}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </div>
                      )}
                      {event.notes && (
                        <p className="text-sm">{event.notes}</p>
                      )}
                      {(event.photos?.length || event.documents?.length) && (
                        <div className="flex gap-2">
                          {event.photos?.map((photo, i) => (
                            <Button key={i} variant="outline" size="sm">
                              <Camera className="w-4 h-4 mr-1" />
                              Photo {i + 1}
                            </Button>
                          ))}
                          {event.documents?.map((doc, i) => (
                            <Button key={i} variant="outline" size="sm">
                              <FileText className="w-4 h-4 mr-1" />
                              Document {i + 1}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatusUpdateFormProps {
  currentStatus: string;
  nextStatus: string;
  onUpdate: (status: string, notes?: string, location?: string) => void;
  isUpdating: boolean;
}

function StatusUpdateForm({ currentStatus, nextStatus, onUpdate, isUpdating }: StatusUpdateFormProps) {
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(nextStatus, notes, location);
    setNotes('');
    setLocation('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Location (Optional)</label>
        <Input
          placeholder="Enter current location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (Optional)</label>
        <Textarea
          placeholder="Add any notes about this status update..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isUpdating} className="flex-1">
          {isUpdating ? 'Updating...' : 'Update Status'}
        </Button>
      </div>
    </form>
  );
}
