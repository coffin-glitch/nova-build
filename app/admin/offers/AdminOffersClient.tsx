"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  MapPin,
  Truck,
  User,
  Calendar,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { getLoadOffers, acceptOffer, rejectOffer } from "@/lib/actions";

interface Offer {
  id: number;
  load_id: number;
  clerk_user_id: string;
  price: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  load_id: string;
  origin: string;
  destination: string;
  load_rate: number;
  equipment_type: string;
  miles: number;
}

interface AdminOffersClientProps {
  initialOffers: Offer[];
}

export function AdminOffersClient({ initialOffers }: AdminOffersClientProps) {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isProcessing, setIsProcessing] = useState<number | null>(null);

  // Use SWR for real-time updates
  const { data: offers = initialOffers } = useSWR(
    "admin-offers",
    getLoadOffers,
    {
      refreshInterval: 10000, // 10 seconds
      fallbackData: initialOffers,
    }
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Accepted</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
      case "countered":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Countered</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Pending</Badge>;
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    setIsProcessing(offerId);
    try {
      await acceptOffer(offerId);
      toast.success("Offer accepted successfully");
    } catch (error) {
      console.error("Error accepting offer:", error);
      toast.error("Failed to accept offer");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectOffer = async (offerId: number) => {
    setIsProcessing(offerId);
    try {
      await rejectOffer(offerId);
      toast.success("Offer rejected successfully");
    } catch (error) {
      console.error("Error rejecting offer:", error);
      toast.error("Failed to reject offer");
    } finally {
      setIsProcessing(null);
    }
  };

  // Group offers by load
  const groupedOffers = offers.reduce((acc, offer) => {
    const key = offer.load_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(offer);
    return acc;
  }, {} as Record<string, Offer[]>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-primary">{offers.length}</div>
          <div className="text-sm text-muted-foreground">Total Offers</div>
        </Card>
        <Card className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">
            {offers.filter(o => o.status === 'pending').length}
          </div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </Card>
        <Card className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-green-500">
            {offers.filter(o => o.status === 'accepted').length}
          </div>
          <div className="text-sm text-muted-foreground">Accepted</div>
        </Card>
        <Card className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">
            {Object.keys(groupedOffers).length}
          </div>
          <div className="text-sm text-muted-foreground">Loads</div>
        </Card>
      </div>

      {/* Offers by Load */}
      <div className="space-y-6">
        {Object.entries(groupedOffers).map(([loadId, loadOffers]) => {
          const bestOffer = loadOffers.reduce((best, current) => 
            current.price > best.price ? current : best
          );
          
          return (
            <Card key={loadId} className="card-premium overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold color: hsl(var(--foreground))">
                      Load #{loadOffers[0].load_id}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{loadOffers[0].origin} → {loadOffers[0].destination}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        <span>{loadOffers[0].miles} mi • {loadOffers[0].equipment_type}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Listed: ${loadOffers[0].load_rate.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Best Offer</div>
                    <div className="text-xl font-bold text-primary">
                      ${bestOffer.price.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Offer Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadOffers
                    .sort((a, b) => b.price - a.price)
                    .map((offer) => (
                    <TableRow key={offer.id} className="hover:bg-accent/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {offer.clerk_user_id.slice(-8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-primary">
                            ${offer.price.toLocaleString()}
                          </span>
                          {offer.price === bestOffer.price && offer.status === 'pending' && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                              Best
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(offer.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {formatDate(offer.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {offer.notes || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {offer.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => handleAcceptOffer(offer.id)}
                                disabled={isProcessing === offer.id}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectOffer(offer.id)}
                                disabled={isProcessing === offer.id}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {offer.status !== 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedOffer(offer)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })}
      </div>

      {offers.length === 0 && (
        <Card className="card-premium p-8 text-center">
          <div className="space-y-4">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold color: hsl(var(--foreground))">No offers yet</h3>
            <p className="text-muted-foreground">
              Carriers haven't submitted any offers yet. Check back later.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
