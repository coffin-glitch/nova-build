"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Load } from "@/types/load";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface LoadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: Load | null;
  onSuccess?: () => void;
}

export function LoadEditDialog({ open, onOpenChange, load, onSuccess }: LoadEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Load>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when load changes
  useEffect(() => {
    if (load) {
      setFormData({
        tm_number: load.tm_number || '',
        status_code: load.status_code || '',
        pickup_date: load.pickup_date ? load.pickup_date.split('T')[0] : '',
        pickup_time: load.pickup_time || '',
        delivery_date: load.delivery_date ? load.delivery_date.split('T')[0] : '',
        delivery_time: load.delivery_time || '',
        equipment: load.equipment || '',
        weight: load.weight || '',
        stops: load.stops || '',
        total_miles: load.total_miles || '',
        customer_name: load.customer_name || '',
        customer_ref: load.customer_ref || '',
        driver_name: load.driver_name || '',
        vendor_name: load.vendor_name || '',
        dispatcher_name: load.dispatcher_name || '',
        revenue: load.revenue || '',
        target_buy: load.target_buy || '',
        max_buy: load.max_buy || '',
        purchase: load.purchase || '',
        net: load.net || '',
        margin: load.margin || '',
        spot_bid: load.spot_bid || '',
        fuel_surcharge: load.fuel_surcharge || '',
        purch_tr: load.purch_tr || '',
        net_mrg: load.net_mrg || '',
        cm: load.cm || '',
        docs_scanned: load.docs_scanned || '',
        invoice_date: load.invoice_date ? load.invoice_date.split('T')[0] : '',
        invoice_audit: load.invoice_audit || '',
        nbr_of_stops: load.nbr_of_stops || '',
        vendor_dispatch: load.vendor_dispatch || '',
        published: load.published || false
      });
    }
  }, [load]);

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!load) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/loads/${load.rr_number}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Load updated successfully!");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to update load");
      }
    } catch (error) {
      console.error("Error updating load:", error);
      toast.error("Failed to update load");
    } finally {
      setIsSaving(false);
    }
  };

  if (!load) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Edit Load - #{load.rr_number}
          </DialogTitle>
          <DialogDescription>
            Update load information and EAX fields
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="eax">EAX Fields</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tm_number">TM Number</Label>
                <Input
                  id="tm_number"
                  value={formData.tm_number}
                  onChange={(e) => handleInputChange("tm_number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment</Label>
                <Input
                  id="equipment"
                  value={formData.equipment}
                  onChange={(e) => handleInputChange("equipment", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup_date">Pickup Date</Label>
                <Input
                  id="pickup_date"
                  type="date"
                  value={formData.pickup_date}
                  onChange={(e) => handleInputChange("pickup_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup_time">Pickup Time</Label>
                <Input
                  id="pickup_time"
                  value={formData.pickup_time}
                  onChange={(e) => handleInputChange("pickup_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_date">Delivery Date</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => handleInputChange("delivery_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_time">Delivery Time</Label>
                <Input
                  id="delivery_time"
                  value={formData.delivery_time}
                  onChange={(e) => handleInputChange("delivery_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_miles">Total Miles</Label>
                <Input
                  id="total_miles"
                  type="number"
                  value={formData.total_miles}
                  onChange={(e) => handleInputChange("total_miles", parseInt(e.target.value) || '')}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">Revenue ($)</Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  value={formData.revenue}
                  onChange={(e) => handleInputChange("revenue", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_buy">Target Buy ($)</Label>
                <Input
                  id="target_buy"
                  type="number"
                  step="0.01"
                  value={formData.target_buy}
                  onChange={(e) => handleInputChange("target_buy", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_buy">Max Buy ($)</Label>
                <Input
                  id="max_buy"
                  type="number"
                  step="0.01"
                  value={formData.max_buy}
                  onChange={(e) => handleInputChange("max_buy", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spot_bid">Spot Bid ($)</Label>
                <Input
                  id="spot_bid"
                  type="number"
                  step="0.01"
                  value={formData.spot_bid}
                  onChange={(e) => handleInputChange("spot_bid", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel_surcharge">Fuel Surcharge ($)</Label>
                <Input
                  id="fuel_surcharge"
                  type="number"
                  step="0.01"
                  value={formData.fuel_surcharge}
                  onChange={(e) => handleInputChange("fuel_surcharge", parseFloat(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase">Purchase ($)</Label>
                <Input
                  id="purchase"
                  type="number"
                  step="0.01"
                  value={formData.purchase}
                  onChange={(e) => handleInputChange("purchase", parseFloat(e.target.value) || '')}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="eax" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange("customer_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_ref">Customer Ref#</Label>
                <Input
                  id="customer_ref"
                  value={formData.customer_ref}
                  onChange={(e) => handleInputChange("customer_ref", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver_name">Driver Name</Label>
                <Input
                  id="driver_name"
                  value={formData.driver_name}
                  onChange={(e) => handleInputChange("driver_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispatcher_name">Dispatcher</Label>
                <Input
                  id="dispatcher_name"
                  value={formData.dispatcher_name}
                  onChange={(e) => handleInputChange("dispatcher_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_dispatch">Vendor Dispatch</Label>
                <Input
                  id="vendor_dispatch"
                  value={formData.vendor_dispatch}
                  onChange={(e) => handleInputChange("vendor_dispatch", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nbr_of_stops">Number of Stops</Label>
                <Input
                  id="nbr_of_stops"
                  type="number"
                  value={formData.nbr_of_stops}
                  onChange={(e) => handleInputChange("nbr_of_stops", parseInt(e.target.value) || '')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docs_scanned">Docs Scanned</Label>
                <Input
                  id="docs_scanned"
                  value={formData.docs_scanned}
                  onChange={(e) => handleInputChange("docs_scanned", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange("invoice_date", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status_code">Status Code</Label>
                <select
                  id="status_code"
                  value={formData.status_code}
                  onChange={(e) => handleInputChange("status_code", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Select Status</option>
                  <option value="active">Active</option>
                  <option value="published">Published</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="published">Published</Label>
                <select
                  id="published"
                  value={formData.published ? 'true' : 'false'}
                  onChange={(e) => handleInputChange("published", e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="false">Not Published</option>
                  <option value="true">Published</option>
                </select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
