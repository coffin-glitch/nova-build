import { CardGlass } from "@/components/ui/CardGlass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCarrierProfile } from "@/lib/auctions";
import { requireCarrier } from "@/lib/auth";
import { getUnifiedAuth } from "@/lib/auth-unified";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { AlertCircle, CheckCircle, Clock, DollarSign, Gavel, XCircle } from "lucide-react";

export const metadata = { title: "NOVA • My Offers" };

export default async function CurrentOffersPage() {
  await requireCarrier();
  const auth = await getUnifiedAuth();
  if (!auth.userId) return null;

  // Get carrier profile to show their bids
  const profile = await getCarrierProfile(auth.userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">My Offers</h1>
            <p className="text-slate-300 text-lg">
              Your bids and offers in live auctions
            </p>
          </div>

          {/* Profile Status */}
          {!profile && (
            <CardGlass className="p-6 border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Profile Setup Required</h3>
                  <p className="text-slate-300">
                    Complete your carrier profile to start bidding on auctions.
                  </p>
                </div>
                <Button className="ml-auto bg-yellow-600 hover:bg-yellow-700 text-white">
                  Setup Profile
                </Button>
              </div>
            </CardGlass>
          )}

          {/* Mock offers for demonstration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Active Bid Example */}
            <CardGlass className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400">
                    #USPS-2024-001
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-500/20 text-orange-300">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-orange-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">15:32</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Gavel className="w-4 h-4" />
                  <span className="text-sm">Your Bid: {formatMoney(45000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Lowest: {formatMoney(42000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    Placed {formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000))}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Update Bid
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardGlass>

            {/* Won Auction Example */}
            <CardGlass className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400">
                    #USPS-2024-002
                  </Badge>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                    Won
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Awarded</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Gavel className="w-4 h-4" />
                  <span className="text-sm">Winning Bid: {formatMoney(38000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">You saved: {formatMoney(5000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    Won {formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000))}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    View Load
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Start Load
                  </Button>
                </div>
              </div>
            </CardGlass>

            {/* Lost Auction Example */}
            <CardGlass className="p-6 space-y-4 opacity-75">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-500/20 text-gray-300 border-gray-400">
                    #USPS-2024-003
                  </Badge>
                  <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                    Lost
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Expired</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Gavel className="w-4 h-4" />
                  <span className="text-sm">Your Bid: {formatMoney(52000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Winning: {formatMoney(48000)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    Expired {formatRelativeTime(new Date(Date.now() - 24 * 60 * 60 * 1000))}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardGlass>
          </div>

          {/* Empty State */}
          <CardGlass className="p-12 text-center">
            <Gavel className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Active Bids</h3>
            <p className="text-slate-300 mb-6">
              Start bidding on live auctions to see your offers here.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Gavel className="w-4 h-4 mr-2" />
              View Live Auctions
            </Button>
          </CardGlass>
        </div>
      </div>
    </div>
  );
}
