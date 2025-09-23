"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import SearchPanel from "./SearchPanel";
import LoadCard from "./LoadCard";
import MapPanel from "./MapPanel";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Demo data structure
interface Load {
  id: string;
  route: string;
  pickup: string;
  delivery: string;
  equipment: string;
  price: number;
  miles: number;
  broker: {
    name: string;
    avatar?: string;
    rating: number;
  };
}

interface SearchFilters {
  origin: string;
  destination: string;
  equipment: string;
}

// Demo data generator
const generateDemoLoads = (): Load[] => {
  const routes = [
    { from: "Chicago, IL", to: "Dallas, TX", miles: 925 },
    { from: "Los Angeles, CA", to: "Phoenix, AZ", miles: 373 },
    { from: "Atlanta, GA", to: "Miami, FL", miles: 661 },
    { from: "Denver, CO", to: "Seattle, WA", miles: 1317 },
    { from: "Houston, TX", to: "New York, NY", miles: 1630 },
    { from: "Portland, OR", to: "San Diego, CA", miles: 1255 },
    { from: "Boston, MA", to: "Chicago, IL", miles: 983 },
    { from: "Detroit, MI", to: "Atlanta, GA", miles: 729 },
  ];

  const equipmentTypes = ["Dry Van", "Reefer", "Flatbed", "Container", "Tanker"];
  const brokers = [
    { name: "Swift Transportation", rating: 4.8 },
    { name: "Schneider National", rating: 4.6 },
    { name: "J.B. Hunt", rating: 4.7 },
    { name: "Werner Enterprises", rating: 4.5 },
    { name: "Knight-Swift", rating: 4.9 },
  ];

  return routes.map((route, index) => ({
    id: `load-${index + 1}`,
    route: `${route.from} → ${route.to}`,
    pickup: `Today, 2:00 PM - 4:00 PM`,
    delivery: `Tomorrow, 8:00 AM - 10:00 AM`,
    equipment: equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)],
    price: Math.floor(Math.random() * 3000) + 1500,
    miles: route.miles,
    broker: brokers[Math.floor(Math.random() * brokers.length)],
  }));
};

export default function FindLoadsClient() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [filteredLoads, setFilteredLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Load demo data on mount
  useEffect(() => {
    const loadDemoData = () => {
      setLoading(true);
      setTimeout(() => {
        const demoLoads = generateDemoLoads();
        setLoads(demoLoads);
        setFilteredLoads(demoLoads);
        setLoading(false);
      }, 1000);
    };

    loadDemoData();
  }, []);

  const handleSearch = async (filters: SearchFilters) => {
    setSearching(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    let filtered = loads;
    
    // Filter by equipment
    if (filters.equipment !== "all") {
      const equipmentMap: { [key: string]: string } = {
        "dry-van": "Dry Van",
        "reefer": "Reefer",
        "flatbed": "Flatbed",
        "container": "Container",
        "tanker": "Tanker",
      };
      filtered = filtered.filter(load => load.equipment === equipmentMap[filters.equipment]);
    }
    
    // Filter by origin/destination (simple text search)
    if (filters.origin) {
      filtered = filtered.filter(load => 
        load.route.toLowerCase().includes(filters.origin.toLowerCase())
      );
    }
    
    if (filters.destination) {
      filtered = filtered.filter(load => 
        load.route.toLowerCase().includes(filters.destination.toLowerCase())
      );
    }
    
    setFilteredLoads(filtered);
    setSearching(false);
  };

  const handleBookLoad = (id: string) => {
    // TODO: Implement booking logic
    console.log("Booking load:", id);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      const demoLoads = generateDemoLoads();
      setLoads(demoLoads);
      setFilteredLoads(demoLoads);
      setLoading(false);
    }, 1000);
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
                key={load.id}
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
