"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import LoadCard from "./LoadCard";
import MapPanel from "./MapPanel";
import SearchPanel from "./SearchPanel";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Real data structure from EAX
interface Load {
  rr_number: string;
  tm_number?: string;
  status_code?: string;
  pickup_date?: string;
  pickup_window?: string;
  delivery_date?: string;
  delivery_window?: string;
  equipment?: string;
  total_miles?: number;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  vendor_name?: string;
  dispatcher_name?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface SearchFilters {
  origin: string;
  destination: string;
  equipment: string;
}

interface LoadsResponse {
  loads: Load[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function FindLoadsClient() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [filteredLoads, setFilteredLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Check profile status for access restriction
  const { data: profileData, isLoading: profileLoading } = useSWR(
    `/api/carrier/profile`,
    fetcher,
    {
      fallbackData: { ok: true, data: null }
    }
  );

  const profile = profileData?.data;

  // Load real data on mount
  useEffect(() => {
    loadLoads();
  }, []);

  const loadLoads = async (filters?: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.origin) params.append("origin", filters.origin);
      if (filters?.destination) params.append("destination", filters.destination);
      if (filters?.equipment) params.append("equipment", filters.equipment);
      
      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.ok) {
        const data: LoadsResponse = await response.json();
        setLoads(data.loads);
        setFilteredLoads(data.loads);
      } else {
        console.error("Failed to fetch loads");
        toast.error("Failed to load loads");
      }
    } catch (error) {
      console.error("Error loading loads:", error);
      toast.error("Error loading loads");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (filters: SearchFilters) => {
    setSearching(true);
    await loadLoads(filters);
    setSearching(false);
  };

  const handleBookLoad = (id: string) => {
    // TODO: Implement booking logic
    console.log("Booking load:", id);
    toast.success("Load booking functionality coming soon!");
  };

  const handleRefresh = () => {
    loadLoads();
  };

  // Show access restriction banner for unapproved users
  const renderAccessBanner = () => {
    if (profileLoading) return null;
    
    if (!profile || profile.profile_status !== 'approved') {
      return (
        <Card className="border-l-4 border-l-red-500 dark:border-l-red-400 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700 dark:text-red-400">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Access to website features are restricted until you setup your profile and it has been reviewed by an admin.</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete your profile to gain access to all features and start bidding on loads.
                </p>
              </div>
              <Button asChild>
                <Link href="/carrier/profile">
                  <User className="h-4 w-4 mr-2" />
                  Complete Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Access Restriction Banner */}
      {renderAccessBanner()}
      
      {/* Search Panel - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <SearchPanel onSearch={handleSearch} loading={searching} />
      )}

      {/* Results Header - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {loading ? "Loading loads..." : `${filteredLoads.length} loads found`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Please wait..." : "Browse available loads and start bidding"}
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      {/* Results Layout - Only show for approved users */}
      {profile?.profile_status === 'approved' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loads List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            // Skeleton loading states
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-24 mb-2" />
                      <Skeleton className="h-5 w-48 mb-1" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-8 w-20 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No loads found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or check back later for new loads.
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Loads
              </Button>
            </div>
          ) : (
            // Load cards
            filteredLoads.map((load) => (
              <LoadCard
                key={load.rr_number}
                {...load}
              />
            ))
          )}
        </div>

        {/* Map Panel */}
        <div className="lg:col-span-1">
          <MapPanel />
        </div>
        </div>
      )}
    </div>
  );
}
