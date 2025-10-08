"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import SearchPanel, { Filters } from "@/components/loads/SearchPanel";
import LoadCard from "@/components/loads/LoadCard";
import LoadsMap from "@/components/map/LoadsMap";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from "vaul";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";

type LoadRow = {
  rr_number: string;
  equipment: string|null;
  total_miles: number|null;
  revenue: number|null;
  purchase: number|null;
  margin: number|null;
  origin_city: string|null;
  origin_state: string|null;
  destination_city: string|null;
  destination_state: string|null;
  pickup_date: string|null;
  delivery_date: string|null;
  updated_at: string;
};

const fetcher = (url: string, body: any) =>
  fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(r=>r.json());

export default function BookLoadsClient() {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for white accent color
  const getTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  };
  
  const [filters, setFilters] = useState<Filters>({
    q: "", origin: "", destination: "", equipment: "",
    pickupFrom: "", pickupTo: "", milesMin: "", milesMax: ""
  });
  const [queryKey, setQueryKey] = useState(0);

  const { data, isValidating, mutate } = useSWR<{rows: LoadRow[]}>(
    ["/api/loads/search", { ...filters, limit: 50, offset: 0, _k: queryKey }],
    ([url, body]) => fetcher(url, body),
    { refreshInterval: 15000 }
  );

  useEffect(() => { mutate(); }, [queryKey]); // re-run when pressing Search

  const rows = data?.rows ?? [];

  // Map points
  const points = useMemo(() => rows.map(r => ({
    origin: r.origin_city && r.origin_state ? `${r.origin_city}, ${r.origin_state}` : null,
    dest: r.destination_city && r.destination_state ? `${r.destination_city}, ${r.destination_state}` : null
  })), [rows]);

  function search() { setQueryKey(k => k+1); }

  // Offer drawer state
  const [offerRR, setOfferRR] = useState<string| null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT 2/3 */}
      <div className="lg:col-span-2 space-y-6">
        <SearchPanel value={filters} onChange={setFilters} onSearch={search} />

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Available Loads ({rows.length}) {isValidating && <span className="ml-2 text-sm text-gray-500">Refreshing…</span>}
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>mutate()}>Refresh</Button>
          </div>
        </div>

        <div className="space-y-4">
          {rows.map(r => (
            <LoadCard key={r.rr_number} r={r} onOffer={(rr)=>setOfferRR(rr)} />
          ))}
          {rows.length === 0 && (
            <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No loads match your search.</div>
          )}
        </div>
      </div>

      {/* RIGHT 1/3 */}
      <div className="lg:col-span-1">
        <div className="sticky top-8">
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <h3 className="text-lg font-semibold mb-3" style={{ color: getTextColor() }}>Loads Map</h3>
            <LoadsMap points={points} />
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-sm"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2" />Origin</div>
              <div className="flex items-center text-sm"><span className="w-3 h-3 rounded-full bg-red-500 mr-2" />Destination</div>
            </div>
          </div>
        </div>
      </div>

      {/* OFFER DRAWER */}
      <Drawer.Root open={!!offerRR} onOpenChange={(o)=>!o && setOfferRR(null)}>
        <DrawerContent className="p-4 sm:p-6">
          <DrawerHeader>
            <DrawerTitle>Make an Offer</DrawerTitle>
            <DrawerDescription>RR #{offerRR ?? "—"}</DrawerDescription>
          </DrawerHeader>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm text-gray-700">Your rate (USD)</label>
              <Input placeholder="e.g. 1850" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Notes</label>
              <Input placeholder="Optional details" />
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-2">
            <Button variant="outline" onClick={()=>setOfferRR(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={()=>alert("Offer flow will be implemented next")}>Submit Offer</Button>
          </div>
        </DrawerContent>
      </Drawer.Root>
    </div>
  );
}
