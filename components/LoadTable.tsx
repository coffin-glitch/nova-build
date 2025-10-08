"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Archive, Trash, AlertTriangle, Upload, FileSpreadsheet, AlertCircle, Search, Filter, RefreshCw, Zap, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Load = {
  rr_number: string;
  tm_number: string | null;
  status_code: string | null;
  pickup_date: string | null;
  pickup_window: string | null;
  delivery_date: string | null;
  delivery_window: string | null;
  revenue: number | null;
  purchase: number | null;
  net: number | null;
  margin: number | null;
  equipment: string | null;
  customer_name: string | null;
  driver_name: string | null;
  total_miles: number | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  vendor_name: string | null;
  dispatcher_name: string | null;
  updated_at: string | null;
  published: boolean;
};

type Stats = {
  totalLoads: number;
  activeLoads: number;
  todayBids: number;
  bookedToday: number;
};

export default function LoadTable() {
  const [rows, setRows] = useState<Load[]>([]);
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState<"all"|"true"|"false">("all");
  const [loading, setLoading] = useState(false);
  
  // Bulk operations state
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"archive" | "delete" | "clear_all">("archive");
  const [clearAllConfirm, setClearAllConfirm] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  // EAX Upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (published !== "all") params.set("published", published);
      
      console.log("Fetching loads from:", `/api/admin/loads?${params.toString()}`);
    const res = await fetch(`/api/admin/loads?${params.toString()}`, { cache: "no-store" });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
    const data = await res.json();
      console.log("Fetched data:", data);
      
    setRows(data.rows || []);
    setLoading(false);
      
      // Update stats in header
      updateStats(data.rows || []);
    } catch (error) {
      console.error("Error fetching loads:", error);
      setLoading(false);
      setRows([]);
    }
  };

  const updateStats = async (loads: Load[]) => {
    const totalLoads = loads.length;
    const activeLoads = loads.filter(l => l.published).length;
    
    // Update stats in header using direct DOM manipulation
    const totalLoadsEl = document.getElementById('total-loads');
    const activeLoadsEl = document.getElementById('active-loads');
    const todayBidsEl = document.getElementById('today-bids');
    const bookedLoadsEl = document.getElementById('booked-loads');
    
    if (totalLoadsEl) totalLoadsEl.textContent = totalLoads.toString();
    if (activeLoadsEl) activeLoadsEl.textContent = activeLoads.toString();
    if (todayBidsEl) todayBidsEl.textContent = "0";
    if (bookedLoadsEl) bookedLoadsEl.textContent = "0";
  };

  useEffect(() => {
    console.log("LoadTable component mounted, fetching rows...");
    // Use a timeout to ensure the component is fully mounted
    const timer = setTimeout(() => {
      fetchRows();
    }, 100);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggle = async (rr: string, to: boolean) => {
    await fetch(`/api/admin/loads/${encodeURIComponent(rr)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: to })
    });
    // refresh after toggle
    fetchRows();
  };

  const handleSelectAll = () => {
    if (selectedLoads.length === rows.length) {
      setSelectedLoads([]);
    } else {
      setSelectedLoads(rows.map(row => row.rr_number));
    }
  };

  const handleSelectLoad = (rrNumber: string) => {
    setSelectedLoads(prev => 
      prev.includes(rrNumber) 
        ? prev.filter(id => id !== rrNumber)
        : [...prev, rrNumber]
    );
  };

  const handleBulkAction = async () => {
    if (bulkAction === "clear_all") {
      if (clearAllConfirm !== "CLEAR_ALL_LOADS") {
        toast.error("Please type 'CLEAR_ALL_LOADS' to confirm");
        return;
      }
    } else if (selectedLoads.length === 0) {
      toast.error("Please select loads to perform this action");
      return;
    }

    setIsBulkProcessing(true);
    try {
      const response = await fetch("/api/admin/loads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          loadIds: bulkAction === "clear_all" ? [] : selectedLoads,
          confirmAction: bulkAction === "clear_all" ? clearAllConfirm : undefined
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setSelectedLoads([]);
        setClearAllConfirm("");
        setIsBulkDialogOpen(false);
        // Refresh the table
        fetchRows();
      } else {
        toast.error(result.error || "Failed to perform bulk action");
      }
    } catch (error) {
      toast.error("Failed to perform bulk action");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/eax/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully processed ${result.data?.rows_processed || 'unknown'} loads from ${result.data?.file_type || 'file'}`);
        setSelectedFile(null);
        setIsUploadDialogOpen(false);
        // Refresh the table
        fetchRows();
      } else {
        toast.error(result.error || "Failed to upload file");
      }
    } catch (error) {
      toast.error("Failed to upload EAX file");
    } finally {
      setIsUploading(false);
    }
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const pub = rows.filter(r => r.published).length;
    return { total, pub };
  }, [rows]);

  console.log("LoadTable rendering with rows:", rows.length, "loading:", loading);
  
  // Force fetch on every render if no data
  React.useEffect(() => {
    if (rows.length === 0 && !loading) {
      console.log("No rows found, attempting to fetch...");
      fetchRows();
    }
  });
  
  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Supernova Control Panel */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-2xl blur-lg"></div>
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
          
          {/* Supernova Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse shadow-lg shadow-purple-400/50"></div>
              <div className="w-3 h-3 bg-pink-400 rounded-full animate-pulse shadow-lg shadow-pink-400/50"></div>
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent ml-4">
                COMMAND INTERFACE
              </h2>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
              <span className="text-purple-200 font-bold">SYSTEM ONLINE</span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap gap-4 items-center mb-6">
            <Button
              variant="destructive"
              size="lg"
              onClick={() => {
                setBulkAction("clear_all");
                setIsBulkDialogOpen(true);
              }}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-2 border-red-500/50 shadow-lg hover:shadow-red-500/25 transition-all duration-200 font-bold text-white"
            >
              <Trash className="w-5 h-5 mr-2" />
              CLEAR ALL LOADS
            </Button>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="bg-gradient-to-r from-blue-600/20 to-blue-700/20 hover:from-blue-600/30 hover:to-blue-700/30 border-2 border-blue-500/50 text-blue-700 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200 shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-bold"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  UPLOAD EAX FILE
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white/95 dark:bg-slate-900/95 border-2 border-blue-500/30 dark:border-blue-400/50 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                    Upload EAX File
                  </DialogTitle>
                </DialogHeader>
    <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Select EAX File (.xlsx, .xls, .csv)
                    </label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full bg-gray-50 dark:bg-slate-800/50 border-2 border-gray-300 dark:border-slate-600 text-gray-800 dark:text-gray-200"
                    />
                    {selectedFile && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                  <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-bold">File Format Requirements:</p>
                        <ul className="mt-1 space-y-1 text-xs">
                          <li>• First row should contain column headers</li>
                          <li>• Include columns: RR#, Origin, Destination, Equipment, etc.</li>
                          <li>• Loads will be imported as unpublished by default</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsUploadDialogOpen(false);
                        setSelectedFile(null);
                      }}
                      className="border-2 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isUploading}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 font-bold"
                    >
                      {isUploading ? "Uploading..." : "Upload & Process"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Bulk Actions for Selected Loads */}
          {selectedLoads.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              <Button 
                variant="outline"
                size="lg"
                onClick={() => {
                  setBulkAction("archive");
                  setIsBulkDialogOpen(true);
                }}
                className="bg-gradient-to-r from-orange-600/20 to-orange-700/20 hover:from-orange-600/30 hover:to-orange-700/30 border-2 border-orange-500/50 text-orange-700 dark:text-orange-300 hover:text-orange-600 dark:hover:text-orange-200 shadow-lg hover:shadow-orange-500/25 transition-all duration-200 font-bold"
              >
                <Archive className="w-5 h-5 mr-2" />
                ARCHIVE ({selectedLoads.length})
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setBulkAction("delete");
                  setIsBulkDialogOpen(true);
                }}
                className="bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/30 hover:to-red-700/30 border-2 border-red-500/50 text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200 shadow-lg hover:shadow-red-500/25 transition-all duration-200 font-bold"
              >
                <Trash className="w-5 h-5 mr-2" />
                DELETE ({selectedLoads.length})
              </Button>
            </div>
          )}

          {/* Search and Filter Controls */}
          <div className="bg-gray-50/80 dark:bg-slate-800/50 rounded-xl p-4 border-2 border-gray-200/50 dark:border-slate-700/30">
      <form
              className="flex flex-wrap items-center gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                fetchRows();
              }}
            >
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search RR#, TM#, customer, city…"
                    className="w-full bg-white dark:bg-slate-700/50 border-2 border-gray-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-3 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 font-medium"
        />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <select
          value={published}
          onChange={e=>setPublished(e.target.value as any)}
                  className="bg-white dark:bg-slate-700/50 border-2 border-gray-300 dark:border-slate-600 rounded-lg px-4 py-3 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
                >
                  <option value="all">All Loads</option>
                  <option value="true">Published Only</option>
                  <option value="false">Draft Only</option>
        </select>
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/25 flex items-center gap-2" 
                  type="submit"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Loading…" : "Refresh"}
                </Button>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-bold">
                <span className="text-green-600 dark:text-green-400">{summary.pub}</span> / <span className="text-gray-800 dark:text-gray-200">{summary.total}</span> published
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 dark:from-blue-500/30 dark:to-purple-500/30 rounded-xl blur-sm"></div>
        <div className="relative bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-blue-500/30 dark:border-blue-400/50 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-100/90 to-gray-200/90 dark:from-slate-800/90 dark:to-slate-700/90 border-b-2 border-gray-300/50 dark:border-slate-600/50">
                <tr>
                  <th className="text-left p-4">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center w-6 h-6 rounded border-2 border-gray-400 dark:border-slate-500 hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-all duration-200"
                      type="button"
                    >
                      {selectedLoads.length === rows.length && rows.length > 0 ? (
                        <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-400 dark:border-slate-500 rounded-sm"></div>
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">STATUS</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">RR#</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">TM#</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">CODE</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">PICKUP</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">DELIVERY</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">EQUIPMENT</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">CUSTOMER</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">ROUTE</th>
                  <th className="text-right p-4 text-gray-700 dark:text-gray-300 font-bold">MILES</th>
                  <th className="text-right p-4 text-gray-700 dark:text-gray-300 font-bold">REVENUE</th>
                  <th className="text-right p-4 text-gray-700 dark:text-gray-300 font-bold">NET</th>
                  <th className="text-right p-4 text-gray-700 dark:text-gray-300 font-bold">MARGIN</th>
                  <th className="text-left p-4 text-gray-700 dark:text-gray-300 font-bold">UPDATED</th>
            </tr>
          </thead>
          <tbody>
                {rows.map((r, index) => {
              const pickup = [r.pickup_date, r.pickup_window].filter(Boolean).join(" ");
              const delivery = [r.delivery_date, r.delivery_window].filter(Boolean).join(" ");
              const od = [ [r.origin_city, r.origin_state].filter(Boolean).join(", "), [r.destination_city, r.destination_state].filter(Boolean).join(", ") ].join(" → ");
                  const isSelected = selectedLoads.includes(r.rr_number);
                  
              return (
                    <tr 
                      key={r.rr_number} 
                      className={`border-b border-gray-200/50 dark:border-slate-700/30 hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-all duration-200 ${
                        isSelected ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-300/50 dark:border-blue-500/30' : ''
                      } ${index % 2 === 0 ? 'bg-gray-25/50 dark:bg-slate-800/20' : 'bg-white/50 dark:bg-slate-800/10'}`}
                    >
                      <td className="p-4">
                        <button
                          onClick={() => handleSelectLoad(r.rr_number)}
                          className="flex items-center justify-center w-6 h-6 rounded border-2 border-gray-400 dark:border-slate-500 hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-all duration-200"
                          type="button"
                        >
                          {isSelected ? (
                            <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                          ) : (
                            <div className="w-4 h-4 border-2 border-gray-400 dark:border-slate-500 rounded-sm"></div>
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <label className="inline-flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!r.published}
                        onChange={(e)=>onToggle(r.rr_number, e.target.checked)}
                            className="w-5 h-5 rounded border-2 border-gray-400 dark:border-slate-500 bg-white dark:bg-slate-700 text-blue-500 focus:ring-blue-500/50"
                          />
                          <span className={`text-xs px-3 py-1 rounded-full font-bold border-2 ${
                            r.published 
                              ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50 dark:border-green-400/50' 
                              : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/50 dark:border-yellow-400/50'
                          }`}>
                            {r.published ? "LIVE" : "DRAFT"}
                          </span>
                    </label>
                  </td>
                      <td className="p-4 font-mono text-blue-600 dark:text-blue-400 font-bold text-lg">{r.rr_number}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{r.tm_number || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{r.status_code || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{pickup || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{delivery || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{r.equipment || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{r.customer_name || "—"}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{od || "—"}</td>
                      <td className="p-4 text-right text-gray-700 dark:text-gray-300 font-bold">{r.total_miles ?? "—"}</td>
                      <td className="p-4 text-right text-green-600 dark:text-green-400 font-bold text-lg">${r.revenue ?? "—"}</td>
                      <td className="p-4 text-right text-blue-600 dark:text-blue-400 font-bold text-lg">${r.net ?? "—"}</td>
                      <td className="p-4 text-right text-purple-600 dark:text-purple-400 font-bold text-lg">{r.margin ?? "—"}%</td>
                      <td className="p-4 text-xs text-gray-500 dark:text-gray-400 font-medium">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="p-12 text-center">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          <p className="text-xl font-bold">No loads found</p>
                          <p className="text-sm">Upload an EAX file to get started</p>
                        </div>
                      </div>
                    </td>
                  </tr>
            )}
          </tbody>
        </table>
      </div>
        </div>
      </div>

      {/* Bulk Operations Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="bg-white/95 dark:bg-slate-900/95 border-2 border-blue-500/30 dark:border-blue-400/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
              {bulkAction === "clear_all" && <AlertTriangle className="w-5 h-5 text-red-500" />}
              {bulkAction === "archive" && <Archive className="w-5 h-5 text-orange-500" />}
              {bulkAction === "delete" && <Trash className="w-5 h-5 text-red-500" />}
              {bulkAction === "clear_all" ? "Clear All Loads" :
               bulkAction === "archive" ? "Archive Selected Loads" :
               "Delete Selected Loads"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {bulkAction === "clear_all" ? (
              <div className="space-y-4">
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <p className="font-bold">⚠️ DANGER: This action cannot be undone!</p>
                      <p className="mt-1">This will permanently delete ALL loads from the database.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm" className="text-gray-700 dark:text-gray-300 font-bold">Type "CLEAR_ALL_LOADS" to confirm:</Label>
                  <Input
                    id="confirm"
                    value={clearAllConfirm}
                    onChange={(e) => setClearAllConfirm(e.target.value)}
                    placeholder="CLEAR_ALL_LOADS"
                    className="mt-2 bg-gray-50 dark:bg-slate-800/50 border-2 border-gray-300 dark:border-slate-600 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-lg p-4">
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    <p className="font-bold">
                      {bulkAction === "archive" ? "Archive Loads" : "Delete Loads"}
                    </p>
                    <p className="mt-1">
                      {bulkAction === "archive"
                        ? `This will archive ${selectedLoads.length} selected loads. They will be marked as unpublished and archived.`
                        : `This will permanently delete ${selectedLoads.length} selected loads. This action cannot be undone.`
                      }
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selected loads: {selectedLoads.join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkDialogOpen(false);
                setClearAllConfirm("");
              }}
              disabled={isBulkProcessing}
              className="border-2 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={isBulkProcessing || (bulkAction === "clear_all" && clearAllConfirm !== "CLEAR_ALL_LOADS")}
              className={`transition-all duration-200 font-bold ${
                bulkAction === "clear_all" ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" :
                bulkAction === "delete" ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" :
                "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
              }`}
            >
              {isBulkProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  {bulkAction === "clear_all" && <Trash className="h-4 w-4 mr-2" />}
                  {bulkAction === "archive" && <Archive className="h-4 w-4 mr-2" />}
                  {bulkAction === "delete" && <Trash className="h-4 w-4 mr-2" />}
                  {bulkAction === "clear_all" ? "Clear All Loads" :
                   bulkAction === "archive" ? "Archive Selected" :
                   "Delete Selected"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}