"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DollarSign, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";

interface OfferDialogProps {
  loadRrNumber: string;
  loadDetails: {
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    revenue?: number;
    equipment?: string;
  };
  onOfferSubmitted?: () => void;
}

export default function OfferDialog({ loadRrNumber, loadDetails, onOfferSubmitted }: OfferDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();

  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };

  const formatRoute = () => {
    const origin = loadDetails.origin_city && loadDetails.origin_state 
      ? `${loadDetails.origin_city}, ${loadDetails.origin_state}` 
      : "Origin TBD";
    const destination = loadDetails.destination_city && loadDetails.destination_state 
      ? `${loadDetails.destination_city}, ${loadDetails.destination_state}` 
      : "Destination TBD";
    return `${origin} → ${destination}`;
  };

  const formatPrice = (amount?: number) => {
    if (!amount) return "Rate TBD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (!offerAmount || isNaN(Number(offerAmount))) {
      toast.error("Please enter a valid offer amount");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loadRrNumber,
          offerAmount: Math.round(Number(offerAmount) * 100), // Convert to cents
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit offer');
      }

      toast.success("Offer submitted successfully!");
      setIsOpen(false);
      setOfferAmount("");
      setNotes("");
      onOfferSubmitted?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="transition-colors"
          style={{ 
            backgroundColor: accentColor,
            color: getButtonTextColor()
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor}dd`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = accentColor;
          }}
        >
          Book Load
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Submit Offer
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Load Details */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm font-medium text-foreground mb-1">
              {formatRoute()}
            </div>
            <div className="text-xs text-muted-foreground">
              Equipment: {loadDetails.equipment || "TBD"} • 
              Listed Rate: {formatPrice(loadDetails.revenue)}
            </div>
          </div>

          {/* Offer Amount */}
          <div className="space-y-2">
            <Label htmlFor="offerAmount">Your Offer Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="offerAmount"
                type="number"
                placeholder="Enter your offer"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="pl-10"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional information about your offer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !offerAmount}
              className="transition-colors"
              style={{ 
                backgroundColor: accentColor,
                color: getButtonTextColor()
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}dd`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = accentColor;
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Offer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

