"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Glass } from "@/components/ui/glass";
import { MapPin, Truck, Clock, DollarSign, Search, RefreshCw, Filter } from "lucide-react";

interface Load {
  id: string;
  origin: string;
  destination: string;
  equipment: string;
  miles: number;
  rate: number;
  pickup_date: string;
  delivery_date: string;
  description?: string;
}

export default function FindLoadsClient() {
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
    if (filters.origin && !load.origin.toLowerCase().includes(filters.origin.toLowerCase())) {
      return false;
    }
    if (filters.destination && !load.destination.toLowerCase().includes(filters.destination.toLowerCase())) {
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
              <Card key={load.id} className="hover:shadow-card transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="capitalize">
                          {load.equipment.replace('-', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">#{load.id}</span>
                      </div>
                      <CardTitle className="text-xl">{load.origin} → {load.destination}</CardTitle>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">${load.rate.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">${(load.rate / load.miles).toFixed(2)}/mile</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{load.miles} miles</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{load.equipment.replace('-', ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(load.pickup_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Delivery: {new Date(load.delivery_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {load.description && (
                    <p className="text-sm text-muted-foreground mb-4">{load.description}</p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Posted 2 hours ago
                    </div>
                    <Button className="hover:scale-105 transition-transform">
                      Book Load
                    </Button>
                  </div>
                </CardContent>
              </Card>
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