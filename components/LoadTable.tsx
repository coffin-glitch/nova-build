"use client";

import { useEffect, useMemo, useState } from "react";

type Load = {
  rr_number: string;
  tm_number: string | null;
  status_code: string | null;
  pickup_date: string | null;
  pickup_window: string | null;
  delivery_date: string | null;
  delivery_window: string | null;
  revenue: number | null;
  purchase: number | null;
  net: number | null;
  margin: number | null;
  equipment: string | null;
  customer_name: string | null;
  driver_name: string | null;
  total_miles: number | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  vendor_name: string | null;
  dispatcher_name: string | null;
  updated_at: string | null;
  published: boolean;
};

export default function LoadTable() {
  const [rows, setRows] = useState<Load[]>([]);
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState<"all"|"true"|"false">("all");
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (published !== "all") params.set("published", published);
    const res = await fetch(`/api/admin/loads?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggle = async (rr: string, to: boolean) => {
    await fetch(`/api/admin/loads/${encodeURIComponent(rr)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: to })
    });
    // refresh after toggle
    fetchRows();
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const pub = rows.filter(r => r.published).length;
    return { total, pub };
  }, [rows]);

  return (
    <div className="space-y-4">
      <form
        className="flex items-center gap-2"
        onSubmit={(e)=>{e.preventDefault(); fetchRows();}}
      >
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search RR#, TM#, customer, city…"
          className="border rounded px-3 py-2 w-72"
        />
        <select
          value={published}
          onChange={e=>setPublished(e.target.value as any)}
          className="border rounded px-2 py-2"
        >
          <option value="all">All</option>
          <option value="true">Published only</option>
          <option value="false">Unpublished only</option>
        </select>
        <button className="border rounded px-3 py-2" type="submit">
          {loading ? "Loading…" : "Refresh"}
        </button>
        <div className="text-sm text-gray-600 ml-2">
          {summary.pub}/{summary.total} published
        </div>
      </form>

      <div className="overflow-auto border rounded">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Publish</th>
              <th className="text-left p-2">RR#</th>
              <th className="text-left p-2">TM#</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Pickup</th>
              <th className="text-left p-2">Delivery</th>
              <th className="text-left p-2">Eqp</th>
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Origin → Dest</th>
              <th className="text-right p-2">Miles</th>
              <th className="text-right p-2">Revenue</th>
              <th className="text-right p-2">Net</th>
              <th className="text-right p-2">Margin</th>
              <th className="text-left p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pickup = [r.pickup_date, r.pickup_window].filter(Boolean).join(" ");
              const delivery = [r.delivery_date, r.delivery_window].filter(Boolean).join(" ");
              const od = [ [r.origin_city, r.origin_state].filter(Boolean).join(", "), [r.destination_city, r.destination_state].filter(Boolean).join(", ") ].join(" → ");
              return (
                <tr key={r.rr_number} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!r.published}
                        onChange={(e)=>onToggle(r.rr_number, e.target.checked)}
                      />
                      <span className="text-xs">{r.published ? "On" : "Off"}</span>
                    </label>
                  </td>
                  <td className="p-2 font-mono">{r.rr_number}</td>
                  <td className="p-2">{r.tm_number || ""}</td>
                  <td className="p-2">{r.status_code || ""}</td>
                  <td className="p-2">{pickup}</td>
                  <td className="p-2">{delivery}</td>
                  <td className="p-2">{r.equipment || ""}</td>
                  <td className="p-2">{r.customer_name || ""}</td>
                  <td className="p-2">{od}</td>
                  <td className="p-2 text-right">{r.total_miles ?? ""}</td>
                  <td className="p-2 text-right">{r.revenue ?? ""}</td>
                  <td className="p-2 text-right">{r.net ?? ""}</td>
                  <td className="p-2 text-right">{r.margin ?? ""}</td>
                  <td className="p-2 text-xs text-gray-500">{r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={14} className="p-4 text-center text-gray-500">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
