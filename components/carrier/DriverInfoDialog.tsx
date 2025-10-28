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
  isBid?: boolean; // New prop to indicate if this is for a bid
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
  onSuccess,
  isBid = false
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

  // Secondary driver information
  const [secondDriverName, setSecondDriverName] = useState("");
  const [secondDriverPhone, setSecondDriverPhone] = useState("");
  const [secondDriverEmail, setSecondDriverEmail] = useState("");
  const [secondDriverLicenseNumber, setSecondDriverLicenseNumber] = useState("");
  const [secondDriverLicenseState, setSecondDriverLicenseState] = useState("");
  const [secondTruckNumber, setSecondTruckNumber] = useState("");
  const [secondTrailerNumber, setSecondTrailerNumber] = useState("");

  // Additional information
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [showSecondDriver, setShowSecondDriver] = useState(false);

  // Profile selection state
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedSecondProfile, setSelectedSecondProfile] = useState<string | null>(null);

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
      setSecondDriverName("");
      setSecondDriverPhone("");
      setSecondDriverEmail("");
      setSecondDriverLicenseNumber("");
      setSecondDriverLicenseState("");
      setSecondTruckNumber("");
      setSecondTrailerNumber("");
      setLocation("");
      setNotes("");
      setShowSecondDriver(false);
      setSelectedProfile(null);
      setSelectedSecondProfile(null);
      setShowProfileManager(false);
      setNewProfileName("");
    }
  }, [isOpen]);

  const loadDriverInfo = async () => {
    setIsLoading(true);
    try {
      const endpoint = isBid 
        ? `/api/carrier/bids/${loadId}/driver-info`
        : `/api/carrier/loads/${loadId}/driver-info`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data) {
          const info = data.data;
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

  const loadSecondProfile = (profile: DriverProfile) => {
    setSecondDriverName(profile.driver_name);
    setSecondDriverPhone(formatPhoneDisplay(profile.driver_phone));
    setSecondDriverEmail(profile.driver_email || "");
    setSecondDriverLicenseNumber(profile.driver_license_number || "");
    setSecondDriverLicenseState(profile.driver_license_state || "");
    setSecondTruckNumber(profile.truck_number || "");
    setSecondTrailerNumber(profile.trailer_number || "");
    toast.success(`Loaded second driver profile: ${profile.profile_name}`);
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
      const endpoint = isBid 
        ? `/api/carrier/bids/${loadId}/driver-info`
        : `/api/carrier/loads/${loadId}/driver-info`;
      
      const response = await fetch(endpoint, {
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
          second_driver_name: secondDriverName || null,
          second_driver_phone: secondDriverPhone || null,
          second_driver_email: secondDriverEmail || null,
          second_driver_license_number: secondDriverLicenseNumber || null,
          second_driver_license_state: secondDriverLicenseState || null,
          second_truck_number: secondTruckNumber || null,
          second_trailer_number: secondTrailerNumber || null,
          location: location || null,
          notes: notes || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update driver information');
      }

      const result = await response.json();
      
      // If this is a bid, create a driver info update timeline event
      if (isBid) {
        try {
          const statusResponse = await fetch(`/api/carrier/bid-lifecycle/${loadId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'driver_info_update',
              notes: notes || 'Driver information updated',
              location: location || null,
              driver_name: driverName,
              driver_phone: driverPhone,
              driver_email: driverEmail || null,
              driver_license_number: driverLicenseNumber || null,
              driver_license_state: driverLicenseState || null,
              truck_number: truckNumber,
              trailer_number: trailerNumber,
              second_driver_name: secondDriverName || null,
              second_driver_phone: secondDriverPhone || null,
              second_driver_email: secondDriverEmail || null,
              second_driver_license_number: secondDriverLicenseNumber || null,
              second_driver_license_state: secondDriverLicenseState || null,
              second_truck_number: secondTruckNumber || null,
              second_trailer_number: secondTrailerNumber || null
            }),
          });

          if (statusResponse.ok) {
            toast.success("Driver information updated successfully!");
          } else {
            toast.success("Driver information updated successfully!");
          }
        } catch (statusError) {
          console.error('Error updating timeline:', statusError);
          toast.success("Driver information updated successfully!");
        }
      } else {
        toast.success("Driver information updated successfully!");
      }
      
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

                {/* Primary Driver Profile Selection */}
                <div className="space-y-2">
                  <Label htmlFor="primary-profile">Driver Profile</Label>
                  <Select onValueChange={(value) => {
                    setSelectedProfile(value);
                    const profile = profiles.find(p => p.id === value);
                    if (profile) loadProfile(profile);
                  }} value={selectedProfile || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver profile (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profile_name} ({profile.driver_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              {/* Secondary Driver Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Secondary Driver Information (Optional)</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecondDriver(!showSecondDriver)}
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    {showSecondDriver ? 'Hide' : 'Add'} Second Driver
                  </Button>
                </div>
                
                {showSecondDriver && (
                  <>
                    {/* Second Driver Profile Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="second-profile">Second Driver Profile</Label>
                      <Select onValueChange={(value) => {
                        setSelectedSecondProfile(value);
                        const profile = profiles.find(p => p.id === value);
                        if (profile) loadSecondProfile(profile);
                      }} value={selectedSecondProfile || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a driver profile (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.profile_name} ({profile.driver_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="secondDriverName">Second Driver Name</Label>
                      <Input
                        id="secondDriverName"
                        value={secondDriverName}
                        onChange={(e) => setSecondDriverName(e.target.value)}
                        placeholder="Enter second driver name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondDriverPhone">Second Driver Phone</Label>
                      <Input
                        id="secondDriverPhone"
                        value={secondDriverPhone}
                        onChange={(e) => setSecondDriverPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondDriverEmail">Second Driver Email</Label>
                      <Input
                        id="secondDriverEmail"
                        type="email"
                        value={secondDriverEmail}
                        onChange={(e) => setSecondDriverEmail(e.target.value)}
                        placeholder="driver@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondDriverLicenseNumber">Second Driver License Number</Label>
                      <Input
                        id="secondDriverLicenseNumber"
                        value={secondDriverLicenseNumber}
                        onChange={(e) => setSecondDriverLicenseNumber(e.target.value)}
                        placeholder="Enter license number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondDriverLicenseState">Second Driver License State</Label>
                      <Select
                        value={secondDriverLicenseState}
                        onValueChange={setSecondDriverLicenseState}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AL">Alabama</SelectItem>
                          <SelectItem value="AK">Alaska</SelectItem>
                          <SelectItem value="AZ">Arizona</SelectItem>
                          <SelectItem value="AR">Arkansas</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="CO">Colorado</SelectItem>
                          <SelectItem value="CT">Connecticut</SelectItem>
                          <SelectItem value="DE">Delaware</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="GA">Georgia</SelectItem>
                          <SelectItem value="HI">Hawaii</SelectItem>
                          <SelectItem value="ID">Idaho</SelectItem>
                          <SelectItem value="IL">Illinois</SelectItem>
                          <SelectItem value="IN">Indiana</SelectItem>
                          <SelectItem value="IA">Iowa</SelectItem>
                          <SelectItem value="KS">Kansas</SelectItem>
                          <SelectItem value="KY">Kentucky</SelectItem>
                          <SelectItem value="LA">Louisiana</SelectItem>
                          <SelectItem value="ME">Maine</SelectItem>
                          <SelectItem value="MD">Maryland</SelectItem>
                          <SelectItem value="MA">Massachusetts</SelectItem>
                          <SelectItem value="MI">Michigan</SelectItem>
                          <SelectItem value="MN">Minnesota</SelectItem>
                          <SelectItem value="MS">Mississippi</SelectItem>
                          <SelectItem value="MO">Missouri</SelectItem>
                          <SelectItem value="MT">Montana</SelectItem>
                          <SelectItem value="NE">Nebraska</SelectItem>
                          <SelectItem value="NV">Nevada</SelectItem>
                          <SelectItem value="NH">New Hampshire</SelectItem>
                          <SelectItem value="NJ">New Jersey</SelectItem>
                          <SelectItem value="NM">New Mexico</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                          <SelectItem value="NC">North Carolina</SelectItem>
                          <SelectItem value="ND">North Dakota</SelectItem>
                          <SelectItem value="OH">Ohio</SelectItem>
                          <SelectItem value="OK">Oklahoma</SelectItem>
                          <SelectItem value="OR">Oregon</SelectItem>
                          <SelectItem value="PA">Pennsylvania</SelectItem>
                          <SelectItem value="RI">Rhode Island</SelectItem>
                          <SelectItem value="SC">South Carolina</SelectItem>
                          <SelectItem value="SD">South Dakota</SelectItem>
                          <SelectItem value="TN">Tennessee</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="UT">Utah</SelectItem>
                          <SelectItem value="VT">Vermont</SelectItem>
                          <SelectItem value="VA">Virginia</SelectItem>
                          <SelectItem value="WA">Washington</SelectItem>
                          <SelectItem value="WV">West Virginia</SelectItem>
                          <SelectItem value="WI">Wisconsin</SelectItem>
                          <SelectItem value="WY">Wyoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondTruckNumber">Second Truck Number</Label>
                      <Input
                        id="secondTruckNumber"
                        value={secondTruckNumber}
                        onChange={(e) => setSecondTruckNumber(e.target.value)}
                        placeholder="Enter truck number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondTrailerNumber">Second Trailer Number</Label>
                      <Input
                        id="secondTrailerNumber"
                        value={secondTrailerNumber}
                        onChange={(e) => setSecondTrailerNumber(e.target.value)}
                        placeholder="Enter trailer number"
                      />
                    </div>
                  </div>
                  </>
                )}
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