"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Mail, 
  Phone, 
  Truck,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Save,
  X
} from "lucide-react";
import { toast } from "sonner";
import { updateCarrierProfile } from "@/lib/actions";

interface Profile {
  mc_number?: string;
  dot_number?: string;
  phone?: string;
  dispatch_email?: string;
}

interface ProfileClientProps {
  initialProfile: Profile;
  userRole: string;
}

export function ProfileClient({ initialProfile, userRole }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await updateCarrierProfile(formData);
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(initialProfile);
    setIsEditing(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Profile Information */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Profile Information</h2>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="btn-primary"
                    form="profile-form"
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <form id="profile-form" action={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mc_number">MC Number</Label>
                <Input
                  id="mc_number"
                  name="mc_number"
                  value={profile.mc_number || ""}
                  onChange={(e) => setProfile({ ...profile, mc_number: e.target.value })}
                  disabled={!isEditing}
                  className="input-premium"
                  placeholder="Enter MC number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dot_number">DOT Number</Label>
                <Input
                  id="dot_number"
                  name="dot_number"
                  value={profile.dot_number || ""}
                  onChange={(e) => setProfile({ ...profile, dot_number: e.target.value })}
                  disabled={!isEditing}
                  className="input-premium"
                  placeholder="Enter DOT number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  disabled={!isEditing}
                  className="input-premium"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dispatch_email">Dispatch Email</Label>
                <Input
                  id="dispatch_email"
                  name="dispatch_email"
                  type="email"
                  value={profile.dispatch_email || ""}
                  onChange={(e) => setProfile({ ...profile, dispatch_email: e.target.value })}
                  disabled={!isEditing}
                  className="input-premium"
                  placeholder="Enter dispatch email"
                />
              </div>
            </div>
          </form>
        </Card>

        {/* Activity Stats */}
        <Card className="card-premium p-6">
          <h2 className="text-xl font-semibold color: hsl(var(--foreground)) mb-6">Activity Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="text-2xl font-bold color: hsl(var(--foreground))">12</div>
              <div className="text-sm text-muted-foreground">Offers Submitted</div>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-2xl font-bold color: hsl(var(--foreground))">3</div>
              <div className="text-sm text-muted-foreground">Accepted Offers</div>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto">
                <Truck className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-2xl font-bold color: hsl(var(--foreground))">8</div>
              <div className="text-sm text-muted-foreground">Active Loads</div>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto">
                <DollarSign className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-2xl font-bold color: hsl(var(--foreground))">$24,500</div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Account Info */}
      <div className="space-y-6">
        <Card className="card-premium p-6">
          <h2 className="text-xl font-semibold color: hsl(var(--foreground)) mb-4">Account Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Role</div>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="text-sm font-medium">user@example.com</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Member Since</div>
                <div className="text-sm font-medium">January 2025</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <h2 className="text-xl font-semibold color: hsl(var(--foreground)) mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Offer accepted</div>
                <div className="text-xs text-muted-foreground">Load #12345 - $2,850</div>
              </div>
              <div className="text-xs text-muted-foreground">2 hours ago</div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <FileText className="w-4 h-4 text-blue-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">New offer submitted</div>
                <div className="text-xs text-muted-foreground">Load #12346 - $3,200</div>
              </div>
              <div className="text-xs text-muted-foreground">1 day ago</div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Truck className="w-4 h-4 text-orange-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Load completed</div>
                <div className="text-xs text-muted-foreground">Load #12344 - $2,100</div>
              </div>
              <div className="text-xs text-muted-foreground">3 days ago</div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <h2 className="text-xl font-semibold color: hsl(var(--foreground)) mb-4">Account Actions</h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <User className="w-4 h-4 mr-2" />
              Edit Account
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Mail className="w-4 h-4 mr-2" />
              Change Email
            </Button>
            <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600">
              <X className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
