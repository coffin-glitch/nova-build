"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDistance } from "@/lib/utils";
import {
    Archive,
    BarChart3,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Download,
    Edit,
    Eye,
    Filter,
    Info,
    MapPin,
    MoreHorizontal,
    RefreshCw,
    Route,
    Search,
    TrendingUp,
    Truck,
    Upload,
    Weight
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Load {
  rr_number: string;
  tm_number?: string;
  status_code: string;
  pickup_date?: string;
  pickup_time?: string;
  delivery_date?: string;
  delivery_time?: string;
  target_buy: number;
  equipment: string;
  weight: number;
  miles: number;
  stops: number;
  customer_name: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  updated_at: string;
  published: boolean;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  load_number?: string;
  max_buy?: number;
  spot_bid?: string;
  fuel_surcharge?: number;
  docs_scanned?: string;
  invoice_date?: string;
  invoice_audit?: string;
  purch_tr?: number;
  net_mrg?: number;
  cm?: number;
  nbr_of_stops?: number;
  vendor_dispatch?: string;
  customer_ref?: string;
  driver_name?: string;
  dispatcher_name?: string;
  vendor_name?: string;
}

interface LoadStats {
  total: number;
  active: number;
  published: number;
  completed: number;
  totalRevenue: number;
  totalMargin: number;
  avgMargin: number;
}

interface FilterState {
  search: string;
  status: string;
  equipment: string;
  origin: string;
  destination: string;
  dateRange: string;
  revenueRange: string;
}

export function AdminLoadsConsole() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [stats, setStats] = useState<LoadStats>({
    total: 0,
    active: 0,
    published: 0,
    completed: 0,
    totalRevenue: 0,
    totalMargin: 0,
    avgMargin: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    equipment: 'all',
    origin: '',
    destination: '',
    dateRange: 'all',
    revenueRange: 'all'
  });

  // Debug logging function
  const addDebugLog = useCallback((level: 'info' | 'error' | 'warning', message: string, data?: any) => {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    setDebugLogs(prev => [log, ...prev.slice(0, 99)]); // Keep last 100 logs
  }, []);

  // Fetch loads from API
  const fetchLoads = useCallback(async () => {
    try {
      addDebugLog('info', 'Fetching loads from API', { filters, currentPage, itemsPerPage });
      
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.equipment !== 'all' && { equipment: filters.equipment }),
        ...(filters.origin && { origin: filters.origin }),
        ...(filters.destination && { destination: filters.destination })
      });

      const response = await fetch(`/api/loads?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      addDebugLog('info', 'Successfully fetched loads', { 
        count: result.loads?.length || 0, 
        total: result.pagination?.total || 0 
      });
      
      setLoads(result.loads || []);
      setTotalPages(Math.ceil((result.pagination?.total || 0) / itemsPerPage));
      
      // Calculate stats
      const totalLoads = result.pagination?.total || 0;
      const publishedLoads = result.loads?.filter((load: Load) => load.published).length || 0;
      const activeLoads = result.loads?.filter((load: Load) => load.status_code === 'active').length || 0;
      const completedLoads = result.loads?.filter((load: Load) => load.status_code === 'completed').length || 0;
      
      const totalRevenue = result.loads?.reduce((sum: number, load: Load) => sum + (load.revenue || 0), 0) || 0;
      const totalMargin = result.loads?.reduce((sum: number, load: Load) => sum + (load.margin || 0), 0) || 0;
      const avgMargin = totalLoads > 0 ? totalMargin / totalLoads : 0;
      
      setStats({
        total: totalLoads,
        active: activeLoads,
        published: publishedLoads,
        completed: completedLoads,
        totalRevenue,
        totalMargin,
        avgMargin
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      addDebugLog('error', 'Failed to fetch loads', { error: errorMessage });
      toast.error(`Failed to fetch loads: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, itemsPerPage, addDebugLog]);

  // Bulk operations
  const handleBulkOperation = useCallback(async (action: string) => {
    if (selectedLoads.length === 0) {
      toast.error('Please select at least one load');
      return;
    }

    try {
      addDebugLog('info', `Performing bulk ${action}`, { selectedLoads });
      
      const response = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rrNumbers: selectedLoads
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      addDebugLog('info', `Successfully performed bulk ${action}`, { result });
      toast.success(result.message || `Successfully ${action}d ${selectedLoads.length} load(s)`);
      
      setSelectedLoads([]);
      await fetchLoads();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      addDebugLog('error', `Failed to perform bulk ${action}`, { error: errorMessage });
      toast.error(`Failed to ${action} loads: ${errorMessage}`);
    }
  }, [selectedLoads, fetchLoads, addDebugLog]);

  // EAX Upload handler
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
      toast.success(`Successfully uploaded ${result.data?.loads_created || 0} loads from EAX file`);
      
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

  // Load data on mount and when filters change
  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  // Filtered loads for display
  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      const matchesSearch = !filters.search || 
        load.rr_number.toLowerCase().includes(filters.search.toLowerCase()) ||
        load.customer_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        load.origin_city.toLowerCase().includes(filters.search.toLowerCase()) ||
        load.destination_city.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesStatus = filters.status === 'all' || load.status_code === filters.status;
      const matchesEquipment = filters.equipment === 'all' || load.equipment.toLowerCase().includes(filters.equipment.toLowerCase());
      
      return matchesSearch && matchesStatus && matchesEquipment;
    });
  }, [loads, filters]);

  // Get status badge variant
  const getStatusBadge = (status: string, published: boolean) => {
    if (!published) return { variant: 'secondary' as const, label: 'Draft' };
    
    switch (status) {
      case 'active': return { variant: 'default' as const, label: 'Active' };
      case 'published': return { variant: 'default' as const, label: 'Published' };
      case 'completed': return { variant: 'secondary' as const, label: 'Completed' };
      case 'cancelled': return { variant: 'destructive' as const, label: 'Cancelled' };
      case 'archived': return { variant: 'outline' as const, label: 'Archived' };
      default: return { variant: 'secondary' as const, label: status };
    }
  };

  // Get equipment icon
  const getEquipmentIcon = (equipment: string) => {
    const eq = equipment.toLowerCase();
    if (eq.includes('reefer')) return '❄️';
    if (eq.includes('flatbed') || eq.includes('flat bed')) return '🚛';
    if (eq.includes('container')) return '📦';
    return '🚚'; // Default to dry van
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Load Management</h1>
          <p className="text-muted-foreground">Comprehensive load management and monitoring system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
          <Button variant="outline" size="sm">
            <Archive className="h-4 w-4 mr-2" />
            Archived Loads
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload EAX
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload EAX File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleEAXUpload}
                />
                <p className="text-sm text-muted-foreground">
                  Upload CSV or Excel files containing load data
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={fetchLoads} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loads</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All loads in system</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
            <p className="text-xs text-muted-foreground">Available for booking</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalMargin)}</div>
            <p className="text-xs text-muted-foreground">Profit margin</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgMargin)}</div>
            <p className="text-xs text-muted-foreground">Per load average</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
          <p className="text-sm text-muted-foreground">Filter and search through your loads with precision</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search RR#, origin, destination..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.equipment} onValueChange={(value) => setFilters(prev => ({ ...prev, equipment: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                <SelectItem value="Dry Van">Dry Van</SelectItem>
                <SelectItem value="Reefer">Reefer</SelectItem>
                <SelectItem value="Flatbed">Flatbed</SelectItem>
                <SelectItem value="Container">Container</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Items per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Origin city/state"
                  value={filters.origin}
                  onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Destination city/state"
                  value={filters.destination}
                  onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => setFilters({
                search: '',
                status: 'all',
                equipment: 'all',
                origin: '',
                destination: '',
                dateRange: 'all',
                revenueRange: 'all'
              })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loads Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              <CardTitle>Loads Management</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {stats.total} total loads • {filteredLoads.length} currently displayed
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  Table View
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  Card View
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          {selectedLoads.length > 0 && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedLoads.length} load(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleBulkOperation('publish')}>
                    Publish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkOperation('unpublish')}>
                    Unpublish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkOperation('archive')}>
                    Archive
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleBulkOperation('delete')}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLoads.length === filteredLoads.length && filteredLoads.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLoads(filteredLoads.map(load => load.rr_number));
                            } else {
                              setSelectedLoads([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>RR#</TableHead>
                      <TableHead>Load#</TableHead>
                      <TableHead>TM#</TableHead>
                      <TableHead>Dispatcher</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Target Buy</TableHead>
                      <TableHead>Max Buy</TableHead>
                      <TableHead>Cust Ref#</TableHead>
                      <TableHead>Spot Bid</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Vendor Dispatch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoads.map((load) => {
                      const statusBadge = getStatusBadge(load.status_code, load.published);
                      return (
                        <TableRow key={load.rr_number}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLoads.includes(load.rr_number)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLoads(prev => [...prev, load.rr_number]);
                                } else {
                                  setSelectedLoads(prev => prev.filter(id => id !== load.rr_number));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{load.rr_number}</TableCell>
                          <TableCell>{load.load_number || '-'}</TableCell>
                          <TableCell>{load.tm_number || '-'}</TableCell>
                          <TableCell>{load.dispatcher_name || '-'}</TableCell>
                          <TableCell>{formatCurrency(load.revenue || 0)}</TableCell>
                          <TableCell>{formatCurrency(load.target_buy)}</TableCell>
                          <TableCell>{formatCurrency(load.max_buy || 0)}</TableCell>
                          <TableCell>{load.customer_ref || '-'}</TableCell>
                          <TableCell>{load.spot_bid || '-'}</TableCell>
                          <TableCell>{load.driver_name || '-'}</TableCell>
                          <TableCell>{load.vendor_dispatch || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadge.variant}>
                              {statusBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span>{load.origin_city}, {load.origin_state}</span>
                              <span className="text-muted-foreground">to</span>
                              <span>{load.destination_city}, {load.destination_state}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getEquipmentIcon(load.equipment)}</span>
                              <span>{load.equipment}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLoads.length)} of {filteredLoads.length} loads
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLoads.map((load) => {
                const statusBadge = getStatusBadge(load.status_code, load.published);
                return (
                  <Card key={load.rr_number} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{load.rr_number}</CardTitle>
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{getEquipmentIcon(load.equipment)}</span>
                        <span>{load.equipment}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{load.origin_city}, {load.origin_state}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{load.destination_city}, {load.destination_state}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Route className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDistance(load.miles)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Weight className="h-4 w-4 text-muted-foreground" />
                          <span>{load.weight.toLocaleString()} lbs</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Revenue:</span>
                          <div className="font-medium">{formatCurrency(load.revenue || 0)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Target Buy:</span>
                          <div className="font-medium">{formatCurrency(load.target_buy)}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-muted-foreground">
                          Updated {formatDate(load.updated_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Panel */}
      {showDebug && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                <CardTitle>Debug Information</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setDebugLogs([])}>
                  Clear Logs
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Debug Data
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Real-time logs and debugging information for troubleshooting</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <div className="space-y-2">
                {debugLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground font-mono">
                      [{log.timestamp}]
                    </div>
                    <div className={`text-xs font-mono ${
                      log.level === 'error' ? 'text-red-600' : 
                      log.level === 'warning' ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      [{log.level.toUpperCase()}]
                    </div>
                    <div className="text-sm">{log.message}</div>
                    {log.data && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {JSON.stringify(log.data)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
