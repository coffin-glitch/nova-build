"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Search } from "lucide-react";

interface SearchPanelProps {
  onSearch: (filters: {
    origin: string;
    destination: string;
    equipment: string;
  }) => void;
}

export default function SearchPanel({ onSearch }: SearchPanelProps) {
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    equipment: "",
  });

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleInputChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
        <div className="relative">
          <Input
            type="text"
            placeholder="City, State"
            value={filters.origin}
            onChange={(e) => handleInputChange("origin", e.target.value)}
            className="pl-10"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
        <div className="relative">
          <Input
            type="text"
            placeholder="City, State"
            value={filters.destination}
            onChange={(e) => handleInputChange("destination", e.target.value)}
            className="pl-10"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
        <Select value={filters.equipment} onValueChange={(value) => handleInputChange("equipment", value)}>
          <SelectTrigger>
            <SelectValue placeholder="All Equipment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Equipment</SelectItem>
            <SelectItem value="Dry Van">Dry Van</SelectItem>
            <SelectItem value="Reefer">Reefer</SelectItem>
            <SelectItem value="Flatbed">Flatbed</SelectItem>
            <SelectItem value="Container">Container</SelectItem>
            <SelectItem value="Step Deck">Step Deck</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-end">
        <Button 
          onClick={handleSearch}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Loads
        </Button>
      </div>
    </div>
  );
}
