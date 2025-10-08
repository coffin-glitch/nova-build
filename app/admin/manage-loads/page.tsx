"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Activity,
    AlertTriangle,
    Archive,
    BarChart3,
    CheckCircle,
    DollarSign,
    Download,
    Eye,
    FileText,
    Filter,
    Loader2,
    MapPin,
    MoreHorizontal,
    RefreshCw,
    Search,
    Trash2,
    TrendingUp,
    Truck,
    XCircle,
    Zap
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Enhanced Types
interface Load {
  rr_number: string;
  tm_number?: string;
  status_code: "active" | "published" | "completed" | "cancelled" | "archived";
  pickup_date: string;
  pickup_window?: string;
  delivery_date: string;
  delivery_window?: string;
  revenue: number | null;
  purchase: number | null;
  net: number | null;
  margin: number | null;
  equipment: string;
  customer_name?: string;
  driver_name?: string;
  total_miles: number | null;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  vendor_name?: string;
  dispatcher_name?: string;
  updated_at: string;
  published: boolean;
}

interface LoadStats {
  total: number;
  active: number;
  published: number;
  completed: number;
  cancelled: number;
  archived: number;
  totalRevenue: number;
  totalMargin: number;
  averageMargin: number;
  totalMiles: number;
}

interface FilterState {
  search: string;
  status: string;
  equipment: string;
  dateRange: string;
  revenueRange: string;
  origin: string;
  destination: string;
}

interface DebugInfo {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: any;
}

export default function ManageLoadsPage() {
  // Core State
  const [loads, setLoads] = useState<Load[]>([]);
  const [stats, setStats] = useState<LoadStats>({
    total: 0,
    active: 0,
    published: 0,
    completed: 0,
    cancelled: 0,
    archived: 0,
    totalRevenue: 0,
    totalMargin: 0,
    averageMargin: 0,
    totalMiles: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Enhanced Filters
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    equipment: "all",
    dateRange: "all",
    revenueRange: "all",
    origin: "",
    destination: ""
  });
  
  // Selection and Actions
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [showLoadDetails, setShowLoadDetails] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  // UI State
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Debug logging function
  const addDebugLog = useCallback((level: "info" | "warn" | "error", message: string, data?: any) => {
    const log: DebugInfo = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    setDebugLogs(prev => [log, ...prev].slice(0, 100));
  }, []);

  // Enhanced fetch loads with proper data structure
  const fetchLoads = useCallback(async () => {
    try {
      setLoading(true);
      addDebugLog("info", "Fetching loads from API", { filters, currentPage, itemsPerPage });
      
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.equipment !== "all" && { equipment: filters.equipment }),
        ...(filters.origin && { origin: filters.origin }),
        ...(filters.destination && { destination: filters.destination })
      });

      const response = await fetch(`/api/loads?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      addDebugLog("info", "Successfully fetched loads", { 
        count: data.loads?.length || 0,
        total: data.pagination?.total || 0
      });
      
      setLoads(data.loads || []);
      setTotalCount(data.pagination?.total || 0);
      
      // Calculate enhanced stats
      const calculatedStats = calculateStats(data.loads || []);
      setStats(calculatedStats);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      addDebugLog("error", "Failed to fetch loads", { error: errorMessage });
      setError(errorMessage);
      toast.error("Failed to load loads");
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, itemsPerPage, addDebugLog]);

  // Calculate comprehensive stats
  const calculateStats = useCallback((loadsData: Load[]): LoadStats => {
    const stats = {
      total: loadsData.length,
      active: 0,
      published: 0,
      completed: 0,
      cancelled: 0,
      archived: 0,
      totalRevenue: 0,
      totalMargin: 0,
      averageMargin: 0,
      totalMiles: 0
    };

            loadsData.forEach(load => {
              // Count by status
              switch (load.status_code) {
                case "active": stats.active++; break;
                case "published": stats.published++; break;
                case "completed": stats.completed++; break;
                case "cancelled": stats.cancelled++; break;
                case "archived": stats.archived++; break;
              }

              // Financial calculations
              stats.totalRevenue += load.revenue ?? 0;
              stats.totalMargin += load.margin ?? 0;
              stats.totalMiles += load.total_miles ?? 0;
            });

    stats.averageMargin = stats.total > 0 ? stats.totalMargin / stats.total : 0;

    return stats;
  }, []);

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  // Enhanced filter handlers
  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Enhanced selection handlers
  const handleSelectLoad = useCallback((rrNumber: string, checked: boolean) => {
    setSelectedLoads(prev => {
      const newSelection = new Set(prev);
      if (checked) {
        newSelection.add(rrNumber);
      } else {
        newSelection.delete(rrNumber);
      }
      return newSelection;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedLoads(new Set(loads.map(load => load.rr_number)));
    } else {
      setSelectedLoads(new Set());
    }
  }, [loads]);

          // Enhanced status update
          const handleUpdateStatus = useCallback(async (rrNumber: string, newStatus: Load["status_code"]) => {
            try {
              addDebugLog("info", "Updating load status", { rrNumber, newStatus });
              
              const response = await fetch(`/api/loads/individual/${rrNumber}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }

              const result = await response.json();
              
              if (result.success) {
                // Update local state
                setLoads(prev => prev.map(load => 
                  load.rr_number === rrNumber ? { ...load, status_code: newStatus, updated_at: result.load.updated_at } : load
                ));

                addDebugLog("info", "Successfully updated load status", { result });
                toast.success("Status updated successfully");
              } else {
                throw new Error(result.error || "Update failed");
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
              addDebugLog("error", "Failed to update load status", { error: errorMessage });
              toast.error(`Failed to update status: ${errorMessage}`);
            }
          }, [addDebugLog]);

          // Enhanced bulk actions
          const handleBulkAction = useCallback(async (action: string) => {
            if (selectedLoads.size === 0) {
              toast.error("Please select loads first");
              return;
            }

            try {
              addDebugLog("info", "Performing bulk action", { action, count: selectedLoads.size });
              
              const response = await fetch("/api/loads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action,
                  rrNumbers: Array.from(selectedLoads),
                }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }

              const result = await response.json();
              
              if (result.success) {
                addDebugLog("info", "Successfully performed bulk action", { result });
                toast.success(result.message || `Bulk ${action} completed successfully`);
                
                // Refresh data
                await fetchLoads();
                setSelectedLoads(new Set());
              } else {
                throw new Error(result.error || "Bulk action failed");
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
              addDebugLog("error", "Failed to perform bulk action", { error: errorMessage });
              toast.error(`Failed to ${action} loads: ${errorMessage}`);
            }
          }, [selectedLoads, fetchLoads, addDebugLog]);

          // Export functionality
          const handleExport = useCallback(async (format: "csv" | "excel") => {
            try {
              addDebugLog("info", "Exporting loads", { format, count: loads.length });
              
              const response = await fetch(`/api/loads/export?format=${format}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  filters,
                  rrNumbers: Array.from(selectedLoads)
                }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }

              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `loads-export-${Date.now()}.${format === "csv" ? "csv" : "xlsx"}`;
              a.click();
              window.URL.revokeObjectURL(url);

              addDebugLog("info", "Successfully exported loads");
              toast.success("Export completed successfully");
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
              addDebugLog("error", "Failed to export loads", { error: errorMessage });
              toast.error(`Failed to export loads: ${errorMessage}`);
            }
          }, [loads, filters, selectedLoads, addDebugLog]);

          // EAX Upload functionality
          const handleEAXUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            try {
              addDebugLog("info", "Uploading EAX file", { fileName: file.name, fileSize: file.size });
              
              const formData = new FormData();
              formData.append('file', file);

              const response = await fetch('/api/admin/eax/upload', {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
              }

              const result = await response.json();
              
              addDebugLog("info", "Successfully uploaded EAX file", { result });
              toast.success(`Successfully uploaded ${result.totalLoads || 0} loads from EAX file`);
              
              // Refresh data
              await fetchLoads();
              
              // Reset file input
              event.target.value = '';
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
              addDebugLog("error", "Failed to upload EAX file", { error: errorMessage });
              toast.error(`Failed to upload EAX file: ${errorMessage}`);
              
              // Reset file input
              event.target.value = '';
            }
          }, [fetchLoads, addDebugLog]);

  // Utility functions
  const getStatusBadgeVariant = useCallback((status: Load["status_code"]) => {
    switch (status) {
      case "active": return "default";
      case "published": return "secondary";
      case "completed": return "success";
      case "cancelled": return "destructive";
      case "archived": return "outline";
      default: return "default";
    }
  }, []);

  const formatCurrency = useCallback((amount: number | null | undefined) => {
    const safeAmount = amount ?? 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(safeAmount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const formatNumber = useCallback((value: number | null | undefined) => {
    const safeValue = value ?? 0;
    return safeValue.toLocaleString();
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Manage Loads</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Comprehensive load management and monitoring</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showDebug ? "Hide" : "Show"} Debug
            </Button>
            <Button
              variant="outline"
              onClick={() => setFilters(prev => ({ ...prev, status: prev.status === "archived" ? "all" : "archived" }))}
              className={`flex items-center gap-2 ${filters.status === "archived" ? "bg-orange-100 border-orange-300" : ""}`}
            >
              <Archive className="h-4 w-4" />
              {filters.status === "archived" ? "Show All" : "Archived Loads"}
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById('eax-upload')?.click()}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Upload EAX
            </Button>
            <input
              id="eax-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleEAXUpload}
            />
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("excel")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            <Button onClick={fetchLoads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Load Count Stats */}
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total Loads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-blue-100 text-sm">All loads in system</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Active Loads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.active}</div>
              <p className="text-green-100 text-sm">Currently active</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.published}</div>
              <p className="text-purple-100 text-sm">Available for booking</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completed}</div>
              <p className="text-emerald-100 text-sm">Successfully delivered</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-yellow-100 text-sm">All time revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats.totalMargin)}</div>
              <p className="text-indigo-100 text-sm">Profit margin</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Avg Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats.averageMargin)}</div>
              <p className="text-pink-100 text-sm">Per load average</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
            <CardDescription>
              Filter and search through your loads with precision
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search RR#, origin, destination..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="published">Published</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="archived">Archived</option>
              </select>

              {/* Equipment Filter */}
              <select
                value={filters.equipment}
                onChange={(e) => handleFilterChange("equipment", e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="all">All Equipment</option>
                <option value="dry_van">Dry Van</option>
                <option value="reefer">Reefer</option>
                <option value="flatbed">Flatbed</option>
                <option value="container">Container</option>
              </select>

              {/* Items Per Page */}
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            {/* Additional Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Origin city/state"
                  value={filters.origin}
                  onChange={(e) => handleFilterChange("origin", e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Destination city/state"
                  value={filters.destination}
                  onChange={(e) => handleFilterChange("destination", e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    search: "",
                    status: "all",
                    equipment: "all",
                    dateRange: "all",
                    revenueRange: "all",
                    origin: "",
                    destination: ""
                  })}
                  className="flex-1"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Enhanced Bulk Actions */}
        {selectedLoads.size > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-900 dark:text-orange-100">
                    {selectedLoads.size} load(s) selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleBulkAction("archive")}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                  >
                    <Archive className="h-4 w-4" />
                    Archive Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction("delete")}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLoads(new Set())}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Loads Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Loads Management
                </CardTitle>
                <CardDescription>
                  {totalCount} total loads • {loads.length} currently displayed
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  Table View
                </Button>
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                >
                  Card View
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading loads...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Enhanced Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg font-medium text-sm text-gray-700 dark:text-gray-200">
                  <div className="col-span-1">
                    <Checkbox
                      checked={selectedLoads.size === loads.length && loads.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
                  <div className="col-span-2">RR Number</div>
                  <div className="col-span-2">Route</div>
                  <div className="col-span-1">Equipment</div>
                  <div className="col-span-1">Revenue</div>
                  <div className="col-span-1">Margin</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Dates</div>
                  <div className="col-span-2">Actions</div>
                </div>

                {/* Enhanced Table Rows */}
                {loads.map((load) => (
                  <div key={load.rr_number} className="grid grid-cols-12 gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={selectedLoads.has(load.rr_number)}
                        onCheckedChange={(checked) => handleSelectLoad(load.rr_number, checked as boolean)}
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="font-mono text-sm font-medium text-blue-600">{load.rr_number}</div>
                      {load.tm_number && (
                        <div className="text-xs text-gray-500">TM: {load.tm_number}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm font-medium">{load.origin_city}, {load.origin_state}</div>
                      <div className="text-xs text-gray-500">to {load.destination_city}, {load.destination_state}</div>
                    </div>
                    <div className="col-span-1">
                      <Badge variant="outline" className="text-xs">
                        {load.equipment}
                      </Badge>
                    </div>
                    <div className="col-span-1">
                      <div className="text-sm font-medium text-green-600">{formatCurrency(load.revenue)}</div>
                    </div>
                    <div className="col-span-1">
                      <div className="text-sm font-medium text-blue-600">{formatCurrency(load.margin)}</div>
                    </div>
                    <div className="col-span-1">
                      <div className="flex flex-col gap-1">
                        <Badge variant={getStatusBadgeVariant(load.status_code)} className="text-xs">
                          {load.status_code}
                        </Badge>
                        <select
                          value={load.status_code}
                          onChange={(e) => handleUpdateStatus(load.rr_number, e.target.value as Load["status_code"])}
                          className="text-xs px-1 py-0.5 border rounded bg-white"
                        >
                          <option value="active">Active</option>
                          <option value="published">Published</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        <div>PU: {formatDate(load.pickup_date)}</div>
                        <div>DL: {formatDate(load.delivery_date)}</div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLoad(load);
                            setShowLoadDetails(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(load.rr_number, "archived")}
                          className="h-8 w-8 p-0"
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {loads.length === 0 && (
                  <div className="text-center py-12">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No loads found</h3>
                    <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search criteria</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Pagination */}
        {totalPages > 1 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} loads
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(1)}
                    disabled={!hasPrevPage}
                    size="sm"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!hasPrevPage}
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={!hasNextPage}
                    size="sm"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={!hasNextPage}
                    size="sm"
                  >
                    Last
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load Details Modal */}
        <Dialog open={showLoadDetails} onOpenChange={setShowLoadDetails}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Load Details - {selectedLoad?.rr_number}
              </DialogTitle>
              <DialogDescription>
                Complete information for this load
              </DialogDescription>
            </DialogHeader>
            {selectedLoad && (
              <div className="space-y-6">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="financial">Financial</TabsTrigger>
                    <TabsTrigger value="route">Route</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">RR Number</label>
                        <p className="text-lg font-mono">{selectedLoad.rr_number}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div className="mt-1">
                          <Badge variant={getStatusBadgeVariant(selectedLoad.status_code)}>
                            {selectedLoad.status_code}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Equipment</label>
                        <p className="text-lg">{selectedLoad.equipment}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Miles</label>
                        <p className="text-lg">{formatNumber(selectedLoad.total_miles)}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="financial" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Revenue</label>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedLoad.revenue)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Purchase</label>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedLoad.purchase)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Net Margin</label>
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedLoad.net)}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="route" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Origin</label>
                        <p className="text-lg">{selectedLoad.origin_city}, {selectedLoad.origin_state}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Destination</label>
                        <p className="text-lg">{selectedLoad.destination_city}, {selectedLoad.destination_state}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="timeline" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Pickup Date</label>
                        <p className="text-lg">{formatDate(selectedLoad.pickup_date)}</p>
                        {selectedLoad.pickup_window && (
                          <p className="text-sm text-gray-500">Window: {selectedLoad.pickup_window}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Delivery Date</label>
                        <p className="text-lg">{formatDate(selectedLoad.delivery_date)}</p>
                        {selectedLoad.delivery_window && (
                          <p className="text-sm text-gray-500">Window: {selectedLoad.delivery_window}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Enhanced Debug Section */}
        {showDebug && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <AlertTriangle className="h-5 w-5" />
                Debug Information
              </CardTitle>
              <CardDescription>
                Real-time logs and debugging information for troubleshooting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setDebugLogs([])}
                    variant="outline"
                  >
                    Clear Logs
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const data = {
                        timestamp: new Date().toISOString(),
                        loads: loads.length,
                        stats,
                        filters,
                        selectedLoads: Array.from(selectedLoads),
                        pagination: { currentPage, totalPages, itemsPerPage }
                      };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `debug-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    variant="outline"
                  >
                    Export Debug Data
                  </Button>
          </div>

                <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                  {debugLogs.length === 0 ? (
                    <div className="text-gray-500">No debug logs yet...</div>
                  ) : (
                    debugLogs.map((log, index) => (
                      <div key={index} className="mb-2">
                        <span className="text-gray-500">[{log.timestamp}]</span>
                        <span className={`ml-2 ${
                          log.level === "error" ? "text-red-400" :
                          log.level === "warn" ? "text-yellow-400" :
                          "text-green-400"
                        }`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="ml-2">{log.message}</span>
                        {log.data && (
                          <pre className="mt-1 text-xs text-gray-300">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
          </div>
        </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}