"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Plus, Save, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { DriverProfileManager } from "./DriverProfileManager";

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

interface DriverInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loadId: string;
  onSuccess?: () => void;
}

// Format phone number for display (add dashes)
function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function DriverInfoDialog({
  isOpen,
  onOpenChange,
  loadId,
  onSuccess
}: DriverInfoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  // Driver information state
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");
  const [driverLicenseState, setDriverLicenseState] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");

  // Additional information
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch driver profiles
  const { data: profilesData, mutate: mutateProfiles } = useSWR(
    isOpen ? "/api/carrier/driver-profiles" : null,
    (url) => fetch(url).then(r => r.json())
  );

  const profiles: DriverProfile[] = profilesData?.profiles || [];

  // Load existing driver information when dialog opens
  useEffect(() => {
    if (isOpen && loadId) {
      loadDriverInfo();
    }
  }, [isOpen, loadId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setDriverName("");
      setDriverPhone("");
      setDriverEmail("");
      setDriverLicenseNumber("");
      setDriverLicenseState("");
      setTruckNumber("");
      setTrailerNumber("");
      setLocation("");
      setNotes("");
      setShowProfileManager(false);
      setNewProfileName("");
    }
  }, [isOpen]);

  const loadDriverInfo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/carrier/loads/${loadId}/driver-info`);
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.driver_info) {
          const info = data.driver_info;
          setDriverName(info.driver_name || "");
          setDriverPhone(info.driver_phone ? formatPhoneDisplay(info.driver_phone) : "");
          setDriverEmail(info.driver_email || "");
          setDriverLicenseNumber(info.driver_license_number || "");
          setDriverLicenseState(info.driver_license_state || "");
          setTruckNumber(info.truck_number || "");
          setTrailerNumber(info.trailer_number || "");
        }
      }
    } catch (error) {
      console.error('Error loading driver info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = (profile: DriverProfile) => {
    setDriverName(profile.driver_name);
    setDriverPhone(formatPhoneDisplay(profile.driver_phone));
    setDriverEmail(profile.driver_email || "");
    setDriverLicenseNumber(profile.driver_license_number || "");
    setDriverLicenseState(profile.driver_license_state || "");
    setTruckNumber(profile.truck_number || "");
    setTrailerNumber(profile.trailer_number || "");
    setShowProfileManager(false);
    toast.success(`Loaded profile: ${profile.profile_name}`);
  };

  const saveProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error("Please enter a profile name");
      return;
    }

    if (!driverName.trim() || !driverPhone.trim()) {
      toast.error("Driver name and phone are required to save profile");
      return;
    }

    try {
      const response = await fetch("/api/carrier/driver-profiles", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_name: newProfileName.trim(),
          driver_name: driverName,
          driver_phone: driverPhone,
          driver_email: driverEmail || null,
          driver_license_number: driverLicenseNumber || null,
          driver_license_state: driverLicenseState || null,
          truck_number: truckNumber || null,
          trailer_number: trailerNumber || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const result = await response.json();
      
      // Show success message with information about name adjustment
      if (result.nameWasAdjusted) {
        toast.success(`Profile saved as "${result.finalName}" (name was adjusted to avoid duplicates)`);
      } else {
        toast.success(`Profile "${result.finalName}" saved successfully!`);
      }
      
      // Show cross-carrier match information if available
      if (result.crossCarrierMatches && result.crossCarrierMatches.count > 0) {
        toast.info(result.crossCarrierMatches.message, {
          duration: 8000, // Show longer for informational message
        });
      }
      
      setNewProfileName("");
      setShowProfileManager(false);
      mutateProfiles();
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save profile. Please try again.";
      toast.error(errorMessage);
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) {
      return;
    }

    try {
      const response = await fetch("/api/carrier/driver-profiles", {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: profileId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete profile');
      }

      toast.success("Profile deleted successfully!");
      mutateProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error("Failed to delete profile. Please try again.");
    }
  };

  const validateForm = () => {
    if (!driverName.trim()) {
      toast.error("Driver name is required");
      return false;
    }
    if (!driverPhone.trim()) {
      toast.error("Driver phone number is required");
      return false;
    }
    const phoneDigits = driverPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast.error("Driver phone number must be exactly 10 digits");
      return false;
    }
    if (!truckNumber.trim()) {
      toast.error("Truck number is required");
      return false;
    }
    // Trailer number is now optional
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/carrier/loads/${loadId}/driver-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driver_name: driverName,
          driver_phone: driverPhone,
          driver_email: driverEmail || null,
          driver_license_number: driverLicenseNumber || null,
          driver_license_state: driverLicenseState || null,
          truck_number: truckNumber,
          trailer_number: trailerNumber,
          location: location || null,
          notes: notes || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update driver information');
      }

      const result = await response.json();
      
      toast.success("Driver information updated successfully!");
      
      onOpenChange(false);
      onSuccess?.();

    } catch (error) {
      console.error('Error updating driver information:', error);
      toast.error("Failed to update driver information. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Driver Information
          </DialogTitle>
          <DialogDescription>
            Update driver information for load {loadId}. This information will be tracked in the load timeline.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading driver information...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Management Section */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Driver Profiles
                </h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProfileManager(!showProfileManager)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {showProfileManager ? "Hide" : "Manage"} Profiles
                  </Button>
                </div>
              </div>

              {/* Quick Profile Selection */}
              {profiles.length > 0 && (
                <div className="mb-4">
                  <Label htmlFor="profile-select">Quick Load Profile</Label>
                  <Select onValueChange={(value) => {
                    const profile = profiles.find(p => p.id === value);
                    if (profile) loadProfile(profile);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profile_name} - {profile.driver_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Profile Manager */}
              {showProfileManager && (
                <div className="space-y-4">
                  <Separator />
                  
                  {/* Save Current Info As Profile */}
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Save Current Info As</Label>
                    <div className="flex gap-2">
                      <Input
                        id="profile-name"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Enter profile name..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={saveProfile}
                        disabled={!newProfileName.trim() || isLoading}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Profile Manager */}
                  <DriverProfileManager
                    profiles={profiles}
                    onProfileSelect={loadProfile}
                    onProfilesUpdate={mutateProfiles}
                  />
                </div>
              )}
            </div>

            {/* Driver Information Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Driver Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Driver Information</h3>
                  <span className="text-sm font-normal text-muted-foreground">Required</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver-name">Driver Name *</Label>
                    <Input
                      id="driver-name"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Enter driver's full name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="driver-phone">Phone Number *</Label>
                    <Input
                      id="driver-phone"
                      value={driverPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setDriverPhone(value);
                        }
                      }}
                      placeholder="1234567890 or 123-456-7890"
                      maxLength={12}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="driver-email">Email Address</Label>
                    <Input
                      id="driver-email"
                      value={driverEmail}
                      onChange={(e) => setDriverEmail(e.target.value)}
                      placeholder="driver@example.com"
                      type="email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="driver-license">License Number</Label>
                    <Input
                      id="driver-license"
                      value={driverLicenseNumber}
                      onChange={(e) => setDriverLicenseNumber(e.target.value)}
                      placeholder="D123456789"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="driver-license-state">License State</Label>
                    <Input
                      id="driver-license-state"
                      value={driverLicenseState}
                      onChange={(e) => setDriverLicenseState(e.target.value)}
                      placeholder="CA"
                      maxLength={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="truck-number">Truck Number *</Label>
                    <Input
                      id="truck-number"
                      value={truckNumber}
                      onChange={(e) => setTruckNumber(e.target.value)}
                      placeholder="TRK-123 or 12345"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="trailer-number">Trailer Number (Optional)</Label>
                    <Input
                      id="trailer-number"
                      value={trailerNumber}
                      onChange={(e) => setTrailerNumber(e.target.value)}
                      placeholder="TRL-456 or 67890"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Additional Information</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Current Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, State (optional)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional notes about the driver assignment..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  {isSubmitting ? "Updating..." : "Update Driver Info"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}