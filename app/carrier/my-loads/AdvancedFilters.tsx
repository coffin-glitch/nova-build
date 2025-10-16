"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatDistance, formatMoney } from "@/lib/format";
import {
    Filter,
    Search,
    X
} from "lucide-react";
import { useMemo, useState } from "react";

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

interface FilterState {
  searchTerm: string;
  status: string[];
  dateRange: {
    start: string;
    end: string;
  };
  revenueRange: [number, number];
  distanceRange: [number, number];
  equipment: string[];
  originStates: string[];
  destinationStates: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const EQUIPMENT_TYPES = [
  'Dry Van', 'Refrigerated', 'Flatbed', 'Container', 'Tanker', 'Car Carrier'
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function AdvancedFilters({ onFiltersChange, initialFilters }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters || {
    searchTerm: '',
    status: [],
    dateRange: { start: '', end: '' },
    revenueRange: [0, 10000],
    distanceRange: [0, 3000],
    equipment: [],
    originStates: [],
    destinationStates: [],
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      searchTerm: '',
      status: [],
      dateRange: { start: '', end: '' },
      revenueRange: [0, 10000],
      distanceRange: [0, 3000],
      equipment: [],
      originStates: [],
      destinationStates: [],
      sortBy: 'created_at',
      sortOrder: 'desc'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.status.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.revenueRange[0] > 0 || filters.revenueRange[1] < 10000) count++;
    if (filters.distanceRange[0] > 0 || filters.distanceRange[1] < 3000) count++;
    if (filters.equipment.length > 0) count++;
    if (filters.originStates.length > 0) count++;
    if (filters.destinationStates.length > 0) count++;
    return count;
  }, [filters]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span>Advanced Filters</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by load number, origin, destination, customer..."
              value={filters.searchTerm}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            {['pending', 'accepted', 'rejected', 'countered', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'].map((status) => (
              <Button
                key={status}
                variant={filters.status.includes(status) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const newStatus = filters.status.includes(status)
                    ? filters.status.filter(s => s !== status)
                    : [...filters.status, status];
                  updateFilters({ status: newStatus });
                }}
              >
                {status.replace('_', ' ').toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Date From</label>
                <Input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateFilters({ 
                    dateRange: { ...filters.dateRange, start: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Date To</label>
                <Input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateFilters({ 
                    dateRange: { ...filters.dateRange, end: e.target.value }
                  })}
                />
              </div>
            </div>

            {/* Revenue Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Revenue Range: {formatMoney(filters.revenueRange[0])} - {formatMoney(filters.revenueRange[1])}
              </label>
              <Slider
                value={filters.revenueRange}
                onValueChange={(value) => updateFilters({ revenueRange: value as [number, number] })}
                max={10000}
                min={0}
                step={100}
                className="w-full"
              />
            </div>

            {/* Distance Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Distance Range: {formatDistance(filters.distanceRange[0])} - {formatDistance(filters.distanceRange[1])}
              </label>
              <Slider
                value={filters.distanceRange}
                onValueChange={(value) => updateFilters({ distanceRange: value as [number, number] })}
                max={3000}
                min={0}
                step={50}
                className="w-full"
              />
            </div>

            {/* Equipment Types */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment Types</label>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_TYPES.map((equipment) => (
                  <div key={equipment} className="flex items-center space-x-2">
                    <Checkbox
                      id={equipment}
                      checked={filters.equipment.includes(equipment)}
                      onCheckedChange={(checked) => {
                        const newEquipment = checked
                          ? [...filters.equipment, equipment]
                          : filters.equipment.filter(e => e !== equipment);
                        updateFilters({ equipment: newEquipment });
                      }}
                    />
                    <label htmlFor={equipment} className="text-sm">
                      {equipment}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Origin States */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Origin States</label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (!filters.originStates.includes(value)) {
                    updateFilters({ 
                      originStates: [...filters.originStates, value]
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add origin state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {filters.originStates.map((state) => (
                  <Badge key={state} variant="secondary" className="cursor-pointer">
                    {state}
                    <X 
                      className="w-3 h-3 ml-1" 
                      onClick={() => updateFilters({ 
                        originStates: filters.originStates.filter(s => s !== state)
                      })}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Destination States */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination States</label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (!filters.destinationStates.includes(value)) {
                    updateFilters({ 
                      destinationStates: [...filters.destinationStates, value]
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add destination state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {filters.destinationStates.map((state) => (
                  <Badge key={state} variant="secondary" className="cursor-pointer">
                    {state}
                    <X 
                      className="w-3 h-3 ml-1" 
                      onClick={() => updateFilters({ 
                        destinationStates: filters.destinationStates.filter(s => s !== state)
                      })}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilters({ sortBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date Created</SelectItem>
                    <SelectItem value="pickup_date">Pickup Date</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="miles">Distance</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Order</label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value) => updateFilters({ sortOrder: value as 'asc' | 'desc' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
