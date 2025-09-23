"use client";

import { Load } from "@/lib/types";
import { Map, MapPin } from "lucide-react";

interface MapPreviewProps {
  loads: Load[];
}

export default function MapPreview({ loads }: MapPreviewProps) {
  const getEquipmentColor = (equipment: string) => {
    switch (equipment?.toLowerCase()) {
      case "dry van":
        return "bg-blue-500";
      case "reefer":
        return "bg-green-500";
      case "flatbed":
        return "bg-yellow-500";
      case "container":
        return "bg-purple-500";
      case "step deck":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const equipmentTypes = Array.from(new Set(loads.map(load => load.equipment).filter(Boolean)));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Loads Map</h3>
      
      <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
        {/* Map placeholder - in a real app this would be a Google Maps or Mapbox integration */}
        <div className="text-center">
          <Map className="w-16 h-16 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Interactive map of available loads</p>
          <p className="text-sm text-gray-400 mt-1">
            {loads.length} load{loads.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Load Types</h4>
        {equipmentTypes.length > 0 ? (
          equipmentTypes.map((equipment) => (
            <div key={equipment} className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${getEquipmentColor(equipment)} mr-2`}></div>
              <span className="text-sm text-gray-700">{equipment} Loads</span>
            </div>
          ))
        ) : (
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-gray-300 mr-2"></div>
            <span className="text-sm text-gray-500">No loads available</span>
          </div>
        )}
      </div>
      
      {loads.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Total Revenue:</span>
              <span className="font-medium">
                ${loads.reduce((sum, load) => sum + (load.revenue || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Miles:</span>
              <span className="font-medium">
                {loads.reduce((sum, load) => sum + (load.total_miles || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
