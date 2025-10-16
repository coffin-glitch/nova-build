"use client";

import { OfferMessageConsole } from "@/components/offer/OfferMessageConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistance, formatMoney } from "@/lib/format";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    DollarSign,
    Edit,
    FileText,
    MapPin,
    MessageSquare,
    Package,
    TrendingUp,
    Truck,
    User,
    XCircle
} from "lucide-react";
import { useEffect, useState } from "react";

interface LoadDetailsDialogProps {
  load?: any;
  offer?: any;
  children?: React.ReactNode;
}

interface OfferHistoryEntry {
  id: string;
  offer_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  old_amount?: number;
  new_amount?: number;
  counter_amount?: number;
  admin_notes?: string;
  carrier_notes?: string;
  performed_by: string;
  performed_at: string;
}

export function LoadDetailsDialog({ load, offer, children }: LoadDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageConsoleOpen, setMessageConsoleOpen] = useState(false);
  const [offerHistory, setOfferHistory] = useState<OfferHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (!load && !offer) return null;

  const loadData = load || offer?.load;
  const isOffer = !!offer;

  // Fetch offer history when dialog opens and we have an offer
  useEffect(() => {
    if (isOpen && isOffer && offer?.id) {
      setHistoryLoading(true);
      fetch(`/api/carrier/offers/${offer.id}/history`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setOfferHistory(data.history || []);
          }
        })
        .catch(error => {
          console.error('Error fetching offer history:', error);
        })
        .finally(() => {
          setHistoryLoading(false);
        });
    }
  }, [isOpen, isOffer, offer?.id]);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-400",
      accepted: "bg-green-500/20 text-green-300 border-green-400",
      rejected: "bg-red-500/20 text-red-300 border-red-400",
      countered: "bg-blue-500/20 text-blue-300 border-blue-400",
      assigned: "bg-purple-500/20 text-purple-300 border-purple-400",
      picked_up: "bg-blue-500/20 text-blue-300 border-blue-400",
      in_transit: "bg-orange-500/20 text-orange-300 border-orange-400",
      delivered: "bg-green-500/20 text-green-300 border-green-400",
      completed: "bg-gray-500/20 text-gray-300 border-gray-400"
    };
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.pending}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            View Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Load #{loadData?.rr_number || loadData?.tm_number || 'N/A'}</span>
            {isOffer && getStatusBadge(offer.status)}
            {!isOffer && load && getStatusBadge(load.status)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="route">Route Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Load Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Load Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Equipment:</span>
                    <span className="font-medium">{loadData?.equipment || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Distance:</span>
                    <span className="font-medium">{loadData?.total_miles ? formatDistance(loadData.total_miles) : 'N/A'}</span>
                  </div>
                  {isOffer && (
                    <>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Your Offer:</span>
                        <span className="font-medium text-green-500">{formatMoney(offer.offer_amount)}</span>
                      </div>
                      {offer.counter_amount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-muted-foreground">Counter Offer:</span>
                          <span className="font-medium text-blue-500">{formatMoney(offer.counter_amount)}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Customer:</span>
                    <span className="font-medium">{loadData?.customer_name || 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Section */}
            {(offer?.notes || offer?.admin_notes || load?.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {offer?.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Your Notes</p>
                      <p className="text-sm">{offer.notes}</p>
                    </div>
                  )}
                  {offer?.admin_notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</p>
                      <p className="text-sm">{offer.admin_notes}</p>
                    </div>
                  )}
                  {load?.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Load Notes</p>
                      <p className="text-sm">{load.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="route" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Route Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Pickup Location
                    </h4>
                    <div className="space-y-2">
                      <p className="font-medium">{loadData?.origin_city || 'N/A'}, {loadData?.origin_state || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        Date: {loadData?.pickup_date || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Time: {loadData?.pickup_time || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-500" />
                      Delivery Location
                    </h4>
                    <div className="space-y-2">
                      <p className="font-medium">{loadData?.destination_city || 'N/A'}, {loadData?.destination_state || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        Date: {loadData?.delivery_date || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Time: {loadData?.delivery_time || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Distance</span>
                    </div>
                    <span className="font-semibold">{loadData?.total_miles ? formatDistance(loadData.total_miles) : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Load Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      {isOffer && offerHistory.length === 0 && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <div className="flex-1">
                            <p className="font-medium">Offer Submitted</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(offer.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {offer.status === 'countered' ? 'Countered' : 'Pending'}
                          </Badge>
                        </div>
                      )}

                      {isOffer && offerHistory.map((entry, index) => (
                        <div key={entry.id} className="flex items-start gap-4 p-4 border rounded-lg">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {entry.action === 'accepted' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              {entry.action === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                              {entry.action === 'countered' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                              {entry.action === 'created' && <Clock className="h-4 w-4 text-yellow-600" />}
                              {entry.action === 'modified' && <Edit className="h-4 w-4 text-purple-600" />}
                              {entry.action === 'withdrawn' && <ArrowLeft className="h-4 w-4 text-gray-600" />}
                              {entry.action === 'accepted_counter' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              {entry.action === 'rejected_counter' && <XCircle className="h-4 w-4 text-red-600" />}
                              {entry.action === 'countered_back' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">
                                {entry.action === 'accepted' && 'Offer Accepted'}
                                {entry.action === 'rejected' && 'Offer Rejected'}
                                {entry.action === 'countered' && 'Counter Offer Received'}
                                {entry.action === 'created' && 'Offer Submitted'}
                                {entry.action === 'modified' && 'Offer Modified'}
                                {entry.action === 'withdrawn' && 'Offer Withdrawn'}
                                {entry.action === 'accepted_counter' && 'Counter Offer Accepted'}
                                {entry.action === 'rejected_counter' && 'Counter Offer Rejected'}
                                {entry.action === 'countered_back' && 'Counter Offer Sent'}
                              </h4>
                              <Badge variant="outline" className={
                                entry.action === 'accepted' || entry.action === 'accepted_counter' ? 'bg-green-500/20 text-green-700' :
                                entry.action === 'rejected' || entry.action === 'rejected_counter' ? 'bg-red-500/20 text-red-700' :
                                entry.action === 'countered' || entry.action === 'countered_back' ? 'bg-blue-500/20 text-blue-700' :
                                'bg-gray-500/20 text-gray-700'
                              }>
                                {entry.new_status || entry.action}
                              </Badge>
                            </div>
                            
                            {entry.new_amount && entry.old_amount && entry.new_amount !== entry.old_amount && (
                              <p className="text-sm text-muted-foreground">
                                Amount changed from {formatMoney(entry.old_amount)} to {formatMoney(entry.new_amount)}
                              </p>
                            )}
                            
                            {entry.counter_amount && (
                              <p className="text-sm text-muted-foreground">
                                Counter offer: {formatMoney(entry.counter_amount)}
                              </p>
                            )}
                            
                            {entry.admin_notes && (
                              <p className="text-sm text-muted-foreground">
                                Admin notes: {entry.admin_notes}
                              </p>
                            )}
                            
                            {entry.carrier_notes && (
                              <p className="text-sm text-muted-foreground">
                                Your notes: {entry.carrier_notes}
                              </p>
                            )}
                            
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.performed_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {load?.assigned_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Load Assigned</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(load.assigned_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-700">Assigned</Badge>
                    </div>
                  )}

                  {load?.picked_up_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Load Picked Up</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(load.picked_up_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-orange-500/20 text-orange-700">In Transit</Badge>
                    </div>
                  )}

                  {load?.delivered_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-50">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Load Delivered</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(load.delivered_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/20 text-green-700">Completed</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Driver Documents & Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <User className="w-6 h-6" />
                    <span>Upload Driver CDL</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <Package className="w-6 h-6" />
                    <span>Upload POD</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <FileText className="w-6 h-6" />
                    <span>Upload Bill of Lading</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => {
                      if (offer?.id) {
                        setMessageConsoleOpen(true);
                      }
                    }}
                    disabled={!offer?.id}
                  >
                    <MessageSquare className="w-6 h-6" />
                    <span>Send Message</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Offer Message Console */}
      {offer?.id && (
        <OfferMessageConsole
          offerId={offer.id}
          isOpen={messageConsoleOpen}
          onClose={() => setMessageConsoleOpen(false)}
        />
      )}
    </Dialog>
  );
}
