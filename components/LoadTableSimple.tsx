"use client";

import { useEffect, useState } from "react";

interface Load {
  id: string;
  rr: string;
  tm: string;
  code: string;
  pickup_city: string;
  pickup_state: string;
  delivery_city: string;
  delivery_state: string;
  equipment: string;
  customer_name: string;
  miles: number;
  revenue: number;
  net: number;
  margin: number;
  published: boolean;
  updated_at: string;
}

export default function LoadTableSimple() {
  const [rows, setRows] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  
  console.log("LoadTableSimple component function called");

  const fetchRows = async () => {
    console.log("Fetching loads...");
    setLoading(true);
    try {
      const res = await fetch('/api/admin/loads', { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      console.log("Fetched data:", data);
      
      setRows(data.rows || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching loads:", error);
      setLoading(false);
      setRows([]);
    }
  };

  useEffect(() => {
    console.log("LoadTableSimple mounted, fetching...");
    fetchRows();
    
    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log("Timeout reached, stopping loading state");
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, []);

  console.log("LoadTableSimple rendering with rows:", rows.length, "loading:", loading);

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-purple-200">Loading loads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-white text-xl mb-4">Loads ({rows.length})</h3>
      
      {rows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-300">No loads found</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left p-2 text-gray-300">RR#</th>
                <th className="text-left p-2 text-gray-300">Customer</th>
                <th className="text-left p-2 text-gray-300">Route</th>
                <th className="text-right p-2 text-gray-300">Revenue</th>
                <th className="text-left p-2 text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((load) => (
                <tr key={load.id} className="border-b border-gray-700">
                  <td className="p-2 text-white">{load.rr}</td>
                  <td className="p-2 text-gray-300">{load.customer_name}</td>
                  <td className="p-2 text-gray-300">
                    {load.pickup_city}, {load.pickup_state} → {load.delivery_city}, {load.delivery_state}
                  </td>
                  <td className="p-2 text-right text-green-400">${load.revenue?.toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      load.published 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {load.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="text-center text-gray-400 mt-4">
              Showing 10 of {rows.length} loads
            </p>
          )}
        </div>
      )}
    </div>
  );
}
