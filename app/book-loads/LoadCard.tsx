"use client";

import { Load } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Star } from "lucide-react";
import { formatCurrency, formatMiles } from "@/lib/format";

interface LoadCardProps {
  load: Load;
}

export default function LoadCard({ load }: LoadCardProps) {
  const getEquipmentColor = (equipment: string) => {
    switch (equipment?.toLowerCase()) {
      case "dry van":
        return "bg-blue-50 text-blue-600";
      case "reefer":
        return "bg-green-50 text-green-600";
      case "flatbed":
        return "bg-yellow-50 text-yellow-600";
      case "container":
        return "bg-purple-50 text-purple-600";
      case "step deck":
        return "bg-orange-50 text-orange-600";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const formatPickupTime = (date: string) => {
    if (!date) return "TBD";
    const pickupDate = new Date(date);
    const now = new Date();
    const isToday = pickupDate.toDateString() === now.toDateString();
    const isTomorrow = pickupDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    return pickupDate.toLocaleDateString();
  };

  const handleBookLoad = () => {
    // In a real app, this would open a booking modal or navigate to booking page
    console.log("Booking load:", load.rr_number);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <Badge className={`text-sm font-medium px-2 py-1 rounded mr-2 ${getEquipmentColor(load.equipment || "")}`}>
              {load.equipment || "Unknown"}
            </Badge>
            <span className="text-sm text-gray-500">#{load.rr_number}</span>
          </div>
          
          <h4 className="text-lg font-semibold text-gray-800">
            {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
          </h4>
          
          <p className="text-sm text-gray-500 mt-1">
            Pickup: {formatPickupTime(load.pickup_date || "")}
            {load.pickup_window && `, ${load.pickup_window}`}
          </p>
        </div>
        
        <div className="text-right ml-4">
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(load.revenue || 0)}
          </p>
          <p className="text-sm text-gray-500">
            {formatMiles(load.total_miles || 0)}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              {load.customer_name || "Unknown Customer"}
            </p>
            <div className="flex items-center">
              <Star className="h-3 w-3 text-yellow-400 fill-current" />
              <span className="text-xs text-gray-500 ml-1">4.8 (128 reviews)</span>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleBookLoad}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium"
        >
          Book Load
        </Button>
      </div>
    </div>
  );
}
