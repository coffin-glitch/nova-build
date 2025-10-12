"use client";

import { useAdminView } from "@/components/providers/AdminViewProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Shield, Truck } from "lucide-react";
import { useState } from "react";

export function AdminCarrierViewToggle() {
  const { viewMode, setViewMode, isAdmin, isCarrierView } = useAdminView();
  const [isHovered, setIsHovered] = useState(false);

  if (!isAdmin) {
    return null;
  }

  const toggleViewMode = () => {
    setViewMode(isCarrierView ? 'admin' : 'carrier');
  };

  return (
    <div className="flex items-center gap-2">
      {/* View Mode Indicator */}
      <Badge 
        variant={isCarrierView ? "secondary" : "default"}
        className={`flex items-center gap-1 ${
          isCarrierView 
            ? "bg-orange-100 text-orange-800 border-orange-200" 
            : "bg-blue-100 text-blue-800 border-blue-200"
        }`}
      >
        {isCarrierView ? (
          <>
            <Truck className="w-3 h-3" />
            Carrier View
          </>
        ) : (
          <>
            <Shield className="w-3 h-3" />
            Admin View
          </>
        )}
      </Badge>

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleViewMode}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-2 hover:bg-gray-50 transition-colors"
        title={isCarrierView ? "Switch to Admin View" : "Switch to Carrier View"}
      >
        {isCarrierView ? (
          <>
            <EyeOff className="w-4 h-4" />
            {isHovered && <span className="text-xs">Admin</span>}
          </>
        ) : (
          <>
            <Eye className="w-4 h-4" />
            {isHovered && <span className="text-xs">Carrier</span>}
          </>
        )}
      </Button>
    </div>
  );
}

export function AdminViewIndicator() {
  const { isCarrierView, isAdmin } = useAdminView();

  if (!isAdmin || !isCarrierView) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none">
      <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
        <Truck className="w-4 h-4" />
        <span className="text-sm font-medium">Carrier View Mode Active</span>
      </div>
    </div>
  );
}
