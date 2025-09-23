"use client";
import * as React from "react";
import { useState, useTransition } from "react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function BookSheet({ rr }: { rr: string }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rr, amount, notes }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j?.errors ? "Please review the fields" : (j?.message || "Failed to create offer"));
          return;
        }
        setOk(true);
        setAmount("");
        setNotes("");
      } catch (e: any) {
        setErr(e?.message || "Network error");
      }
    });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">Book Load</Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Place Offer</SheetTitle>
          <SheetDescription>RR #{rr} · Your offer will be visible to dispatch.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (USD)</label>
            <Input inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="e.g. 1850" required />
          </div>
          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Any special info…" rows={4} />
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          {ok && <div className="text-sm text-green-600">Offer submitted!</div>}
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700">
              {pending ? "Submitting…" : "Submit Offer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
