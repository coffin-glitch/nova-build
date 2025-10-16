"use client";

import LoadCard from "@/components/find-loads/LoadCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Filter, MapPin, RefreshCw, Search, Truck } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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

export default function FindLoadsClient() {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for white accent color
  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };
  
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    equipment: "all"
  });

  useEffect(() => {
    fetchLoads();
  }, [filters]);

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.origin) params.append("origin", filters.origin);
      if (filters.destination) params.append("destination", filters.destination);
      if (filters.equipment !== "all") params.append("equipment", filters.equipment);

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch loads");
      }
      
      const data = await response.json();
      setLoads(data.loads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load loads");
    } finally {
      setLoading(false);
    }
  };

  const filteredLoads = loads.filter(load => {
    const origin = load.origin_city && load.origin_state ? `${load.origin_city}, ${load.origin_state}` : '';
    const destination = load.destination_city && load.destination_state ? `${load.destination_city}, ${load.destination_state}` : '';
    
    if (filters.origin && !origin.toLowerCase().includes(filters.origin.toLowerCase())) {
      return false;
    }
    if (filters.destination && !destination.toLowerCase().includes(filters.destination.toLowerCase())) {
      return false;
    }
    if (filters.equipment !== "all" && load.equipment !== filters.equipment) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-muted rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchLoads}>Try Again</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <Glass className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Origin</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter origin city"
                value={filters.origin}
                onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter destination city"
                value={filters.destination}
                onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Equipment</label>
            <Select value={filters.equipment} onValueChange={(value) => setFilters(prev => ({ ...prev, equipment: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                <SelectItem value="dry-van">Dry Van</SelectItem>
                <SelectItem value="reefer">Reefer</SelectItem>
                <SelectItem value="flatbed">Flatbed</SelectItem>
                <SelectItem value="container">Container</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchLoads} className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </Glass>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Available Loads ({filteredLoads.length})</h3>
          <Button variant="outline" size="sm" onClick={fetchLoads}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Loads List */}
        <div className="xl:col-span-2 space-y-4">
          {filteredLoads.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No loads found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or check back later</p>
            </Card>
          ) : (
            filteredLoads.map((load) => (
              <LoadCard
                key={load.rr_number}
                {...load}
                onOfferSubmitted={fetchLoads}
              />
            ))
          )}
        </div>

        {/* Map Sidebar */}
        <div className="xl:col-span-1">
          <Glass className="p-6 h-fit">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Route Map</h3>
              <div className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Map Preview</p>
                  <p className="text-xs text-muted-foreground mt-1">Select a load to view route</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span>Origin</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-3 h-3 bg-destructive rounded-full"></div>
                  <span>Destination</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                  <span>Stops</span>
                </div>
              </div>
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}