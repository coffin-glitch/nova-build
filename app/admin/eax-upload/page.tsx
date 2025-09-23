"use client";

import { useState } from "react";

export default function EaxUpload() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null);

    const form = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/eax/upload", {
      method: "POST",
      body: form,
    });
    const j = await r.json().catch(() => ({} as any));
    setBusy(false);
    if (r.ok) setMsg(`✅ Uploaded & ingested ${j.rows} rows.`);
    else setMsg(`❌ Error: ${j?.error || r.statusText}`);
  }

  return (
    <div className="card max-w-xl">
      <h1 className="text-lg font-semibold mb-3">Admin → EAX Excel Upload</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input type="file" name="file" accept=".xlsx,.xls" required className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
        <button className="btn" disabled={busy}>{busy ? "Uploading..." : "Upload & Ingest"}</button>
      </form>
      {msg && <p className="mt-3 text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
