"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Filters = {
  q?: string;
  origin?: string;
  destination?: string;
  equipment?: string;
  pickupFrom?: string; // yyyy-mm-dd
  pickupTo?: string;   // yyyy-mm-dd
  milesMin?: string;
  milesMax?: string;
};

export default function SearchPanel({
  value,
  onChange,
  onSearch,
  className
}: {
  value: Filters;
  onChange: (v: Filters) => void;
  onSearch: () => void;
  className?: string;
}) {
  const [local, setLocal] = useState<Filters>(value);

  useEffect(() => { setLocal(value); }, [value]);

  function set<K extends keyof Filters>(k: K, v: Filters[K]) {
    setLocal(prev => ({ ...prev, [k]: v ?? "" }));
  }
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    onChange(local);
    onSearch();
  }

  return (
    <form onSubmit={submit} className={cn("rounded-xl bg-white border p-4 space-y-3", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-700">Origin</Label>
          <div className="relative">
            <Input value={local.origin || ""} onChange={e=>set("origin", e.target.value)} placeholder="City, State" className="pl-9" />
            <span className="absolute inset-y-0 left-2 flex items-center text-gray-400">📍</span>
          </div>
        </div>
        <div>
          <Label className="text-gray-700">Destination</Label>
          <div className="relative">
            <Input value={local.destination || ""} onChange={e=>set("destination", e.target.value)} placeholder="City, State" className="pl-9" />
            <span className="absolute inset-y-0 left-2 flex items-center text-gray-400">📍</span>
          </div>
        </div>
        <div>
          <Label className="text-gray-700">Equipment</Label>
          <Input value={local.equipment || ""} onChange={e=>set("equipment", e.target.value)} placeholder="Dry Van / Reefer / Flatbed" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-gray-700">Pickup from</Label>
            <Input type="date" value={local.pickupFrom || ""} onChange={e=>set("pickupFrom", e.target.value)} />
          </div>
          <div>
            <Label className="text-gray-700">Pickup to</Label>
            <Input type="date" value={local.pickupTo || ""} onChange={e=>set("pickupTo", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-gray-700">Miles min</Label>
            <Input type="number" inputMode="numeric" value={local.milesMin || ""} onChange={e=>set("milesMin", e.target.value)} />
          </div>
          <div>
            <Label className="text-gray-700">Miles max</Label>
            <Input type="number" inputMode="numeric" value={local.milesMax || ""} onChange={e=>set("milesMax", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Input className="max-w-xs" placeholder="Search (RR, city, equipment…)" value={local.q || ""} onChange={e=>set("q", e.target.value)} />
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Search Loads</Button>
      </div>
    </form>
  );
}
