import { requireCarrier } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { listAwardsForUser } from "@/lib/auctions";
import Link from "next/link";
import { formatMoney, formatDistance, formatStops } from "@/lib/format";
import { CardGlass } from "@/components/ui/CardGlass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Clock, DollarSign, CheckCircle, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyLoadsPage() {
  await requireCarrier();
  const { userId } = auth();
  if (!userId) return null;

  // Get awarded loads from auction system
  const awards = await listAwardsForUser(userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">My Loads</h1>
            <p className="text-slate-300 text-lg">
              Your awarded loads from live auctions
            </p>
          </div>

          {/* Loads Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {awards.map((award, index) => (
              <CardGlass key={award.id} className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400">
                      #{award.bid_number}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-600/20 text-slate-300">
                      Awarded
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Won</span>
                  </div>
                </div>

                {/* Load Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">Bid #{award.bid_number}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-semibold">{formatMoney(award.winner_amount_cents)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      Awarded {new Date(award.awarded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Package className="w-4 h-4 mr-1" />
                      Start Load
                    </Button>
                  </div>
                </div>
              </CardGlass>
            ))}
            
            {awards.length === 0 && (
              <div className="col-span-full">
                <CardGlass className="p-12 text-center">
                  <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Loads Yet</h3>
                  <p className="text-slate-300 mb-6">
                    Start by bidding on live auctions to win loads.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link href="/bid-board">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Truck className="w-4 h-4 mr-2" />
                        Live Auctions
                      </Button>
                    </Link>
                    <Link href="/book-loads">
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                        <MapPin className="w-4 h-4 mr-2" />
                        Find Loads
                      </Button>
                    </Link>
                  </div>
                </CardGlass>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}