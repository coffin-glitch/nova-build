"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { updateCarrierProfile } from "@/lib/actions";

interface CarrierProfile {
  mc_number?: string;
  dot_number?: string;
  phone?: string;
  dispatch_email?: string;
}

interface ProfileFormProps {
  profile: CarrierProfile | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { user } = useUser();
  const [formData, setFormData] = useState({
    mc_number: profile?.mc_number || "",
    dot_number: profile?.dot_number || "",
    phone: profile?.phone || "",
    dispatch_email: profile?.dispatch_email || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append("mc_number", formData.mc_number);
      formDataObj.append("dot_number", formData.dot_number);
      formDataObj.append("phone", formData.phone);
      formDataObj.append("dispatch_email", formData.dispatch_email);

      const result = await updateCarrierProfile(formDataObj);
      
      if (result.success) {
        alert("Profile updated successfully!");
      } else {
        alert("Failed to update profile. Please try again.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="card-premium p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Carrier Information</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="mc_number" className="text-sm font-medium text-muted-foreground">
              MC Number
            </Label>
            <Input
              id="mc_number"
              value={formData.mc_number}
              onChange={(e) => handleInputChange("mc_number", e.target.value)}
              placeholder="Enter MC number"
              className="mt-1 input-premium"
            />
          </div>
          
          <div>
            <Label htmlFor="dot_number" className="text-sm font-medium text-muted-foreground">
              DOT Number
            </Label>
            <Input
              id="dot_number"
              value={formData.dot_number}
              onChange={(e) => handleInputChange("dot_number", e.target.value)}
              placeholder="Enter DOT number"
              className="mt-1 input-premium"
            />
          </div>
          
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground">
              Phone Number
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="Enter phone number"
              className="mt-1 input-premium"
            />
          </div>
          
          <div>
            <Label htmlFor="dispatch_email" className="text-sm font-medium text-muted-foreground">
              Dispatch Email
            </Label>
            <Input
              id="dispatch_email"
              type="email"
              value={formData.dispatch_email}
              onChange={(e) => handleInputChange("dispatch_email", e.target.value)}
              placeholder="Enter dispatch email"
              className="mt-1 input-premium"
            />
          </div>
          
          <Button 
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
