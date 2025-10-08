"use client";

import { Map } from "lucide-react";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";

export default function MapCard() {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for white accent color
  const getTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return theme === 'dark' ? '#ffffff' : '#000000';
    }
    return accentColor;
  };
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ color: getTextColor() }}>Loads Map</h3>
      <div className="h-96 rounded-xl bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Map className="w-16 h-16 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Interactive map coming soon (Mapbox/Google Maps)</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2" /> <span className="text-sm text-gray-700">Dry Van Loads</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-2" /> <span className="text-sm text-gray-700">Reefer Loads</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-yellow-500 mr-2" /> <span className="text-sm text-gray-700">Flatbed Loads</span></div>
      </div>
    </div>
  );
}
