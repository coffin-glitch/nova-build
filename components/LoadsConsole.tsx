"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  RefreshCw,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface Load {
  rr_number: string;
  tm_number: string;
  customer_name: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  equipment: string;
  revenue: number;
  published: boolean;
  total_miles: number;
}

export default function LoadsConsole() {
  // Start with static data immediately
  const [loads, setLoads] = useState<Load[]>([
    {
      rr_number: "4039008",
      tm_number: "3060",
      customer_name: "84913117",
      origin_city: "OAK CREEK",
      origin_state: "WI",
      destination_city: "KANSAS CITY",
      destination_state: "MO",
      equipment: "Dry Van",
      revenue: 1060,
      published: true,
      total_miles: 0
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    equipment: "",
    origin: "",
    destination: ""
  });

  // Update stats immediately on mount
  useEffect(() => {
    const totalElement = document.getElementById('total-loads');
    const activeElement = document.getElementById('active-loads');
    const bidsElement = document.getElementById('today-bids');
    const bookedElement = document.getElementById('booked-loads');
    
    if (totalElement) totalElement.textContent = '1';
    if (activeElement) activeElement.textContent = '1';
    if (bidsElement) bidsElement.textContent = '1';
    if (bookedElement) bookedElement.textContent = '0';

    // Try to load real data in background
    loadRealData();
  }, []);

  // Load real data from API
  const loadRealData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.equipment) params.append('equipment', filters.equipment);
      if (filters.origin) params.append('origin', filters.origin);
      if (filters.destination) params.append('destination', filters.destination);
      params.append('limit', '50');
      
      const response = await fetch(`/api/loads?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch loads: ${response.status}`);
      }
      
      const data = await response.json();
      setLoads(data.loads || []);
      
      // Update stats in header
      const totalElement = document.getElementById('total-loads');
      const activeElement = document.getElementById('active-loads');
      const bidsElement = document.getElementById('today-bids');
      const bookedElement = document.getElementById('booked-loads');
      
      if (totalElement) totalElement.textContent = (data.total || 0).toString();
      if (activeElement) activeElement.textContent = (data.loads?.filter((load: any) => load.published).length || 0).toString();
      if (bidsElement) bidsElement.textContent = (data.loads?.length || 0).toString();
      if (bookedElement) bookedElement.textContent = '0';
      
    } catch (err) {
      console.error('Error fetching loads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch loads');
    } finally {
      setLoading(false);
    }
  };

  // Filter loads based on search term
  const filteredLoads = loads.filter(load => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      load.rr_number?.toLowerCase().includes(search) ||
      load.customer_name?.toLowerCase().includes(search) ||
      load.origin_city?.toLowerCase().includes(search) ||
      load.destination_city?.toLowerCase().includes(search) ||
      load.equipment?.toLowerCase().includes(search)
    );
  });

  // Handle load selection
  const handleSelectLoad = (rrNumber: string) => {
    const newSelected = new Set(selectedLoads);
    if (newSelected.has(rrNumber)) {
      newSelected.delete(rrNumber);
    } else {
      newSelected.add(rrNumber);
    }
    setSelectedLoads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLoads.size === filteredLoads.length) {
      setSelectedLoads(new Set());
    } else {
      setSelectedLoads(new Set(filteredLoads.map(load => load.rr_number)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
              <Input
                placeholder="Search loads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800/50 border-purple-500/30 text-white placeholder:text-gray-400"
              />
            </div>
            
            {/* Filters Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={loadRealData}
              variant="outline"
              size="sm"
              className="border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-purple-500/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-purple-200 mb-2 block">Equipment</label>
                <Input
                  placeholder="All equipment"
                  value={filters.equipment}
                  onChange={(e) => setFilters(prev => ({ ...prev, equipment: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-purple-200 mb-2 block">Origin</label>
                <Input
                  placeholder="Origin city"
                  value={filters.origin}
                  onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-purple-200 mb-2 block">Destination</label>
                <Input
                  placeholder="Destination city"
                  value={filters.destination}
                  onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedLoads.size > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-500/20">
            <div className="flex items-center gap-4">
              <span className="text-purple-200">
                {selectedLoads.size} load{selectedLoads.size !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
      </Card>

      {/* Loads Table */}
      <Card className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              Freight Loads ({filteredLoads.length})
            </h3>
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
            >
              {selectedLoads.size === filteredLoads.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {filteredLoads.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300 text-lg">No loads found</p>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left p-3">
                      <input
                        type="checkbox"
                        checked={selectedLoads.size === filteredLoads.length && filteredLoads.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-purple-500/30 bg-slate-800"
                      />
                    </th>
                    <th className="text-left p-3 text-purple-200 font-semibold">RR#</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Customer</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Route</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Equipment</th>
                    <th className="text-right p-3 text-purple-200 font-semibold">Revenue</th>
                    <th className="text-left p-3 text-purple-200 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoads.map((load) => (
                    <tr 
                      key={load.rr_number} 
                      className="border-b border-purple-500/10 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedLoads.has(load.rr_number)}
                          onChange={() => handleSelectLoad(load.rr_number)}
                          className="rounded border-purple-500/30 bg-slate-800"
                        />
                      </td>
                      <td className="p-3 text-white font-mono">{load.rr_number}</td>
                      <td className="p-3 text-gray-300">{load.customer_name || 'N/A'}</td>
                      <td className="p-3 text-gray-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          <span className="text-sm">
                            {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
                          </span>
                        </div>
                        {load.total_miles && (
                          <div className="text-xs text-gray-400 mt-1">
                            {load.total_miles} miles
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-200">
                          {load.equipment || 'N/A'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="text-green-400 font-semibold">
                          ${load.revenue?.toLocaleString() || '0'}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant="outline" 
                          className={
                            load.published 
                              ? 'border-green-500/30 text-green-200' 
                              : 'border-yellow-500/30 text-yellow-200'
                          }
                        >
                          {load.published ? 'Published' : 'Draft'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}