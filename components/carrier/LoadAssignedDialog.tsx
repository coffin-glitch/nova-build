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
import { MapPin, Save, Truck, User } from "lucide-react";
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

interface LoadAssignedDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bidId: string;
  onSuccess: () => void;
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return "";
  if (phone.length === 10) {
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

function formatPhoneStorage(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function LoadAssignedDialog({
  isOpen,
  onOpenChange,
  bidId,
  onSuccess
}: LoadAssignedDialogProps) {
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

  const loadProfile = (profile: DriverProfile) => {
    setDriverName(profile.driver_name);
    setDriverPhone(formatPhoneDisplay(profile.driver_phone));
    setDriverEmail(profile.driver_email || "");
    setDriverLicenseNumber(profile.driver_license_number || "");
    setDriverLicenseState(profile.driver_license_state || "");
    setTruckNumber(profile.truck_number || "");
    setTrailerNumber(profile.trailer_number || "");
    setSecondDriverName(profile.second_driver_name || "");
    setSecondDriverPhone(formatPhoneDisplay(profile.second_driver_phone || ""));
    setSecondDriverEmail(profile.second_driver_email || "");
    setSecondDriverLicenseNumber(profile.second_driver_license_number || "");
    setSecondDriverLicenseState(profile.second_driver_license_state || "");
    setSecondTruckNumber(profile.second_truck_number || "");
    setSecondTrailerNumber(profile.second_trailer_number || "");
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

    try {
      const response = await fetch("/api/carrier/driver-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_name: newProfileName.trim(),
          driver_name: driverName,
          driver_phone: formatPhoneStorage(driverPhone),
          driver_email: driverEmail || null,
          driver_license_number: driverLicenseNumber || null,
          driver_license_state: driverLicenseState || null,
          truck_number: truckNumber || null,
          trailer_number: trailerNumber || null,
          second_driver_name: secondDriverName || null,
          second_driver_phone: secondDriverPhone ? formatPhoneStorage(secondDriverPhone) : null,
          second_driver_email: secondDriverEmail || null,
          second_driver_license_number: secondDriverLicenseNumber || null,
          second_driver_license_state: secondDriverLicenseState || null,
          second_truck_number: secondTruckNumber || null,
          second_trailer_number: secondTrailerNumber || null,
        }),
      });

      if (response.ok) {
        toast.success("Profile saved successfully!");
        mutateProfiles();
        setNewProfileName("");
        setShowProfileManager(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    }
  };

  const handleSubmit = async () => {
    if (!driverName.trim() || !driverPhone.trim()) {
      toast.error("Driver name and phone number are required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit driver information and update status to load_assigned
      const response = await fetch(`/api/carrier/bid-lifecycle/${bidId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'load_assigned',
          notes: notes || 'Load assigned with driver information',
          location: location || null,
          driver_name: driverName,
          driver_phone: formatPhoneStorage(driverPhone),
          driver_email: driverEmail || null,
          driver_license_number: driverLicenseNumber || null,
          driver_license_state: driverLicenseState || null,
          truck_number: truckNumber || null,
          trailer_number: trailerNumber || null,
          second_driver_name: secondDriverName || null,
          second_driver_phone: secondDriverPhone ? formatPhoneStorage(secondDriverPhone) : null,
          second_driver_email: secondDriverEmail || null,
          second_driver_license_number: secondDriverLicenseNumber || null,
          second_driver_license_state: secondDriverLicenseState || null,
          second_truck_number: secondTruckNumber || null,
          second_trailer_number: secondTrailerNumber || null
        }),
      });

      if (response.ok) {
        toast.success("Load assigned successfully!");
        onSuccess();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign load");
      }
    } catch (error) {
      console.error('Error assigning load:', error);
      toast.error("Failed to assign load");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Mark as Load Assigned
          </DialogTitle>
          <DialogDescription>
            Assign driver information to this load and update the status to "Load Assigned".
            This will create the initial driver assignment timeline event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Driver Profile Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Driver Profiles
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfileManager(!showProfileManager)}
              >
                {showProfileManager ? "Hide Profiles" : "Manage Profiles"}
              </Button>
            </div>

            {showProfileManager && (
              <div className="border rounded-lg p-4 space-y-4">
                <DriverProfileManager
                  profiles={profiles}
                  onProfileSelect={loadProfile}
                  onProfilesUpdate={mutateProfiles}
                />
                
                {/* Quick Profile Load */}
                {profiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>Quick Load Profile</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {profiles.map((profile) => (
                        <Button
                          key={profile.id}
                          variant="outline"
                          size="sm"
                          onClick={() => loadProfile(profile)}
                          className="justify-start"
                        >
                          {profile.profile_name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save Current as Profile */}
                <div className="space-y-2">
                  <Label>Save Current Information as Profile</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Profile name"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                    />
                    <Button onClick={saveProfile} disabled={!newProfileName.trim()}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Profile
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Primary Driver Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Primary Driver Information</h3>
            
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
                <Label htmlFor="driverName">Driver Name *</Label>
                <Input
                  id="driverName"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Enter driver name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverPhone">Phone Number *</Label>
                <Input
                  id="driverPhone"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverEmail">Email</Label>
                <Input
                  id="driverEmail"
                  type="email"
                  value={driverEmail}
                  onChange={(e) => setDriverEmail(e.target.value)}
                  placeholder="driver@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverLicenseNumber">License Number</Label>
                <Input
                  id="driverLicenseNumber"
                  value={driverLicenseNumber}
                  onChange={(e) => setDriverLicenseNumber(e.target.value)}
                  placeholder="Enter license number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverLicenseState">License State</Label>
                <Select value={driverLicenseState} onValueChange={setDriverLicenseState}>
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
            </div>
          </div>

          {/* Equipment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Equipment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truckNumber">Truck Number</Label>
                <Input
                  id="truckNumber"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  placeholder="Enter truck number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trailerNumber">Trailer Number</Label>
                <Input
                  id="trailerNumber"
                  value={trailerNumber}
                  onChange={(e) => setTrailerNumber(e.target.value)}
                  placeholder="Enter trailer number"
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
                <Select value={secondDriverLicenseState} onValueChange={setSecondDriverLicenseState}>
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

          <Separator />

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Additional Information
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Current Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter current location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !driverName.trim() || !driverPhone.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Assigning Load...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  Mark as Load Assigned
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
