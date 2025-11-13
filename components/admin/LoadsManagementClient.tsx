"use client";

import { useState, useEffect, useCallback } from "react";
import { getLoads, getLoadStats, deleteLoad, updateLoadStatus } from "@/lib/load-actions";
import { Load } from "@/types/load";

interface LoadsManagementClientProps {
  initialLoads?: Load[];
  initialStats?: {
    totalLoads: number;
    publishedLoads: number;
    totalRevenue: number;
  };
}

export default function LoadsManagementClient({ 
  initialLoads, 
  initialStats 
}: LoadsManagementClientProps) {
  const [loads, setLoads] = useState<Load[]>(initialLoads || []);
  const [stats, setStats] = useState(initialStats || {
    totalLoads: 0,
    publishedLoads: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());

  const ITEMS_PER_PAGE = 20;

  // Fetch loads with search and pagination
  const fetchLoads = useCallback(async (page: number = 1, search: string = "") => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const result = await getLoads({ 
        limit: ITEMS_PER_PAGE, 
        offset, 
        search: search || undefined 
      });
      
      if (result.success && result.data) {
        setLoads(result.data as unknown as Load[]);
        // For now, estimate total pages (we'd need a count query for accurate pagination)
        setTotalPages(Math.ceil((result.data as unknown as Load[]).length / ITEMS_PER_PAGE));
      }
      setCurrentPage(page);
    } catch (err) {
      console.error("Error fetching loads:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch loads");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await getLoadStats();
      if (result.success && result.data) {
        setStats({
          totalLoads: Number(result.data.total) || 0,
          publishedLoads: Number(result.data.active) || 0,
          totalRevenue: 0 // Not available in current stats
        });
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoads) {
      fetchLoads(1);
    }
    if (!initialStats) {
      fetchStats();
    }
  }, [fetchLoads, fetchStats, initialLoads, initialStats]);

  // Handle search
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    fetchLoads(1, term);
  }, [fetchLoads]);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    fetchLoads(page, searchTerm);
  }, [fetchLoads, searchTerm]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchLoads(currentPage, searchTerm);
    fetchStats();
  }, [fetchLoads, fetchStats, currentPage, searchTerm]);

  // Handle load selection
  const handleSelectLoad = useCallback((rrNumber: string) => {
    setSelectedLoads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rrNumber)) {
        newSet.delete(rrNumber);
      } else {
        newSet.add(rrNumber);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedLoads.size === loads.length) {
      setSelectedLoads(new Set());
    } else {
      setSelectedLoads(new Set(loads.map(load => load.rr_number)));
    }
  }, [loads, selectedLoads.size]);

  // Handle load deletion
  const handleDeleteLoad = useCallback(async (rrNumber: string) => {
    if (!confirm("Are you sure you want to delete this load?")) return;
    
    try {
      await deleteLoad(rrNumber);
      await handleRefresh();
    } catch (err) {
      console.error("Error deleting load:", err);
      setError(err instanceof Error ? err.message : "Failed to delete load");
    }
  }, [handleRefresh]);

  // Handle status toggle
  const handleToggleStatus = useCallback(async (rrNumber: string, currentStatus: boolean) => {
    try {
      // Toggle between published/unpublished status
      await updateLoadStatus(rrNumber, currentStatus ? 'archived' : 'published');
      await handleRefresh();
    } catch (err) {
      console.error("Error updating load status:", err);
      setError(err instanceof Error ? err.message : "Failed to update load status");
    }
  }, [handleRefresh]);

  // Handle bulk operations
  const handleBulkDelete = useCallback(async () => {
    if (selectedLoads.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedLoads.size} loads?`)) return;
    
    try {
      for (const rrNumber of selectedLoads) {
        await deleteLoad(rrNumber);
      }
      setSelectedLoads(new Set());
      await handleRefresh();
    } catch (err) {
      console.error("Error bulk deleting loads:", err);
      setError(err instanceof Error ? err.message : "Failed to delete loads");
    }
  }, [selectedLoads, handleRefresh]);

  const handleBulkToggleStatus = useCallback(async (published: boolean) => {
    if (selectedLoads.size === 0) return;
    
    try {
      for (const rrNumber of selectedLoads) {
        await updateLoadStatus(rrNumber, published ? 'published' : 'archived');
      }
      setSelectedLoads(new Set());
      await handleRefresh();
    } catch (err) {
      console.error("Error bulk updating load status:", err);
      setError(err instanceof Error ? err.message : "Failed to update load status");
    }
  }, [selectedLoads, handleRefresh]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Manage Loads</h1>
          <p className="text-gray-300">Monitor and manage freight loads in the system</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Loads</p>
                <p className="text-2xl font-bold text-white">{stats.totalLoads}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Published</p>
                <p className="text-2xl font-bold text-green-400">{stats.publishedLoads}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-400">${stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search loads by RR#, customer, route, or equipment..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              {selectedLoads.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkToggleStatus(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Publish Selected ({selectedLoads.size})
                  </button>
                  <button
                    onClick={() => handleBulkToggleStatus(false)}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Unpublish Selected ({selectedLoads.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete Selected ({selectedLoads.size})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Loads Table */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
              <span className="ml-4 text-gray-300">Loading loads...</span>
            </div>
          ) : loads.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">
                {searchTerm ? 'No loads match your search' : 'No loads found'}
              </div>
              <p className="text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'There are no loads in the system.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="text-left p-4">
                        <input
                          type="checkbox"
                          checked={selectedLoads.size === loads.length && loads.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left p-4 text-gray-300 font-semibold">RR#</th>
                      <th className="text-left p-4 text-gray-300 font-semibold">Customer</th>
                      <th className="text-left p-4 text-gray-300 font-semibold">Route</th>
                      <th className="text-left p-4 text-gray-300 font-semibold">Equipment</th>
                      <th className="text-right p-4 text-gray-300 font-semibold">Revenue</th>
                      <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                      <th className="text-left p-4 text-gray-300 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loads.map((load) => (
                      <tr key={load.rr_number} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedLoads.has(load.rr_number)}
                            onChange={() => handleSelectLoad(load.rr_number)}
                            className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4 text-white font-mono">{load.rr_number}</td>
                        <td className="p-4 text-gray-300">{load.customer_name || 'N/A'}</td>
                        <td className="p-4 text-gray-300">
                          {load.origin_city}, {load.origin_state} → {load.destination_city}, {load.destination_state}
                        </td>
                        <td className="p-4 text-gray-300">{load.equipment || 'N/A'}</td>
                        <td className="p-4 text-right text-green-400 font-semibold">
                          ${(load.revenue || 0).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            load.published 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {load.published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggleStatus(load.rr_number, load.published)}
                              className={`px-2 py-1 rounded text-xs ${
                                load.published
                                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {load.published ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              onClick={() => handleDeleteLoad(load.rr_number)}
                              className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-700">
                  <div className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-500 text-white rounded text-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-gray-500 text-white rounded text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
