"use client";

import { useState } from "react";
import { Search, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionCard from "@/components/layout/SectionCard";

const equipmentTypes = [
  { value: "all", label: "All Equipment" },
  { value: "dry-van", label: "Dry Van" },
  { value: "reefer", label: "Reefer" },
  { value: "flatbed", label: "Flatbed" },
  { value: "container", label: "Container" },
  { value: "tanker", label: "Tanker" },
];

interface SearchFilters {
  origin: string;
  destination: string;
  equipment: string;
}

interface SearchPanelProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

export default function SearchPanel({ onSearch, loading = false }: SearchPanelProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    origin: "",
    destination: "",
    equipment: "all",
  });

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <SectionCard className="group hover:shadow-lg hover:shadow-black/5 transition-all duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Origin */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Origin</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="City, State"
              value={filters.origin}
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Destination</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="City, State"
              value={filters.destination}
              onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
        </div>

        {/* Equipment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Equipment</label>
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Select
              value={filters.equipment}
              onValueChange={(value) => setFilters({ ...filters, equipment: value })}
            >
              <SelectTrigger className="pl-10">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Button */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground opacity-0">Search</label>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="w-full group-hover:shadow-lg transition-all duration-300"
            size="lg"
          >
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching..." : "Search Loads"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
