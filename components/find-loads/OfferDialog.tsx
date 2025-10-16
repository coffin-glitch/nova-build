"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import { DollarSign, MessageSquare, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

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
  const [validationErrors, setValidationErrors] = useState<{
    offerAmount?: string;
    notes?: string;
  }>({});
  
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

  // Validation functions
  const validateOfferAmount = (amount: string): string | undefined => {
    if (!amount.trim()) {
      return "Offer amount is required";
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return "Please enter a valid number";
    }

    if (numAmount <= 0) {
      return "Offer amount must be greater than $0";
    }

    // Minimum offer amount (e.g., $100)
    const minAmount = 100;
    if (numAmount < minAmount) {
      return `Minimum offer amount is $${minAmount}`;
    }

    // Maximum offer amount (e.g., $50,000)
    const maxAmount = 50000;
    if (numAmount > maxAmount) {
      return `Maximum offer amount is $${maxAmount.toLocaleString()}`;
    }

    // Check if offer is significantly below listed rate (if available)
    if (loadDetails.revenue && numAmount < loadDetails.revenue * 0.5) {
      return `Offer is significantly below listed rate (${formatPrice(loadDetails.revenue)}). Consider increasing your offer.`;
    }

    return undefined;
  };

  const validateNotes = (notes: string): string | undefined => {
    if (notes.length > 500) {
      return "Notes cannot exceed 500 characters";
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: { offerAmount?: string; notes?: string } = {};
    
    const offerError = validateOfferAmount(offerAmount);
    if (offerError) errors.offerAmount = offerError;
    
    const notesError = validateNotes(notes);
    if (notesError) errors.notes = notesError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOfferAmountChange = (value: string) => {
    setOfferAmount(value);
    // Clear validation error when user starts typing
    if (validationErrors.offerAmount) {
      setValidationErrors(prev => ({ ...prev, offerAmount: undefined }));
    }
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    // Clear validation error when user starts typing
    if (validationErrors.notes) {
      setValidationErrors(prev => ({ ...prev, notes: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix the validation errors before submitting");
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
          offerAmount: Math.round(parseFloat(offerAmount) * 100), // Convert dollars to cents
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
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        // Reset form when dialog is closed
        setOfferAmount("");
        setNotes("");
        setValidationErrors({});
      }
    }}>
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
          <DialogDescription>
            Submit your offer for this load. Your offer will be reviewed by the broker.
          </DialogDescription>
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
                onChange={(e) => handleOfferAmountChange(e.target.value)}
                className={`pl-10 ${validationErrors.offerAmount ? 'border-red-500 focus:border-red-500' : ''}`}
                min="0"
                step="0.01"
              />
            </div>
            {validationErrors.offerAmount && (
              <p className="text-sm text-red-600">{validationErrors.offerAmount}</p>
            )}
            {loadDetails.revenue && (
              <p className="text-xs text-muted-foreground">
                Listed rate: {formatPrice(loadDetails.revenue)} • 
                Suggested range: {formatPrice(loadDetails.revenue * 0.8)} - {formatPrice(loadDetails.revenue * 1.2)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Additional Notes (Optional)
              <span className="text-xs text-muted-foreground">({notes.length}/500)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional information about your offer..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={3}
              className={`resize-none ${validationErrors.notes ? 'border-red-500 focus:border-red-500' : ''}`}
              maxLength={500}
            />
            {validationErrors.notes && (
              <p className="text-sm text-red-600">{validationErrors.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !offerAmount || Object.keys(validationErrors).length > 0}
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

