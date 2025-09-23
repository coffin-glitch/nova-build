"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "vaul";
import MapPreview from "@/components/map/MapPreview";

type Row = {
  bid_number: string;
  distance_miles: number | null;
  pickup_timestamp: string | null;
  delivery_timestamp: string | null;
  stops: string[] | null;
  tag: string | null;
  received_at: string;
  expires_at: string | null;
};

export default function BidListClient({ initialRows }: { initialRows: Row[] }) {
  const { data } = useSWR<Row[]>("/admin/bids", { fallbackData: initialRows, refreshInterval: 10000 });
  const rows = data ?? initialRows;

  const [selected, setSelected] = useState<Row | null>(null);

  async function publish(bid: Row) {
    const res = await fetch(`/api/admin/bids/${encodeURIComponent(bid.bid_number)}/publish`, { method: "POST" });
    if (!res.ok) {
      const t = await res.text();
      alert(`Publish failed: ${t}`);
      return;
    }
    alert(`Published as RR TB-${bid.bid_number} (draft). Go to Manage Loads to publish.`);
  }

  const filtered = rows; // add filters later

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-gray-600">
            <th>Bid #</th><th>Tag</th><th>Distance</th><th>Stops</th><th>Received</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => (
            <tr key={b.bid_number} className="border-b last:border-0 [&>td]:px-4 [&>td]:py-3">
              <td className="font-mono">{b.bid_number}</td>
              <td>{b.tag || "—"}</td>
              <td>{b.distance_miles ?? "—"}</td>
              <td>{Array.isArray(b.stops) ? b.stops.length : 0}</td>
              <td>{new Date(b.received_at).toLocaleString()}</td>
              <td className="flex items-center gap-2">
                <Drawer.Root open={!!selected && selected.bid_number===b.bid_number} onOpenChange={(o)=>setSelected(o?b:null)}>
                  <Drawer.Trigger asChild>
                    <Button variant="secondary">View</Button>
                  </Drawer.Trigger>
                  <Drawer.Content className="p-4 sm:p-6">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold">Bid {b.bid_number}</h2>
                      <p className="text-sm text-gray-600">{b.tag || "—"} · {b.distance_miles ?? "—"} miles</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                      <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border p-4 bg-white">
                          <div className="text-sm text-gray-600">Stops</div>
                          <ul className="mt-2 list-disc pl-5 text-sm">
                            {(b.stops ?? []).map((s, i)=> <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-lg border p-4 bg-white">
                          <div className="text-sm text-gray-600">Pickup</div>
                          <div className="text-sm">{b.pickup_timestamp ? new Date(b.pickup_timestamp).toLocaleString() : "—"}</div>
                          <div className="text-sm text-gray-600 mt-2">Delivery</div>
                          <div className="text-sm">{b.delivery_timestamp ? new Date(b.delivery_timestamp).toLocaleString() : "—"}</div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <MapPreview origin={b.stops?.[0]} dest={b.stops?.[b.stops.length-1]} />
                        <Button onClick={()=>publish(b)} className="w-full bg-blue-600 hover:bg-blue-700">Publish as Load (draft)</Button>
                      </div>
                    </div>
                  </Drawer.Content>
                </Drawer.Root>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="text-center text-gray-500 py-10">No bids.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
