"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import SearchPanel from "./SearchPanel";
import LoadCard from "./LoadCard";
import MapPanel from "./MapPanel";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, Database } from "lucide-react";
import { useTheme } from "next-themes";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useIsAdmin } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
  const isAdmin = useIsAdmin();
  const [showEaxUploader, setShowEaxUploader] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const { theme } = useTheme();
  const { accentColor } = useAccentColor();

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                file.type === 'application/vnd.ms-excel' || 
                file.type === 'text/csv' ||
                file.name.endsWith('.xlsx') ||
                file.name.endsWith('.xls') ||
                file.name.endsWith('.csv'))) {
      setUploadFile(file);
    } else {
      toast.error("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file");
    }
  };


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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                file.type === 'application/vnd.ms-excel' || 
                file.type === 'text/csv' ||
                file.name.endsWith('.xlsx') ||
                file.name.endsWith('.xls') ||
                file.name.endsWith('.csv'))) {
      setUploadFile(file);
    } else {
      toast.error("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file");
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch("/api/admin/eax/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully processed ${result.data.rows_processed} loads`);
        setShowEaxUploader(false);
        setUploadFile(null);
        // Refresh loads after successful upload
        await loadLoads();
      } else {
        const error = await response.json();
        toast.error(error.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed");
    } finally {
      setUploadingFile(false);
    }
  };

  // Smart color handling for white accent color
  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <SearchPanel onSearch={handleSearch} loading={searching} />

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {loading ? "Loading loads..." : `${filteredLoads.length} loads found`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Please wait while we fetch available loads" : "Browse and book loads that match your criteria"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Admin EAX Uploader */}
          {isAdmin && (
            <Dialog open={showEaxUploader} onOpenChange={setShowEaxUploader}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
              >
                <Upload className="h-4 w-4 mr-2" />
                Update Loads
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-500" />
                    EAX Load Updater
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Upload an Excel (.xlsx, .xls) or CSV (.csv) file from EAX to update the loads database. Only published loads will be visible to carriers.
                  </p>
                  
                  {/* Drag and Drop Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Drag and drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Supports .xlsx, .xls, and .csv files
                    </p>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="mt-2"
                    />
                  </div>
                  
                  {/* Selected File Display */}
                  {uploadFile && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          Selected: {uploadFile.name}
                        </span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleFileUpload}
                      disabled={!uploadFile || uploadingFile}
                      className="flex-1"
                      style={{ 
                        backgroundColor: accentColor,
                        color: getButtonTextColor()
                      }}
                    >
                      {uploadingFile ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload & Process
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEaxUploader(false);
                        setUploadFile(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Results Layout */}
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
                onBookLoad={handleBookLoad}
              />
            ))
          )}
        </div>

        {/* Map Panel */}
        <div className="lg:col-span-1">
          <MapPanel />
        </div>
      </div>
    </div>
  );
}
