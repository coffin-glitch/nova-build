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
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Plus, Save, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

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
}

interface EnhancedDriverInfoDialogProps {
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

// Format phone number for storage (remove all non-digits)
function formatPhoneStorage(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function EnhancedDriverInfoDialog({
  isOpen,
  onOpenChange,
  loadId,
  onSuccess
}: EnhancedDriverInfoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profileName, setProfileName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [hasSecondaryDriver, setHasSecondaryDriver] = useState(false);

  // Primary Driver - Individual state variables
  const [primaryDriverName, setPrimaryDriverName] = useState("");
  const [primaryDriverPhone, setPrimaryDriverPhone] = useState("");
  const [primaryDriverEmail, setPrimaryDriverEmail] = useState("");
  const [primaryDriverLicenseNumber, setPrimaryDriverLicenseNumber] = useState("");
  const [primaryDriverLicenseState, setPrimaryDriverLicenseState] = useState("");
  const [primaryTruckNumber, setPrimaryTruckNumber] = useState("");
  const [primaryTrailerNumber, setPrimaryTrailerNumber] = useState("");

  // Secondary Driver - Individual state variables
  const [secondaryDriverName, setSecondaryDriverName] = useState("");
  const [secondaryDriverPhone, setSecondaryDriverPhone] = useState("");
  const [secondaryDriverEmail, setSecondaryDriverEmail] = useState("");
  const [secondaryDriverLicenseNumber, setSecondaryDriverLicenseNumber] = useState("");
  const [secondaryDriverLicenseState, setSecondaryDriverLicenseState] = useState("");
  const [secondaryTruckNumber, setSecondaryTruckNumber] = useState("");
  const [secondaryTrailerNumber, setSecondaryTrailerNumber] = useState("");

  // Additional Information
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch driver profiles
  const { data: profilesData, mutate: mutateProfiles } = useSWR(
    isOpen ? '/api/carrier/driver-profiles' : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch profiles');
      return response.json();
    }
  );

  const profiles: DriverProfile[] = profilesData?.profiles || [];

  // Load profile data when a profile is selected
  useEffect(() => {
    if (selectedProfileId && profiles.length > 0) {
      const profile = profiles.find(p => p.id === selectedProfileId);
      if (profile) {
        setPrimaryDriverName(profile.driver_name);
        setPrimaryDriverPhone(formatPhoneDisplay(profile.driver_phone));
        setPrimaryDriverEmail(profile.driver_email || "");
        setPrimaryDriverLicenseNumber(profile.driver_license_number || "");
        setPrimaryDriverLicenseState(profile.driver_license_state || "");
        setPrimaryTruckNumber(profile.truck_number || "");
        setPrimaryTrailerNumber(profile.trailer_number || "");
        
        if (profile.second_driver_name) {
          setHasSecondaryDriver(true);
          setSecondaryDriverName(profile.second_driver_name);
          setSecondaryDriverPhone(formatPhoneDisplay(profile.second_driver_phone || ""));
          setSecondaryDriverEmail(profile.second_driver_email || "");
          setSecondaryDriverLicenseNumber(profile.second_driver_license_number || "");
          setSecondaryDriverLicenseState(profile.second_driver_license_state || "");
          setSecondaryTruckNumber(profile.second_truck_number || "");
          setSecondaryTrailerNumber(profile.second_trailer_number || "");
        } else {
          setHasSecondaryDriver(false);
          // Clear secondary driver fields
          setSecondaryDriverName("");
          setSecondaryDriverPhone("");
          setSecondaryDriverEmail("");
          setSecondaryDriverLicenseNumber("");
          setSecondaryDriverLicenseState("");
          setSecondaryTruckNumber("");
          setSecondaryTrailerNumber("");
        }
      }
    }
  }, [selectedProfileId, profiles]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProfileId("");
      setProfileName("");
      setPrimaryDriverName("");
      setPrimaryDriverPhone("");
      setPrimaryDriverEmail("");
      setPrimaryDriverLicenseNumber("");
      setPrimaryDriverLicenseState("");
      setPrimaryTruckNumber("");
      setPrimaryTrailerNumber("");
      setHasSecondaryDriver(false);
      setSecondaryDriverName("");
      setSecondaryDriverPhone("");
      setSecondaryDriverEmail("");
      setSecondaryDriverLicenseNumber("");
      setSecondaryDriverLicenseState("");
      setSecondaryTruckNumber("");
      setSecondaryTrailerNumber("");
      setLocation("");
      setNotes("");
    }
  }, [isOpen]);

  const validateDriverInfo = (isPrimary: boolean) => {
    if (isPrimary) {
      if (!primaryDriverName?.trim()) {
        toast.error("Driver name is required");
        return false;
      }
      if (!primaryDriverPhone?.trim()) {
        toast.error("Driver phone number is required");
        return false;
      }
      const phoneDigits = formatPhoneStorage(primaryDriverPhone);
      if (phoneDigits.length !== 10) {
        toast.error("Driver phone number must be exactly 10 digits");
        return false;
      }
      if (!primaryTruckNumber?.trim()) {
        toast.error("Truck number is required");
        return false;
      }
      if (!primaryTrailerNumber?.trim()) {
        toast.error("Trailer number is required");
        return false;
      }
    } else {
      if (!secondaryDriverName?.trim()) {
        toast.error("Secondary driver name is required");
        return false;
      }
      if (!secondaryDriverPhone?.trim()) {
        toast.error("Secondary driver phone number is required");
        return false;
      }
      const phoneDigits = formatPhoneStorage(secondaryDriverPhone);
      if (phoneDigits.length !== 10) {
        toast.error("Secondary driver phone number must be exactly 10 digits");
        return false;
      }
      if (!secondaryTruckNumber?.trim()) {
        toast.error("Secondary truck number is required");
        return false;
      }
      if (!secondaryTrailerNumber?.trim()) {
        toast.error("Secondary trailer number is required");
        return false;
      }
    }
    
    return true;
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Please enter a profile name");
      return;
    }

    if (!validateDriverInfo(true)) {
      return;
    }

    if (hasSecondaryDriver && !validateDriverInfo(false)) {
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/carrier/driver-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_name: profileName.trim(),
          driver_name: primaryDriverName,
          driver_phone: formatPhoneStorage(primaryDriverPhone),
          driver_email: primaryDriverEmail || null,
          driver_license_number: primaryDriverLicenseNumber || null,
          driver_license_state: primaryDriverLicenseState || null,
          truck_number: primaryTruckNumber || null,
          trailer_number: primaryTrailerNumber || null,
          second_driver_name: hasSecondaryDriver ? secondaryDriverName : null,
          second_driver_phone: hasSecondaryDriver ? formatPhoneStorage(secondaryDriverPhone) : null,
          second_driver_email: hasSecondaryDriver ? secondaryDriverEmail : null,
          second_driver_license_number: hasSecondaryDriver ? secondaryDriverLicenseNumber : null,
          second_driver_license_state: hasSecondaryDriver ? secondaryDriverLicenseState : null,
          second_truck_number: hasSecondaryDriver ? secondaryTruckNumber : null,
          second_trailer_number: hasSecondaryDriver ? secondaryTrailerNumber : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      toast.success("Driver profile saved successfully!");
      setProfileName("");
      mutateProfiles();

    } catch (error) {
      console.error('Error saving driver profile:', error);
      toast.error("Failed to save driver profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this driver profile?")) {
      return;
    }

    try {
      const response = await fetch(`/api/carrier/driver-profiles?id=${profileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete profile');
      }

      toast.success("Driver profile deleted successfully!");
      mutateProfiles();

      // Clear form if deleted profile was selected
      if (selectedProfileId === profileId) {
        setSelectedProfileId("");
      }

    } catch (error) {
      console.error('Error deleting driver profile:', error);
      toast.error("Failed to delete driver profile. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate primary driver
      if (!validateDriverInfo(true)) {
        return;
      }

      // Validate secondary driver if provided
      if (hasSecondaryDriver && !validateDriverInfo(false)) {
        return;
      }

      const requestBody = {
        driver_info: {
          // Primary driver info
          driver_name: primaryDriverName,
          driver_phone: formatPhoneStorage(primaryDriverPhone),
          driver_email: primaryDriverEmail || null,
          driver_license_number: primaryDriverLicenseNumber || null,
          driver_license_state: primaryDriverLicenseState || null,
          truck_number: primaryTruckNumber,
          trailer_number: primaryTrailerNumber,
          
          // Secondary driver info (if provided)
          second_driver_name: hasSecondaryDriver ? secondaryDriverName : null,
          second_driver_phone: hasSecondaryDriver ? formatPhoneStorage(secondaryDriverPhone) : null,
          second_driver_email: hasSecondaryDriver ? secondaryDriverEmail : null,
          second_driver_license_number: hasSecondaryDriver ? secondaryDriverLicenseNumber : null,
          second_driver_license_state: hasSecondaryDriver ? secondaryDriverLicenseState : null,
          second_truck_number: hasSecondaryDriver ? secondaryTruckNumber : null,
          second_trailer_number: hasSecondaryDriver ? secondaryTrailerNumber : null,
        },
        
        // Additional info
        location: location || null,
        notes: notes || null
      };

      console.log('🔍 Sending driver info:', requestBody);

      const response = await fetch(`/api/carrier/load-lifecycle/${loadId}/driver-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

  const PrimaryDriverSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Primary Driver</h3>
        <span className="text-sm font-normal text-muted-foreground">Required</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primary-driver-name">Driver Name *</Label>
          <Input
            id="primary-driver-name"
            value={primaryDriverName}
            onChange={(e) => setPrimaryDriverName(e.target.value)}
            placeholder="Enter driver's full name"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-driver-phone">Phone Number *</Label>
          <Input
            id="primary-driver-phone"
            value={primaryDriverPhone}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= 10) {
                setPrimaryDriverPhone(value);
              }
            }}
            placeholder="1234567890 or 123-456-7890"
            maxLength={12}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-driver-email">Email Address</Label>
          <Input
            id="primary-driver-email"
            value={primaryDriverEmail}
            onChange={(e) => setPrimaryDriverEmail(e.target.value)}
            placeholder="driver@example.com"
            type="email"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-driver-license">License Number</Label>
          <Input
            id="primary-driver-license"
            value={primaryDriverLicenseNumber}
            onChange={(e) => setPrimaryDriverLicenseNumber(e.target.value)}
            placeholder="D123456789"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-driver-license-state">License State</Label>
          <Input
            id="primary-driver-license-state"
            value={primaryDriverLicenseState}
            onChange={(e) => setPrimaryDriverLicenseState(e.target.value)}
            placeholder="CA"
            maxLength={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-truck-number">Truck Number *</Label>
          <Input
            id="primary-truck-number"
            value={primaryTruckNumber}
            onChange={(e) => setPrimaryTruckNumber(e.target.value)}
            placeholder="TRK-123 or 12345"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primary-trailer-number">Trailer Number *</Label>
          <Input
            id="primary-trailer-number"
            value={primaryTrailerNumber}
            onChange={(e) => setPrimaryTrailerNumber(e.target.value)}
            placeholder="TRL-456 or 67890"
            required
          />
        </div>
      </div>
    </div>
  );

  const SecondaryDriverSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Secondary Driver</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="secondary-driver-name">Driver Name *</Label>
          <Input
            id="secondary-driver-name"
            value={secondaryDriverName}
            onChange={(e) => setSecondaryDriverName(e.target.value)}
            placeholder="Enter driver's full name"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-driver-phone">Phone Number *</Label>
          <Input
            id="secondary-driver-phone"
            value={secondaryDriverPhone}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= 10) {
                setSecondaryDriverPhone(value);
              }
            }}
            placeholder="1234567890 or 123-456-7890"
            maxLength={12}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-driver-email">Email Address</Label>
          <Input
            id="secondary-driver-email"
            value={secondaryDriverEmail}
            onChange={(e) => setSecondaryDriverEmail(e.target.value)}
            placeholder="driver@example.com"
            type="email"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-driver-license">License Number</Label>
          <Input
            id="secondary-driver-license"
            value={secondaryDriverLicenseNumber}
            onChange={(e) => setSecondaryDriverLicenseNumber(e.target.value)}
            placeholder="D123456789"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-driver-license-state">License State</Label>
          <Input
            id="secondary-driver-license-state"
            value={secondaryDriverLicenseState}
            onChange={(e) => setSecondaryDriverLicenseState(e.target.value)}
            placeholder="CA"
            maxLength={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-truck-number">Truck Number *</Label>
          <Input
            id="secondary-truck-number"
            value={secondaryTruckNumber}
            onChange={(e) => setSecondaryTruckNumber(e.target.value)}
            placeholder="TRK-123 or 12345"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="secondary-trailer-number">Trailer Number *</Label>
          <Input
            id="secondary-trailer-number"
            value={secondaryTrailerNumber}
            onChange={(e) => setSecondaryTrailerNumber(e.target.value)}
            placeholder="TRL-456 or 67890"
            required
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Update Driver Information
          </DialogTitle>
          <DialogDescription>
            Update driver information for load {loadId}. This information will be tracked in the load timeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Driver Profile Management */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Driver Profiles</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-select">Select Existing Profile</Label>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{profile.profile_name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile.id);
                            }}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile-name">Save as New Profile</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Profile name (e.g., John Smith - Primary)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !profileName.trim()}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Driver */}
          <PrimaryDriverSection />

          {/* Secondary Driver Toggle */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant={hasSecondaryDriver ? "default" : "outline"}
              size="sm"
              onClick={() => setHasSecondaryDriver(!hasSecondaryDriver)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {hasSecondaryDriver ? "Remove" : "Add"} Secondary Driver
            </Button>
          </div>

          {/* Secondary Driver */}
          {hasSecondaryDriver && (
            <SecondaryDriverSection />
          )}

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
      </DialogContent>
    </Dialog>
  );
}