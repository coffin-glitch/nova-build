"use client";

import { useState, useMemo } from "react";
import { Load } from "@/lib/types";
import SearchPanel from "./SearchPanel";
import LoadCard from "./LoadCard";
import MapPreview from "./MapPreview";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter } from "lucide-react";

interface BookLoadsClientProps {
  initialLoads: Load[];
}

export default function BookLoadsClient({ initialLoads }: BookLoadsClientProps) {
  const [loads] = useState<Load[]>(initialLoads);
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    equipment: "",
  });

  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      if (filters.origin && !load.origin_city?.toLowerCase().includes(filters.origin.toLowerCase()) && 
          !load.origin_state?.toLowerCase().includes(filters.origin.toLowerCase())) {
        return false;
      }
      if (filters.destination && !load.destination_city?.toLowerCase().includes(filters.destination.toLowerCase()) && 
          !load.destination_state?.toLowerCase().includes(filters.destination.toLowerCase())) {
        return false;
      }
      if (filters.equipment && filters.equipment !== "all" && load.equipment !== filters.equipment) {
        return false;
      }
      return true;
    });
  }, [loads, filters]);

  const handleSearch = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    // In a real app, this would trigger a refetch
    window.location.reload();
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg mb-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Find Your Next Load</h2>
        <SearchPanel onSearch={handleSearch} />
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Load Listings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">
              Available Loads ({filteredLoads.length})
            </h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="flex items-center">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Load Cards */}
          <div className="space-y-4">
            {filteredLoads.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
                <p className="text-gray-500">Try adjusting your search criteria to find more loads.</p>
              </div>
            ) : (
              filteredLoads.map((load) => (
                <LoadCard key={load.rr_number} load={load} />
              ))
            )}
          </div>
        </div>

        {/* Map Section */}
        <div className="lg:col-span-1">
          <MapPreview loads={filteredLoads} />
        </div>
      </div>
    </main>
  );
}