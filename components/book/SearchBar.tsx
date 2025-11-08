"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { getButtonTextColor as getTextColor } from "@/lib/utils";

export default function SearchBar() {
  const sp = useSearchParams();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  const router = useRouter();
  
  // Smart color handling for button text based on background color
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };
  const [origin, setOrigin] = useState(sp.get("origin") || "");
  const [dest, setDest] = useState(sp.get("dest") || "");
  const [eqp, setEqp] = useState(sp.get("eqp") || "");

  useEffect(() => {
    setOrigin(sp.get("origin") || "");
    setDest(sp.get("dest") || "");
    setEqp(sp.get("eqp") || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.toString()]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (origin) params.set("origin", origin);
    if (dest) params.set("dest", dest);
    if (eqp) params.set("eqp", eqp);
    router.push(`/book-loads?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl p-6 shadow-md mb-8 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Find Your Next Load</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
          <div className="relative">
            <input value={origin} onChange={(e)=>setOrigin(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-10" placeholder="City, ST" />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
          <div className="relative">
            <input value={dest} onChange={(e)=>setDest(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-10" placeholder="City, ST" />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
          <select value={eqp} onChange={(e)=>setEqp(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="">All Equipment</option>
            <option>Dry Van</option>
            <option>Reefer</option>
            <option>Flatbed</option>
          </select>
        </div>
        <div className="flex items-end">
          <button 
            className="w-full py-2 px-4 rounded-md flex items-center justify-center transition-colors"
            style={{ 
              backgroundColor: accentColor,
              color: getButtonTextColor()
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${accentColor}dd`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = accentColor;
            }}
          >
            <Search className="h-4 w-4 mr-2" /> Search Loads
          </button>
        </div>
      </div>
    </form>
  );
}
