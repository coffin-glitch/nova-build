"use client";

import { useState } from "react";
import { MapPin, Clock, DollarSign, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Countdown from "./Countdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AuctionCardProps {
  bidNumber: string;
  tag: string;
  route: string;
  pickup: string;
  delivery: string;
  distanceMiles: number;
  endsAt: string;
  lowestBid?: {
    amount: number;
    carrierName: string;
    mcNumber?: string;
  };
  userRole?: "carrier" | "admin" | null;
  isSignedIn: boolean;
  onPlaceBid: (bidNumber: string, amount: number, notes?: string) => Promise<void>;
  className?: string;
}

export default function AuctionCard({
  bidNumber,
  tag,
  route,
  pickup,
  delivery,
  distanceMiles,
  endsAt,
  lowestBid,
  userRole,
  isSignedIn,
  onPlaceBid,
  className,
}: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMiles = (miles: number) => {
    return `${miles.toLocaleString()} mi`;
  };

  const handlePlaceBid = async () => {
    const amount = parseFloat(bidAmount);
    
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid bid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceBid(bidNumber, amount, bidNotes.trim() || undefined);
      setBidAmount("");
      setBidNotes("");
      toast.success("Bid placed successfully!");
    } catch (error) {
      toast.error("Failed to place bid. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = new Date(endsAt) <= new Date();

  return (
    <div
      className={cn(
        "group bg-card border border-border rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {tag}
          </Badge>
          <div className="text-sm font-medium text-muted-foreground">
            Bid #{bidNumber}
          </div>
        </div>
        <Countdown endsAt={endsAt} />
      </div>

      {/* Route Info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">{route}</h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{pickup}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{delivery}</span>
          </div>
          <div className="text-sm font-medium text-foreground">
            {formatMiles(distanceMiles)}
          </div>
        </div>
      </div>

      {/* Lowest Bid Info */}
      {lowestBid && (
        <div className="mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Lowest:</span>
            <span className="font-semibold text-foreground">{formatPrice(lowestBid.amount)}</span>
            <span className="text-muted-foreground">by</span>
            <span className="font-medium text-foreground">{lowestBid.carrierName}</span>
            {lowestBid.mcNumber && (
              <span className="text-xs text-muted-foreground">(MC {lowestBid.mcNumber})</span>
            )}
          </div>
        </div>
      )}

      {/* Bid Form */}
      <div className="pt-4 border-t border-border">
        {!isSignedIn ? (
          <Button variant="outline" className="w-full" disabled>
            <User className="mr-2 h-4 w-4" />
            Sign in to bid
          </Button>
        ) : userRole === "carrier" && !isExpired ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Bid amount"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={isSubmitting}
                  className="text-right"
                />
              </div>
              <Button
                onClick={handlePlaceBid}
                disabled={isSubmitting || !bidAmount}
                className="px-6"
              >
                {isSubmitting ? "Placing..." : "Place Bid"}
              </Button>
            </div>
            <Textarea
              placeholder="Optional notes..."
              value={bidNotes}
              onChange={(e) => setBidNotes(e.target.value)}
              disabled={isSubmitting}
              className="resize-none"
              rows={2}
            />
          </div>
        ) : isExpired ? (
          <div className="text-center py-2">
            <Badge variant="destructive">Auction Expired</Badge>
          </div>
        ) : (
          <div className="text-center py-2 text-muted-foreground">
            Only carriers can place bids
          </div>
        )}
      </div>
    </div>
  );
}
