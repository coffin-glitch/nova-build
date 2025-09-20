"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";

type Bid = {
  id: string;
  bid_code: string;
  distance_miles: number | null;
  message_posted_at: string;
  expires_at: string;
  is_usps: boolean;
  tags: string[] | null;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function BidBoardPage() {
  const { data } = useSWR<{ bids: Bid[] }>("/api/bids/active", fetcher, { refreshInterval: 15000 });
  const bids = data?.bids || [];
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Bid Board (30-minute live)</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {bids.length === 0 && <p>No active bids (yet).</p>}
        {bids.map(b => <BidCard key={b.id} bid={b} />)}
      </div>
    </main>
  );
}

function BidCard({ bid }: { bid: Bid }) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const remainMs = useMemo(() => new Date(bid.expires_at).getTime() - now, [bid.expires_at, now]);
  const remain = Math.max(0, Math.floor(remainMs / 1000));
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <div>New Load Bid: {bid.bid_code}</div>
        <div>{bid.is_usps ? "USPS" : ""}</div>
      </div>
      <div style={{ opacity: 0.8, fontSize: 14 }}>
        Distance: {bid.distance_miles ?? "—"} mi • Tags: {(bid.tags || []).join(", ") || "—"}
      </div>
      <div style={{ fontSize: 14, marginTop: 6 }}>⏳ Expires in {mm}:{ss}</div>
    </div>
  );
}
