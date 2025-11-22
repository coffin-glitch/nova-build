"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/useUserRole";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, CheckSquare, Edit, FolderOpen, Info, Megaphone, Plus, Save, Search, Settings, Square, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const priorityConfig = {
  urgent: { icon: AlertCircle, label: 'Urgent', color: 'destructive' },
  high: { icon: AlertTriangle, label: 'High', color: 'default' },
  normal: { icon: Megaphone, label: 'Normal', color: 'default' },
  low: { icon: Info, label: 'Low', color: 'secondary' },
};

interface Carrier {
  userId: string;
  companyName: string;
  contactName: string | null;
  email: string;
}

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [creating, setCreating] = useState(false);
  const [selectedCarriers, setSelectedCarriers] = useState<Set<string>>(new Set());
  const [carrierSearchQuery, setCarrierSearchQuery] = useState("");
  const [savedListName, setSavedListName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [showManageListsDialog, setShowManageListsDialog] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    isAdmin ? "/api/announcements" : null,
    fetcher,
    {
      refreshInterval: 30000,
    }
  );

  // Fetch carriers for sender list
  const { data: carriersData, isLoading: carriersLoading } = useSWR(
    isAdmin && createDialogOpen ? "/api/announcements/carriers" : null,
    fetcher
  );

  // Fetch saved recipient lists
  const { data: savedListsData, mutate: mutateSavedLists } = useSWR(
    isAdmin ? "/api/announcements/saved-lists" : null,
    fetcher
  );

  const carriers: Carrier[] = carriersData?.data || [];
  const announcements = data?.data || [];
  const savedLists: any[] = savedListsData?.data || [];

  // Track if we've initialized the selection for this dialog session
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // Initialize selected carriers when dialog opens (select all by default)
  // Only do this once when the dialog first opens, not when selection becomes empty
  useEffect(() => {
    if (createDialogOpen && carriers.length > 0 && !hasInitializedSelection) {
      setSelectedCarriers(new Set(carriers.map(c => c.userId)));
      setHasInitializedSelection(true);
    }
  }, [createDialogOpen, carriers, hasInitializedSelection]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!createDialogOpen) {
      setSelectedCarriers(new Set());
      setCarrierSearchQuery("");
      setHasInitializedSelection(false); // Reset initialization flag
    }
  }, [createDialogOpen]);

  // Filter carriers based on search
  const filteredCarriers = useMemo(() => {
    if (!carrierSearchQuery) return carriers;
    const query = carrierSearchQuery.toLowerCase();
    return carriers.filter(carrier =>
      carrier.companyName.toLowerCase().includes(query) ||
      carrier.contactName?.toLowerCase().includes(query) ||
      carrier.email.toLowerCase().includes(query)
    );
  }, [carriers, carrierSearchQuery]);

  // Select/deselect all carriers
  const handleSelectAll = () => {
    if (selectedCarriers.size === filteredCarriers.length) {
      setSelectedCarriers(new Set());
    } else {
      setSelectedCarriers(new Set(filteredCarriers.map(c => c.userId)));
    }
  };

  // Toggle individual carrier selection
  const handleToggleCarrier = (userId: string) => {
    const newSelected = new Set(selectedCarriers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedCarriers(newSelected);
  };

  // Load a saved recipient list
  const handleLoadSavedList = async (listId: string) => {
    try {
      const response = await fetch(`/api/announcements/saved-lists/${listId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSelectedCarriers(new Set(result.data.recipient_user_ids || []));
        toast.success(`Loaded "${result.data.name}"`);
      } else {
        throw new Error(result.error || "Failed to load list");
      }
    } catch (error: any) {
      console.error("Error loading saved list:", error);
      toast.error(error.message || "Failed to load saved list");
    }
  };

  // Save current selection as a new list
  const handleSaveList = async () => {
    if (!savedListName.trim()) {
      toast.error("Please enter a name for this list");
      return;
    }

    if (selectedCarriers.size === 0) {
      toast.error("Please select at least one carrier to save");
      return;
    }

    // If editing, update instead of create
    if (editingListId) {
      await handleUpdateList();
      return;
    }

    try {
      const response = await fetch("/api/announcements/saved-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savedListName.trim(),
          recipientUserIds: Array.from(selectedCarriers),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Save list error response:", result);
        throw new Error(result.error || "Failed to save list");
      }

      setShowSaveDialog(false);
      setSavedListName("");
      setEditingListId(null);
      mutateSavedLists();
      toast.success("List saved successfully!");
    } catch (error: any) {
      console.error("Error saving list:", error);
      toast.error(error.message || "Failed to save list");
    }
  };

  // Delete a saved list
  const handleDeleteSavedList = async (listId: string, listName: string) => {
    if (!confirm(`Are you sure you want to delete "${listName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/announcements/saved-lists/${listId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete list");
      }

      mutateSavedLists();
      toast.success("List deleted successfully");
    } catch (error: any) {
      console.error("Error deleting saved list:", error);
      toast.error(error.message || "Failed to delete list");
    }
  };

  // Edit a saved list
  const handleEditSavedList = async (listId: string) => {
    try {
      const response = await fetch(`/api/announcements/saved-lists/${listId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const list = result.data;
        setSavedListName(list.name);
        setSelectedCarriers(new Set(list.recipient_user_ids || []));
        setEditingListId(listId);
        setShowSaveDialog(true);
      }
    } catch (error: any) {
      console.error("Error loading list for editing:", error);
      toast.error("Failed to load list for editing");
    }
  };

  // Update an existing list
  const handleUpdateList = async () => {
    if (!savedListName.trim()) {
      toast.error("Please enter a name for this list");
      return;
    }

    if (selectedCarriers.size === 0) {
      toast.error("Please select at least one carrier to save");
      return;
    }

    if (!editingListId) {
      toast.error("No list selected for editing");
      return;
    }

    try {
      const response = await fetch(`/api/announcements/saved-lists/${editingListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savedListName.trim(),
          recipientUserIds: Array.from(selectedCarriers),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update list error response:", result);
        throw new Error(result.error || "Failed to update list");
      }

      setShowSaveDialog(false);
      setSavedListName("");
      setEditingListId(null);
      mutateSavedLists();
      toast.success("List updated successfully!");
    } catch (error: any) {
      console.error("Error updating list:", error);
      toast.error(error.message || "Failed to update list");
    }
  };

  const filteredAnnouncements = announcements.filter((announcement: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      announcement.title.toLowerCase().includes(query) ||
      announcement.message.toLowerCase().includes(query)
    );
  });

  const handleCreate = async () => {
    if (!title || !message) {
      toast.error("Title and message are required");
      return;
    }

    if (selectedCarriers.size === 0) {
      toast.error("Please select at least one carrier to receive this announcement");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          priority,
          recipientUserIds: Array.from(selectedCarriers),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create announcement");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create announcement");
      }

      mutate();
      setCreateDialogOpen(false);
      setTitle("");
      setMessage("");
      setPriority("normal");
      setSelectedCarriers(new Set());
      setCarrierSearchQuery("");
      
      const notificationsCount = result.notificationsCreated || 0;
      const emailsStatus = result.emailsQueued ? 'emails queued' : '0 emails sent';
      toast.success(`Announcement created! ${notificationsCount} notifications sent, ${emailsStatus}.`);
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      toast.error(error.message || "Failed to create announcement");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) {
      return;
    }

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete announcement");
      }

      mutate();
      toast.success("Announcement deleted successfully");
    } catch (error: any) {
      console.error("Error deleting announcement:", error);
      toast.error(error.message || "Failed to delete announcement");
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-destructive">Unauthorized</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Announcements</h1>
          <p className="text-muted-foreground">
            Create and manage system announcements for carriers
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
              <DialogDescription>
                Select which carriers should receive this announcement via in-app notifications and email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Announcement title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Announcement message"
                  rows={6}
                />
              </div>
              
              {/* Carrier Selection */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-lg">
                <div className="p-4 border-b bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <label className="text-sm font-medium">
                        Recipients ({selectedCarriers.size} of {carriers.length} selected)
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Saved Lists Dropdown */}
                      {savedLists.length > 0 && (
                        <Select onValueChange={handleLoadSavedList}>
                          <SelectTrigger className="w-[180px] text-xs h-8">
                            <SelectValue placeholder="Load saved list" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedLists.map((list: any) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name} ({list.recipient_user_ids?.length || 0})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {savedLists.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowManageListsDialog(true)}
                          className="text-xs"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Manage Lists
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingListId(null);
                          setSavedListName("");
                          setShowSaveDialog(true);
                        }}
                        className="text-xs"
                        disabled={selectedCarriers.size === 0}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        {editingListId ? "Update List" : "Save List"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="text-xs"
                      >
                        {selectedCarriers.size === filteredCarriers.length ? (
                          <>
                            <Square className="w-3 h-3 mr-1" />
                            Deselect All
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3 h-3 mr-1" />
                            Select All
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search carriers..."
                      value={carrierSearchQuery}
                      onChange={(e) => setCarrierSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {carriersLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : filteredCarriers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No carriers found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCarriers.map((carrier) => (
                        <div
                          key={carrier.userId}
                          className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleToggleCarrier(carrier.userId)}
                        >
                          <Checkbox
                            checked={selectedCarriers.has(carrier.userId)}
                            onCheckedChange={() => handleToggleCarrier(carrier.userId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {carrier.companyName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {carrier.contactName && `${carrier.contactName} • `}
                              {carrier.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setCreateDialogOpen(false);
                setSelectedCarriers(new Set());
                setCarrierSearchQuery("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || selectedCarriers.size === 0}>
                {creating ? "Creating..." : `Create Announcement (${selectedCarriers.size} recipients)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save/Edit List Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={(open) => {
          setShowSaveDialog(open);
          if (!open) {
            setSavedListName("");
            setEditingListId(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingListId ? "Edit Recipient List" : "Save Recipient List"}</DialogTitle>
              <DialogDescription>
                {editingListId 
                  ? `Update the list with your current selection of ${selectedCarriers.size} recipients.`
                  : `Save the current selection of ${selectedCarriers.size} recipients for future use.`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">List Name</label>
                <Input
                  value={savedListName}
                  onChange={(e) => setSavedListName(e.target.value)}
                  placeholder="e.g., All Active Carriers, Premium Carriers"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveList();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowSaveDialog(false);
                setSavedListName("");
                setEditingListId(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveList} disabled={!savedListName.trim()}>
                {editingListId ? "Update List" : "Save List"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Saved Lists Dialog */}
        <Dialog open={showManageListsDialog} onOpenChange={setShowManageListsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Manage Saved Lists</DialogTitle>
              <DialogDescription>
                View, edit, load, or delete your saved recipient lists.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
              {savedLists.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No saved lists yet.</p>
                  <p className="text-sm mt-2">Create a list by selecting recipients and clicking "Save List".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedLists.map((list: any) => (
                    <Card key={list.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-base">{list.name}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {list.recipient_user_ids?.length || 0} recipients
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>Created {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}</p>
                              {list.updated_at !== list.created_at && (
                                <p>Updated {formatDistanceToNow(new Date(list.updated_at), { addSuffix: true })}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleLoadSavedList(list.id);
                                setShowManageListsDialog(false);
                              }}
                              className="text-xs"
                            >
                              <FolderOpen className="w-3 h-3 mr-1" />
                              Load
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleEditSavedList(list.id);
                                setShowManageListsDialog(false);
                              }}
                              className="text-xs"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSavedList(list.id, list.name)}
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManageListsDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{announcements.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {announcements.filter((a: any) => a.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {announcements.reduce((sum: number, a: any) => sum + (parseInt(a.total_reads) || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No announcements found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement: any) => {
            const config = priorityConfig[announcement.priority as keyof typeof priorityConfig] || priorityConfig.normal;
            const Icon = config.icon;
            
            return (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{announcement.title}</h3>
                          <Badge variant={config.color as any}>{config.label}</Badge>
                          {!announcement.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                          </span>
                          <span>{announcement.total_reads || 0} reads</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {announcement.message}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

