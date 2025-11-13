"use client";

import { Button } from "@/components/ui/button";
import { fmtDate, fmtMiles, fmtUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

type LoadRow = {
  rr_number: string;
  equipment: string|null;
  total_miles: number|null;
  revenue: number|null;
  origin_city: string|null;
  origin_state: string|null;
  destination_city: string|null;
  destination_state: string|null;
  pickup_date: string|null;
  delivery_date: string|null;
};

export default function LoadCard({ r, onOffer }: { r: LoadRow; onOffer: (rr: string)=>void }) {
  return (
    <div className={cn(
      "bg-white rounded-xl p-5 border border-gray-100 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{r.equipment || "—"}</span>
            <span className="text-xs text-gray-500">#{r.rr_number}</span>
          </div>
          <h4 className="text-lg font-semibold text-gray-800">
            {r.origin_city}, {r.origin_state} → {r.destination_city}, {r.destination_state}
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Pickup: {r.pickup_date ? fmtDate(r.pickup_date) : 'TBD'} &nbsp;•&nbsp; Delivery: {r.delivery_date ? fmtDate(r.delivery_date) : 'TBD'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{r.revenue ? fmtUSD(r.revenue) : 'TBD'}</p>
          <p className="text-sm text-gray-500">{fmtMiles(r.total_miles)}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">🚚</div>
          <div>
            <p className="text-sm font-medium text-gray-700">NOVA Marketplace</p>
            <p className="text-xs text-gray-500">Fast confirmations</p>
          </div>
        </div>
        <Button onClick={()=>onOffer(r.rr_number)} className="bg-blue-600 hover:bg-blue-700">Book / Make Offer</Button>
      </div>
    </div>
  );
}
