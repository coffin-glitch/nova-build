"use client";

import { useState } from "react";
import { Map, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/layout/SectionCard";
import { cn } from "@/lib/utils";

interface CollapsibleMapPanelProps {
  className?: string;
}

export default function CollapsibleMapPanel({ className }: CollapsibleMapPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      // Handle dragging logic here if needed
      e.preventDefault();
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Collapsed State - Floating Button */}
      {!isExpanded && (
        <Button
          onClick={toggleExpanded}
          className="fixed bottom-6 right-6 z-50 shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90"
          size="lg"
        >
          <Map className="h-5 w-5 mr-2" />
          Show Map
        </Button>
      )}

      {/* Expanded State - Draggable Panel */}
      {isExpanded && (
        <div className="fixed top-0 right-0 h-full w-96 z-50 bg-background border-l border-border shadow-2xl">
          {/* Drag Handle */}
          <div
            className="absolute left-0 top-0 w-2 h-full bg-primary/20 cursor-col-resize hover:bg-primary/40 transition-colors"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          />

          {/* Panel Content */}
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Loads Map</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Map Content */}
            <div className="flex-1 p-4 overflow-y-auto">
              <SectionCard className="h-full">
                {/* Map Placeholder */}
                <div className="aspect-square bg-muted/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground mb-4">
                  <Map className="h-12 w-12 mb-2 text-muted" />
                  <p className="font-medium">Map Unavailable</p>
                  <p className="text-sm text-center">
                    Set `NEXT_PUBLIC_MAPBOX_TOKEN` to enable map view.
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Active: <span className="font-semibold">12</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Expired: <span className="font-semibold">3</span></span>
                  </div>
                </div>

                {/* Legend */}
                <div>
                  <h4 className="font-medium mb-2 text-sm">States</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>GA</span>
                      <span className="text-muted-foreground">5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>TX</span>
                      <span className="text-muted-foreground">3</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>CA</span>
                      <span className="text-muted-foreground">2</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>FL</span>
                      <span className="text-muted-foreground">2</span>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
