"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Clock,
    Edit2,
    GripVertical,
    Phone,
    Save,
    Trash2,
    Truck,
    User,
    X
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DriverProfile {
  id: string;
  profile_name: string;
  driver_name: string;
  driver_phone: string;
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
  display_order: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

interface DriverProfileManagerProps {
  profiles: DriverProfile[];
  onProfileSelect: (profile: DriverProfile) => void;
  onProfilesUpdate: () => void;
}

export function DriverProfileManager({ 
  profiles, 
  onProfileSelect, 
  onProfilesUpdate 
}: DriverProfileManagerProps) {
  // Early return if profiles is undefined or not loaded yet
  if (!profiles) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading profiles...</div>
      </div>
    );
  }

  const [editingProfile, setEditingProfile] = useState<DriverProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);

  const formatPhoneDisplay = (phone: string): string => {
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleProfileSelect = async (profile: DriverProfile) => {
    // Mark profile as used
    try {
      await fetch("/api/carrier/driver-profiles", {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'markUsed',
          profileId: profile.id
        }),
      });
    } catch (error) {
      console.error('Error marking profile as used:', error);
    }

    onProfileSelect(profile);
  };

  const handleEditName = (profile: DriverProfile) => {
    setEditingProfile(profile);
    setEditName(profile.profile_name);
  };

  const handleSaveName = async () => {
    if (!editingProfile || !editName.trim()) return;

    try {
      const response = await fetch("/api/carrier/driver-profiles", {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateName',
          profileId: editingProfile.id,
          newName: editName.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile name');
      }

      toast.success("Profile name updated successfully!");
      setEditingProfile(null);
      setEditName("");
      onProfilesUpdate();
    } catch (error) {
      console.error('Error updating profile name:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile name";
      toast.error(errorMessage);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this profile? This action cannot be undone.")) {
      return;
    }

    try {
      console.log('🗑️ Deleting profile:', profileId);
      
      const response = await fetch(`/api/carrier/driver-profiles?id=${profileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete profile');
      }

      toast.success("Profile deleted successfully!");
      onProfilesUpdate();
    } catch (error) {
      console.error('Error deleting profile:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete profile";
      toast.error(errorMessage);
    }
  };

  const handleDragStart = (e: React.DragEvent, profileId: string) => {
    setDraggedProfile(profileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetProfileId: string) => {
    e.preventDefault();
    
    if (!draggedProfile || draggedProfile === targetProfileId) {
      setDraggedProfile(null);
      return;
    }

    setIsUpdatingOrder(true);

    try {
      // Create new order array
      const draggedIndex = profiles.findIndex(p => p.id === draggedProfile);
      const targetIndex = profiles.findIndex(p => p.id === targetProfileId);
      
      const newProfiles = [...profiles];
      const [draggedItem] = newProfiles.splice(draggedIndex, 1);
      newProfiles.splice(targetIndex, 0, draggedItem);

      // Update display orders
      const profileOrders = newProfiles.map((profile, index) => ({
        id: profile.id,
        order: index
      }));

      console.log('🔄 Updating profile order:', profileOrders);

      const response = await fetch("/api/carrier/driver-profiles", {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateOrder',
          profileOrders: profileOrders
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile order');
      }

      toast.success("Profile order updated!");
      onProfilesUpdate();
    } catch (error) {
      console.error('Error updating profile order:', error);
      toast.error("Failed to update profile order");
    } finally {
      setIsUpdatingOrder(false);
      setDraggedProfile(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedProfile(null);
  };

  if (profiles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Driver Profiles</h3>
          <p className="text-muted-foreground">
            Create your first driver profile to get started. Profiles help you quickly load driver information for different loads.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Driver Profiles ({profiles.length})</h3>
        <Badge variant="secondary" className="text-xs">
          Drag to reorder
        </Badge>
      </div>

      <div className="space-y-2">
        {profiles.map((profile, index) => (
          <Card 
            key={profile.id}
            className={`transition-all duration-200 hover:shadow-md ${
              draggedProfile === profile.id ? 'opacity-50 scale-95' : ''
            } ${isUpdatingOrder ? 'pointer-events-none' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, profile.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, profile.id)}
            onDragEnd={handleDragEnd}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {editingProfile?.id === profile.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Profile name"
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveName}
                            className="h-8 px-2"
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingProfile(null);
                              setEditName("");
                            }}
                            className="h-8 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <h4 className="font-medium text-sm">{profile.profile_name}</h4>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{profile.driver_name}</span>
                      </div>
                      
                      {profile.driver_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{formatPhoneDisplay(profile.driver_phone)}</span>
                        </div>
                      )}
                      
                      {profile.truck_number && (
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          <span>Truck: {profile.truck_number}</span>
                        </div>
                      )}
                      
                      {profile.last_used_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Used: {formatDate(profile.last_used_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleProfileSelect(profile)}
                    className="h-8 px-3 text-xs"
                  >
                    Load
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditName(profile)}
                    className="h-8 px-2"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {profiles.length > 1 && (
        <div className="text-xs text-muted-foreground text-center">
          💡 Tip: Drag profiles by the grip handle to reorder them by preference
        </div>
      )}
    </div>
  );
}
