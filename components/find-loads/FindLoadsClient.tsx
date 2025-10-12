"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import LoadCard from "./LoadCard";
import MapPanel from "./MapPanel";
import SearchPanel from "./SearchPanel";

// Real data structure from EAX
interface Load {
  rr_number: string;
  tm_number?: string;
  status_code?: string;
  pickup_date?: string;
  pickup_window?: string;
  delivery_date?: string;
  delivery_window?: string;
  equipment?: string;
  total_miles?: number;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  vendor_name?: string;
  dispatcher_name?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface SearchFilters {
  origin: string;
  destination: string;
  equipment: string;
}

interface LoadsResponse {
  loads: Load[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function FindLoadsClient() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [filteredLoads, setFilteredLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Load real data on mount
  useEffect(() => {
    loadLoads();
  }, []);

  const loadLoads = async (filters?: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.origin) params.append("origin", filters.origin);
      if (filters?.destination) params.append("destination", filters.destination);
      if (filters?.equipment) params.append("equipment", filters.equipment);
      
      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.ok) {
        const data: LoadsResponse = await response.json();
        setLoads(data.loads);
        setFilteredLoads(data.loads);
      } else {
        console.error("Failed to fetch loads");
        toast.error("Failed to load loads");
      }
    } catch (error) {
      console.error("Error loading loads:", error);
      toast.error("Error loading loads");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (filters: SearchFilters) => {
    setSearching(true);
    await loadLoads(filters);
    setSearching(false);
  };

  const handleBookLoad = (id: string) => {
    // TODO: Implement booking logic
    console.log("Booking load:", id);
    toast.success("Load booking functionality coming soon!");
  };

  const handleRefresh = () => {
    loadLoads();
  };

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <SearchPanel onSearch={handleSearch} loading={searching} />

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {loading ? "Loading loads..." : `${filteredLoads.length} loads found`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Please wait while we fetch available loads" : "Browse and book loads that match your criteria"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Results Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loads List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            // Skeleton loading states
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-24 mb-2" />
                      <Skeleton className="h-5 w-48 mb-1" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-8 w-20 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No loads found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or check back later for new loads.
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Loads
              </Button>
            </div>
          ) : (
            // Load cards
            filteredLoads.map((load) => (
              <LoadCard
                key={load.rr_number}
                {...load}
                onBookLoad={handleBookLoad}
              />
            ))
          )}
        </div>

        {/* Map Panel */}
        <div className="lg:col-span-1">
          <MapPanel />
        </div>
      </div>
    </div>
  );
}
