"use client";

import { MapPin, Truck } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { Badge } from "@/components/ui/badge";

interface MapPanelProps {
  className?: string;
}

const equipmentTypes = [
  { type: "Dry Van", color: "bg-blue-500", count: 12 },
  { type: "Reefer", color: "bg-green-500", count: 8 },
  { type: "Flatbed", color: "bg-orange-500", count: 5 },
  { type: "Container", color: "bg-purple-500", count: 3 },
  { type: "Tanker", color: "bg-red-500", count: 2 },
];

export default function MapPanel({ className }: MapPanelProps) {
  const hasMapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <SectionCard className={`sticky top-24 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Loads Map</h3>
        </div>

        {hasMapboxToken ? (
          <div className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Mapbox integration</p>
              <p className="text-xs text-muted-foreground mt-1">Map will load here</p>
            </div>
          </div>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800 dark:to-surface-900 rounded-lg flex items-center justify-center border border-border">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-2">Interactive Map</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Add your Mapbox token to see load locations
              </p>
              <div className="text-xs text-muted-foreground">
                <code className="bg-muted px-2 py-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Equipment Types</h4>
          <div className="space-y-2">
            {equipmentTypes.map((equipment) => (
              <div key={equipment.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${equipment.color}`} />
                  <span className="text-sm text-foreground">{equipment.type}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {equipment.count}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-foreground">30</div>
              <div className="text-xs text-muted-foreground">Total Loads</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">$2.4M</div>
              <div className="text-xs text-muted-foreground">Total Value</div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
