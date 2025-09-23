import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  MessageSquare, 
  MapPin, 
  DollarSign, 
  Clock, 
  User,
  Truck
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getOffers() {
  const rows = await sql/*sql*/`
    select o.id, o.load_rr, o.clerk_user_id, o.price, o.notes, o.status, o.created_at, 
           l.origin_city, l.origin_state, l.destination_city, l.destination_state,
           l.equipment, l.total_miles, l.pickup_date, l.revenue
    from public.load_offers o
    join public.loads l on l.rr_number = o.load_rr
    order by o.created_at desc
    limit 500
  `;
  return rows;
}

export default async function AdminOffersPage() {
  await requireAdmin();
  const offers = await getOffers();

  // Group offers by load_rr
  const groupedOffers = offers.reduce((acc: any, offer: any) => {
    if (!acc[offer.load_rr]) {
      acc[offer.load_rr] = {
        load: offer,
        offers: []
      };
    }
    acc[offer.load_rr].offers.push(offer);
    return acc;
  }, {});

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      accepted: "default",
      counter: "destructive",
      rejected: "outline"
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold color: hsl(var(--foreground))">Manage Offers</h1>
        <p className="text-muted-foreground">Review and manage carrier offers for loads.</p>
      </div>

      {Object.entries(groupedOffers).map(([loadRr, group]: [string, any]) => (
        <Card key={loadRr} className="card-premium p-6">
          <div className="space-y-6">
            {/* Load Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold color: hsl(var(--foreground))">Load RR# {loadRr}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{group.load.origin_city}, {group.load.origin_state} → {group.load.destination_city}, {group.load.destination_state}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span>{group.load.equipment || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{group.load.revenue ? `$${group.load.revenue.toLocaleString()}` : "N/A"}</span>
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{group.offers.length} offer{group.offers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Offers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Offer ID</th>
                    <th className="p-3 text-left font-semibold">Carrier</th>
                    <th className="p-3 text-right font-semibold">Price</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-left font-semibold">Submitted</th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.offers.map((offer: any) => (
                    <tr key={offer.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-primary">#{offer.id}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{offer.clerk_user_id}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {offer.price ? `$${offer.price.toLocaleString()}` : "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{getStatusBadge(offer.status)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{new Date(offer.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-2 justify-center">
                          {offer.status === 'pending' && (
                            <>
                              <form action={`/api/admin/offers/${offer.id}/accept`} method="post">
                                <Button type="submit" size="sm" className="btn-primary">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Accept
                                </Button>
                              </form>
                              <form action={`/api/admin/offers/${offer.id}/counter`} method="post" className="flex gap-2">
                                <Input
                                  name="counter_price"
                                  type="number"
                                  step="0.01"
                                  placeholder="Counter price"
                                  className="w-24 h-8 text-xs"
                                  required
                                />
                                <Button type="submit" size="sm" variant="outline">
                                  <MessageSquare className="w-4 h-4 mr-1" />
                                  Counter
                                </Button>
                              </form>
                            </>
                          )}
                          {offer.status === 'accepted' && (
                            <Badge variant="default" className="text-xs">
                              Accepted
                            </Badge>
                          )}
                          {offer.status === 'counter' && (
                            <Badge variant="destructive" className="text-xs">
                              Countered
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            {group.offers.some((offer: any) => offer.notes) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold color: hsl(var(--foreground))">Notes</h3>
                <div className="space-y-2">
                  {group.offers.map((offer: any) => offer.notes && (
                    <div key={offer.id} className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                      <p className="font-medium">Offer #{offer.id}:</p>
                      <p className="whitespace-pre-wrap">{offer.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}

      {Object.keys(groupedOffers).length === 0 && (
        <Card className="card-premium p-8">
          <div className="text-center">
            <Truck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold color: hsl(var(--foreground)) mb-2">No Offers Yet</h3>
            <p className="text-muted-foreground">Carriers haven't submitted any offers yet.</p>
          </div>
        </Card>
      )}
    </div>
  );
}