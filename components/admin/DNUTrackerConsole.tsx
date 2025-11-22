"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Search,
  AlertTriangle,
  Upload,
  X,
  CheckCircle2,
  Calendar,
  Building2,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

interface DNUEntry {
  id: string;
  mc_number: string | null;
  dot_number: string | null;
  carrier_name: string | null;
  status: 'active' | 'removed';
  added_to_dnu_at: string | null;
  removed_from_dnu_at: string | null;
  last_upload_date: string;
  carrier_count: number;
  matching_carriers?: Array<{
    user_id: string;
    company_name: string;
    mc_number: string;
    dot_number: string | null;
    profile_status: string;
  }>;
}

interface DNUTrackerConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DNUTrackerConsole({
  isOpen,
  onClose,
}: DNUTrackerConsoleProps) {
  const [dnuEntries, setDnuEntries] = useState<DNUEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'removed'>('all');
  const [sortOrder, setSortOrder] = useState<'date' | 'name-asc' | 'name-desc'>('date');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadDNUEntries();
    }
  }, [isOpen, searchQuery, statusFilter]);

  const loadDNUEntries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/admin/dnu/list?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setDnuEntries(data.data || []);
      } else {
        toast.error("Failed to load DNU entries");
      }
    } catch (error) {
      console.error("Error loading DNU entries:", error);
      toast.error("Failed to load DNU entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/dnu/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.ok) {
        toast.success(
          `DNU list updated: ${data.data.added} added, ${data.data.updated} updated, ${data.data.removed} removed`
        );
        await loadDNUEntries();
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast.error(data.error || "Failed to upload DNU list");
      }
    } catch (error) {
      console.error("Error uploading DNU file:", error);
      toast.error("Failed to upload DNU list");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Filter entries by status
  let filteredEntries = dnuEntries;

  // Sort entries
  if (sortOrder === 'name-asc') {
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const nameA = (a.carrier_name || a.mc_number || a.dot_number || '').toLowerCase();
      const nameB = (b.carrier_name || b.mc_number || b.dot_number || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  } else if (sortOrder === 'name-desc') {
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const nameA = (a.carrier_name || a.mc_number || a.dot_number || '').toLowerCase();
      const nameB = (b.carrier_name || b.mc_number || b.dot_number || '').toLowerCase();
      return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
  // 'date' sort is already handled by the API (most recently added first)

  // Group by status
  const activeEntries = filteredEntries.filter(e => e.status === 'active');
  const removedEntries = filteredEntries.filter(e => e.status === 'removed');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            DNU Tracker - Do Not Use List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <Glass className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Upload DNU List</Label>
                <p className="text-xs text-muted-foreground">
                  Upload Excel (.xlsx, .xls) or CSV file with MC and DOT numbers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  variant="outline"
                  className="bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload DNU List
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Glass>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by MC#, DOT#, or carrier name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status:</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'removed')}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active DNU</option>
                <option value="removed">Recently Removed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Sort:</Label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'date' | 'name-asc' | 'name-desc')}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="date">Date Added (Newest)</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <Glass className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-2xl font-bold">{activeEntries.length}</div>
                  <div className="text-sm text-muted-foreground">Active DNU</div>
                </div>
              </div>
            </Glass>
            <Glass className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{removedEntries.length}</div>
                  <div className="text-sm text-muted-foreground">Recently Removed</div>
                </div>
              </div>
            </Glass>
            <Glass className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {activeEntries.reduce((sum, e) => {
                      const count = typeof e.carrier_count === 'number' ? e.carrier_count : parseInt(String(e.carrier_count || 0), 10) || 0;
                      return sum + count;
                    }, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Carriers Affected</div>
                </div>
              </div>
            </Glass>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Active DNU Entries */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-semibold">Active DNU Entries</h3>
                  <Badge variant="outline" className="bg-red-500/10 text-red-500">
                    {activeEntries.length}
                  </Badge>
                </div>
                {activeEntries.length > 0 ? (
                  <div className="space-y-2">
                    {activeEntries.map((entry) => (
                      <DNUEntryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                ) : (
                  <Glass className="p-4 text-center text-muted-foreground">
                    No active DNU entries found
                  </Glass>
                )}
              </div>

              {/* Recently Removed Entries */}
              {removedEntries.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <h3 className="text-lg font-semibold">Recently Removed from DNU</h3>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      {removedEntries.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {removedEntries.map((entry) => (
                      <DNUEntryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DNUEntryRow({ entry }: { entry: DNUEntry }) {
  const isActive = entry.status === 'active';

  return (
    <Glass
      className={`p-4 border-2 ${
        isActive
          ? "border-red-500/30 bg-red-500/5"
          : "border-green-500/30 bg-green-500/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {entry.mc_number && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">MC:</span>
                <span className="font-mono font-semibold">{entry.mc_number}</span>
              </div>
            )}
            {entry.dot_number && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">DOT:</span>
                <span className="font-mono font-semibold">{entry.dot_number}</span>
              </div>
            )}
            <Badge variant={isActive ? "destructive" : "default"} className={isActive ? "" : "bg-green-500"}>
              {isActive ? "Active DNU" : "Removed"}
            </Badge>
            {entry.carrier_count > 0 && (
              <Badge variant="outline" className="text-xs">
                {entry.carrier_count} carrier{entry.carrier_count !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          
          {entry.carrier_name && (
            <p className="text-sm text-muted-foreground mb-2">
              <Building2 className="h-3 w-3 inline mr-1" />
              {entry.carrier_name}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {entry.added_to_dnu_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Added: {new Date(entry.added_to_dnu_at).toLocaleDateString()}</span>
              </div>
            )}
            {entry.removed_from_dnu_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Removed: {new Date(entry.removed_from_dnu_at).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Last Upload: {new Date(entry.last_upload_date).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Matching Carriers */}
          {entry.matching_carriers && entry.matching_carriers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Matching Carriers:</p>
              <div className="space-y-1">
                {entry.matching_carriers.slice(0, 5).map((carrier) => (
                  <div key={carrier.user_id} className="text-xs flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{carrier.company_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {carrier.profile_status}
                    </Badge>
                  </div>
                ))}
                {entry.matching_carriers.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    + {entry.matching_carriers.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Glass>
  );
}

