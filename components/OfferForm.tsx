"use client";

import { useState } from "react";

export default function OfferForm({ postUrl }: { postUrl: string }) {
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAmount(""); setNote("");
      setMsg("Offer submitted!");
    } catch (e:any) {
      setMsg(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="font-semibold">Place an Offer</div>
      <input
        className="border rounded px-2 py-1 w-40"
        placeholder="Amount (USD)"
        value={amount}
        onChange={e=>setAmount(e.target.value)}
        type="number" min="0" step="1"
      />
      <br />
      <textarea
        className="border rounded p-2 w-full"
        placeholder="Optional note"
        value={note}
        onChange={e=>setNote(e.target.value)}
        rows={2}
      />
      <br />
      <button onClick={submit} disabled={busy} className="border rounded px-3 py-1">
        {busy ? "Submitting..." : "Submit Offer"}
      </button>
      {msg && <div className="text-sm text-gray-600">{msg}</div>}
    </div>
  );
}
