"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUser } from "@clerk/nextjs";
import {
    AlertCircle,
    Building2,
    CheckCircle,
    Edit3,
    Phone,
    Save,
    Truck,
    User
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface CarrierProfile {
  id: string;
  clerk_user_id: string;
  legal_name: string;
  mc_number: string;
  dot_number: string;
  contact_name: string;
  phone: string;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  lock_reason?: string;
  created_at: string;
  updated_at: string;
}

export function CarrierProfileClient() {
  const { user } = useUser();
  const { accentColor } = useAccentColor();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data, mutate } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null }
    }
  );

  const profile = data?.data;

  const [formData, setFormData] = useState<Partial<CarrierProfile>>({
    legal_name: "",
    mc_number: "",
    dot_number: "",
    contact_name: "",
    phone: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        contact_name: user.fullName || ""
      }));
    }
  }, [profile, user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/carrier/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
        mutate();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isProfileComplete = () => {
    return formData.legal_name && 
           formData.mc_number && 
           formData.contact_name && 
           formData.phone;
  };

  const getCompletionPercentage = () => {
    const requiredFields = ['legal_name', 'mc_number', 'contact_name', 'phone'];
    const completedFields = requiredFields.filter(field => formData[field as keyof typeof formData]);
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  return (
    <div className="space-y-6">
             {/* Profile Completion Status */}
             <Card className={`border-l-4 ${profile?.is_locked ? 'border-l-red-500' : 'border-l-blue-500'}`}>
               <CardContent className="p-6">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     {profile?.is_locked ? (
                       <AlertCircle className="h-6 w-6 text-red-500" />
                     ) : isProfileComplete() ? (
                       <CheckCircle className="h-6 w-6 text-green-500" />
                     ) : (
                       <AlertCircle className="h-6 w-6 text-orange-500" />
                     )}
                     <div>
                       <h3 className="font-semibold">
                         {profile?.is_locked ? "Profile Locked" : 
                          isProfileComplete() ? "Profile Complete" : "Complete Your Profile"}
                       </h3>
                       <p className="text-sm text-muted-foreground">
                         {profile?.is_locked 
                           ? "Your profile has been locked by an administrator. Contact support for changes."
                           : isProfileComplete() 
                             ? "Your profile is complete and you can start bidding on loads."
                             : `${getCompletionPercentage()}% complete. Complete your profile to start bidding.`
                         }
                       </p>
                       {profile?.is_locked && profile?.lock_reason && (
                         <p className="text-xs text-red-600 mt-1">
                           Reason: {profile.lock_reason}
                         </p>
                       )}
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-2xl font-bold">{getCompletionPercentage()}%</div>
                     <div className="text-sm text-muted-foreground">Complete</div>
                   </div>
                 </div>
               </CardContent>
             </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Company Information</CardTitle>
            </div>
                   <Button
                     variant="outline"
                     onClick={() => setIsEditing(!isEditing)}
                     disabled={isLoading || profile?.is_locked}
                     className={isEditing ? "opacity-50 cursor-not-allowed" : ""}
                   >
                     <Edit3 className="h-4 w-4 mr-2" />
                     {profile?.is_locked ? "Profile Locked" : "Edit Profile"}
                   </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Company Name *</Label>
                       <Input
                         id="legal_name"
                         value={formData.legal_name || ""}
                         onChange={(e) => handleInputChange("legal_name", e.target.value)}
                         disabled={!isEditing || profile?.is_locked}
                         placeholder="Enter your company name"
                       />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name *</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name || ""}
                  onChange={(e) => handleInputChange("contact_name", e.target.value)}
                  disabled={!isEditing || profile?.is_locked}
                  placeholder="Enter contact person name"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          {/* Carrier Credentials */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Carrier Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mc_number">MC Number *</Label>
                       <Input
                         id="mc_number"
                         value={formData.mc_number || ""}
                         onChange={(e) => handleInputChange("mc_number", e.target.value)}
                         disabled={!isEditing || profile?.is_locked}
                         placeholder="Enter MC number"
                       />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dot_number">DOT Number</Label>
                <Input
                  id="dot_number"
                  value={formData.dot_number || ""}
                  onChange={(e) => handleInputChange("dot_number", e.target.value)}
                  disabled={!isEditing || profile?.is_locked}
                  placeholder="Enter DOT number (if applicable)"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                       <Input
                         id="phone"
                         value={formData.phone || ""}
                         onChange={(e) => handleInputChange("phone", e.target.value)}
                         disabled={!isEditing || profile?.is_locked}
                         placeholder="Enter phone number"
                       />
              </div>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && !profile?.is_locked && (
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                style={{ backgroundColor: accentColor }}
                className="px-8"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Status */}
      {profile && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Profile Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(profile.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge variant="default">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
