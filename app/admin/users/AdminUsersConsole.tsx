"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Building2,
    CheckCircle,
    Edit3,
    History,
    MessageSquare,
    Search,
    Unlock,
    Users,
    X
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface CarrierProfile {
  id: string;
  user_id: string;
  company_name: string;
  legal_name?: string;
  mc_number: string;
  dot_number?: string;
  contact_name: string;
  phone: string;
  email: string;
  profile_status: 'pending' | 'approved' | 'declined' | 'open';
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  decline_reason?: string;
  is_first_login: boolean;
  profile_completed_at?: string;
  edits_enabled: boolean;
  edits_enabled_by?: string;
  edits_enabled_at?: string;
  created_at: string;
  updated_at: string;
}

interface AdminMessage {
  id: string;
  carrier_user_id: string;
  admin_user_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

interface CarrierChatMessage {
  id: string;
  carrier_user_id: string;
  message: string;
  created_at: string;
  updated_at: string;
}

interface ProfileHistory {
  id: number;
  carrier_user_id: string;
  profile_data: CarrierProfile;
  profile_status: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  decline_reason?: string;
  version_number: number;
  created_at: string;
}

export function AdminUsersConsole() {
  const accentColor = "hsl(221, 83%, 53%)"; // Default blue
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [newAppealMessage, setNewAppealMessage] = useState("");
  const [isSendingAppealMessage, setIsSendingAppealMessage] = useState(false);
  
  // Profile edit state
  const [editFormData, setEditFormData] = useState<Partial<CarrierProfile>>({});
  
  // Approval workflow state
  const [reviewNotes, setReviewNotes] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const { data: carriersData, mutate: mutateCarriers } = useSWR(
    "/api/admin/carriers",
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: historyData } = useSWR(
    showHistoryDialog && selectedCarrier ? `/api/admin/carriers/${selectedCarrier.user_id}/history` : null,
    fetcher,
    { fallbackData: { ok: true, data: [] } }
  );

  const { data: conversationData, mutate: mutateConversation } = useSWR(
    `/api/admin/appeal-conversations`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: conversationMessagesData, mutate: mutateConversationMessages } = useSWR(
    currentConversationId ? `/api/admin/appeal-conversations/${currentConversationId}` : null,
    fetcher,
    { refreshInterval: 10000 } // Reduced from 2s to 10s to prevent rate limiting
  );

  const carriers = carriersData?.data || [];
  const conversations = conversationData?.data || [];
  const conversationMessages = conversationMessagesData?.data || [];
  const profileHistory: ProfileHistory[] = historyData?.data || [];

  // Helper function to safely parse unread count
  const parseUnreadCount = (count: any): number => {
    if (count === null || count === undefined) return 0;
    const parsed = parseInt(String(count), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to get unread count for a carrier
  const getUnreadCount = (carrierUserId: string) => {
    if (!conversations || !Array.isArray(conversations)) {
      return 0;
    }
    const conversation = conversations.find((conv: any) => 
      conv.carrier_user_id === carrierUserId
    );
    return parseUnreadCount(conversation?.unread_count);
  };

  // Filter carriers based on search term
  const filteredCarriers = carriers.filter((carrier: CarrierProfile) =>
    (carrier.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (carrier.mc_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (carrier.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (carrier.user_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditProfile = (carrier: CarrierProfile) => {
    setSelectedCarrier(carrier);
    setEditFormData({
      company_name: carrier.company_name,
      mc_number: carrier.mc_number,
      dot_number: carrier.dot_number || "",
      contact_name: carrier.contact_name,
      phone: carrier.phone
    });
    setIsEditing(true);
    setShowProfileDialog(true);
  };

  const handleOpenAppeal = async (carrier: CarrierProfile) => {
    setSelectedCarrier(carrier);
    
    // Find existing conversation with this carrier
    const existingConversation = conversations.find((conv: any) => 
      conv.carrier_user_id === carrier.user_id
    );
    
    if (existingConversation) {
      setCurrentConversationId(existingConversation.conversation_id);
      
      // Mark messages as read
      try {
        await fetch(`/api/admin/appeal-conversations/${existingConversation.conversation_id}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        mutateConversation(); // Refresh conversations to update unread counts
      } catch (error) {
        console.error('Error marking appeal messages as read:', error);
      }
    } else {
      // Create a new conversation if one doesn't exist
      try {
        const response = await fetch('/api/admin/appeal-conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier_user_id: carrier.user_id
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Appeal conversation created successfully:', data);
          setCurrentConversationId(data.conversation_id);
          mutateConversation(); // Refresh conversations
        } else {
          const errorData = await response.json();
          console.error('Failed to create appeal conversation:', errorData);
          setCurrentConversationId(null);
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
        setCurrentConversationId(null);
      }
    }
    
    setNewAppealMessage("");
    setShowAppealDialog(true);
  };

  const handleSendAppealMessage = async () => {
    if (!newAppealMessage.trim() || !selectedCarrier) return;
    
    setIsSendingAppealMessage(true);
    try {
      let conversationId = currentConversationId;
      
      // If no conversation exists, create one
      if (!conversationId) {
        const response = await fetch('/api/admin/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier_user_id: selectedCarrier.user_id
          })
        });
        
        if (!response.ok) throw new Error('Failed to create conversation');
        const data = await response.json();
        conversationId = data.conversation_id;
        setCurrentConversationId(conversationId);
      }
      
      // Send message
      const messageResponse = await fetch(`/api/admin/appeal-conversations/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newAppealMessage })
      });
      
      if (!messageResponse.ok) throw new Error('Failed to send message');
      
      setNewAppealMessage("");
      mutateConversationMessages();
      mutateConversation();
    } catch (error) {
      console.error('Error sending chat message:', error);
    } finally {
      setIsSendingAppealMessage(false);
    }
  };

  const handleViewHistory = (carrier: CarrierProfile) => {
    setSelectedCarrier(carrier);
    setShowHistoryDialog(true);
  };

  const handleLockProfile = async (carrier: CarrierProfile, reason: string) => {
    try {
      const response = await fetch(`/api/admin/carriers/${carrier.user_id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        toast.success("Profile locked successfully");
        mutateCarriers();
      } else {
        throw new Error('Failed to lock profile');
      }
    } catch (error) {
      toast.error("Failed to lock profile");
      console.error(error);
    }
  };

  const handleUnlockProfile = async (carrier: CarrierProfile) => {
    try {
      const response = await fetch(`/api/admin/carriers/${carrier.user_id}/unlock`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success("Profile unlocked successfully");
        mutateCarriers();
      } else {
        throw new Error('Failed to unlock profile');
      }
    } catch (error) {
      toast.error("Failed to unlock profile");
      console.error(error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedCarrier) return;
    
    setIsUpdatingProfile(true);
    try {
      const response = await fetch(`/api/admin/carriers/${selectedCarrier.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        toast.success("Profile updated successfully");
        setIsEditing(false);
        setShowProfileDialog(false);
        mutateCarriers();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };


  const handleApproveProfile = async () => {
    if (!selectedCarrier) return;
    
    setIsApproving(true);
    try {
      const response = await fetch(`/api/admin/carriers/${selectedCarrier.user_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_notes: reviewNotes })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Carrier profile approved successfully");
        setShowApproveDialog(false);
        setReviewNotes("");
        mutateCarriers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve profile');
      }
    } catch (error) {
      toast.error("Failed to approve profile");
      console.error(error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeclineProfile = async () => {
    if (!selectedCarrier || !declineReason) {
      toast.error("Please provide a decline reason");
      return;
    }

    setIsDeclining(true);
    try {
      const response = await fetch(`/api/admin/carriers/${selectedCarrier.user_id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decline_reason: declineReason,
          review_notes: reviewNotes 
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Carrier profile declined successfully");
        setShowDeclineDialog(false);
        setDeclineReason("");
        setReviewNotes("");
        mutateCarriers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline profile');
      }
    } catch (error) {
      toast.error("Failed to decline profile");
      console.error(error);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleUnlockEdits = async (carrier: CarrierProfile) => {
    try {
      const response = await fetch(`/api/admin/carriers/${carrier.user_id}/unlock-edits`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Profile edits unlocked successfully");
        
        // Force refresh the carriers data
        mutateCarriers();
      } else {
        const errorData = await response.json();
        console.error('Unlock edits API error:', errorData);
        throw new Error(errorData.error || 'Failed to unlock edits');
      }
    } catch (error) {
      toast.error("Failed to unlock edits");
      console.error(error);
    }
  };

  const handleLockEdits = async (carrier: CarrierProfile, restoreStatus: 'approved' | 'declined') => {
    try {
      const response = await fetch(`/api/admin/carriers/${carrier.user_id}/lock-edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore_status: restoreStatus })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Profile edits locked successfully");
        mutateCarriers();
      } else {
        const errorData = await response.json();
        console.error('Lock edits API error:', errorData);
        throw new Error(errorData.error || 'Failed to lock edits');
      }
    } catch (error) {
      toast.error("Failed to lock edits");
      console.error(error);
    }
  };

  const handleToggleStatus = async (carrier: CarrierProfile, newStatus: 'approved' | 'declined', reason?: string, reviewNotes?: string) => {
    try {
      const response = await fetch(`/api/admin/carriers/${carrier.user_id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          new_status: newStatus,
          reason: newStatus === 'declined' ? reason : undefined,
          review_notes: reviewNotes
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `Profile status changed to ${newStatus}`);
        mutateCarriers();
      } else {
        const errorData = await response.json();
        console.error('Toggle status API error:', errorData);
        throw new Error(errorData.error || 'Failed to toggle status');
      }
    } catch (error) {
      toast.error("Failed to toggle status");
      console.error(error);
    }
  };

  const getStatusBadge = (carrier: CarrierProfile) => {
    switch (carrier.profile_status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'open':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Open</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const CarrierCard = ({ carrier }: { carrier: CarrierProfile }) => (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{carrier.company_name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(carrier)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">MC #:</span>
            <div className="font-medium">{carrier.mc_number}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Contact:</span>
            <div className="font-medium">{carrier.contact_name}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Phone:</span>
            <div className="font-medium">{carrier.phone}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <div className="font-medium">{carrier.email}</div>
          </div>
          <div>
            <span className="text-muted-foreground">DOT #:</span>
            <div className="font-medium">{carrier.dot_number || 'N/A'}</div>
          </div>
        </div>

        {/* Profile Status Info */}
        {carrier.profile_status === 'declined' && carrier.decline_reason && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm text-red-800">
              <strong>Decline Reason:</strong> {carrier.decline_reason}
            </div>
            <div className="text-xs text-red-600 mt-1">
              Declined: {carrier.reviewed_at ? new Date(carrier.reviewed_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>
        )}

        {carrier.profile_status === 'approved' && carrier.review_notes && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-800">
              <strong>Review Notes:</strong> {carrier.review_notes}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Approved: {carrier.reviewed_at ? new Date(carrier.reviewed_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>
        )}

        {carrier.profile_status === 'pending' && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-800">
              <strong>Status:</strong> Awaiting admin review
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              Submitted: {carrier.submitted_at ? new Date(carrier.submitted_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => handleEditProfile(carrier)}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            View Profile
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => handleViewHistory(carrier)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            size="sm" 
            className="flex-1 relative"
            style={{ backgroundColor: accentColor }}
            onClick={() => handleOpenAppeal(carrier)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Appeal Decision
            {getUnreadCount(carrier.user_id) > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
              >
                {getUnreadCount(carrier.user_id)}
              </Badge>
            )}
          </Button>
        </div>

        {/* Approval Workflow Buttons */}
        {carrier.profile_status === 'pending' && (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              setSelectedCarrier(carrier);
                setReviewNotes("");
                setShowDeclineDialog(true);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button 
              size="sm" 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setSelectedCarrier(carrier);
                setReviewNotes("");
                setShowApproveDialog(true);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
          </Button>
        </div>
        )}

        {/* Unlock Edits Button for Approved/Declined Profiles */}
        {(carrier.profile_status === 'approved' || carrier.profile_status === 'declined') && !carrier.edits_enabled && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => handleUnlockEdits(carrier)}
            >
              <Unlock className="h-4 w-4 mr-2" />
              {carrier.profile_status === 'declined' ? 'Reset Approval Process' : 'Unlock Edits'}
            </Button>
          </div>
        )}

        {/* Lock Edits and Status Management for Open Profiles */}
        {carrier.profile_status === 'open' && carrier.edits_enabled && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => handleLockEdits(carrier, 'approved')}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Lock (Approved)
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => handleLockEdits(carrier, 'declined')}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Lock (Declined)
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleToggleStatus(carrier, 'approved')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Set Approved
              </Button>
              <Button 
                size="sm" 
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setSelectedCarrier(carrier);
                  setReviewNotes("");
                  setShowDeclineDialog(true);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Set Declined
              </Button>
            </div>
          </div>
        )}

        {/* Status Toggle for Any Profile Status (Approved/Declined) */}
        {(carrier.profile_status === 'approved' || carrier.profile_status === 'declined') && carrier.edits_enabled && (
          <div className="flex gap-2">
            {carrier.profile_status === 'approved' ? (
              <Button 
                size="sm" 
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setSelectedCarrier(carrier);
                  setReviewNotes("");
                  setShowDeclineDialog(true);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Change to Declined
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setSelectedCarrier(carrier);
                  setReviewNotes("");
                  setShowApproveDialog(true);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Change to Approved
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search carriers by company, MC#, contact name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-muted-foreground">
            {filteredCarriers.length} carriers
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{carriers.length}</div>
                <div className="text-sm text-muted-foreground">Total Carriers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  {carriers.filter((c: CarrierProfile) => c.profile_status === 'approved').length}
                </div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">
                  {carriers.filter((c: CarrierProfile) => c.profile_status === 'declined').length}
                </div>
                <div className="text-sm text-muted-foreground">Declined</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">
                  {conversations && Array.isArray(conversations) 
                    ? conversations.reduce((total: number, conv: any) => total + parseUnreadCount(conv.unread_count), 0)
                    : 0
                  }
                </div>
                <div className="text-sm text-muted-foreground">Unread Messages</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carriers List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Carrier Profiles ({filteredCarriers.length})
        </h3>
        
        {filteredCarriers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Carriers Found</h3>
              <p className="text-muted-foreground">
                No carriers match your search criteria.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCarriers.map((carrier: CarrierProfile) => (
              <CarrierCard key={carrier.id} carrier={carrier} />
            ))}
          </div>
        )}
      </div>

      {/* Profile Edit Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Carrier Profile" : "View Carrier Profile"} - {selectedCarrier?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCarrier && (
            <div className="space-y-6">
              {/* Profile Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_company_name">Company Name</Label>
                    <Input
                      id="edit_company_name"
                      value={editFormData.company_name || ""}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_contact_name">Contact Name</Label>
                    <Input
                      id="edit_contact_name"
                      value={editFormData.contact_name || ""}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_mc_number">MC Number</Label>
                    <Input
                      id="edit_mc_number"
                      value={editFormData.mc_number || ""}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, mc_number: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_dot_number">DOT Number</Label>
                    <Input
                      id="edit_dot_number"
                      value={editFormData.dot_number || ""}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, dot_number: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Phone Number</Label>
                  <Input
                    id="edit_phone"
                    value={editFormData.phone || ""}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowProfileDialog(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateProfile}
                      disabled={isUpdatingProfile}
                      style={{ backgroundColor: accentColor }}
                      className="flex-1"
                    >
                      {isUpdatingProfile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Update Profile
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    style={{ backgroundColor: accentColor }}
                    className="flex-1"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Appeal Decision Dialog */}
      <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Appeal Decision - {selectedCarrier?.company_name}</DialogTitle>
          </DialogHeader>
          
          {selectedCarrier && (
            <div className="flex flex-col h-[70vh]">
              {/* Profile Status Info */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Profile Status:</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedCarrier.profile_status === 'approved' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : selectedCarrier.profile_status === 'declined'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {selectedCarrier.profile_status === 'approved' ? 'Approved' : 
                     selectedCarrier.profile_status === 'declined' ? 'Declined' : 'Pending Review'}
                  </span>
                </div>
                {selectedCarrier.profile_status === 'declined' && selectedCarrier.decline_reason && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-200 dark:border-red-700">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <strong>Decline Reason:</strong> {selectedCarrier.decline_reason}
                    </p>
                    {selectedCarrier.review_notes && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        <strong>Admin Notes:</strong> {selectedCarrier.review_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Appeal Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30 rounded-lg">
                {conversationMessages.length > 0 ? (
                  conversationMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        msg.sender_type === 'admin' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        <div className="font-semibold text-xs mb-1">
                          {msg.sender_type === 'admin' ? 'You' : selectedCarrier.company_name}
                        </div>
                        <div>{msg.message}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No appeal messages yet</p>
                    <p className="text-sm">Waiting for {selectedCarrier.company_name} to send an appeal message</p>
                  </div>
                )}
              </div>

              {/* Appeal Response Input */}
              <div className="flex gap-2 pt-4">
                <Input
                  value={newAppealMessage}
                  onChange={(e) => setNewAppealMessage(e.target.value)}
                  placeholder="Type your response to the carrier's appeal..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAppealMessage();
                    }
                  }}
                  disabled={isSendingAppealMessage}
                />
                <Button
                  onClick={handleSendAppealMessage}
                  disabled={!newAppealMessage.trim() || isSendingAppealMessage}
                  style={{ backgroundColor: accentColor }}
                >
                  {isSendingAppealMessage ? "Sending..." : "Send Response"}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAppealDialog(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Profile Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Carrier Profile - {selectedCarrier?.company_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-800">
                <strong>Company:</strong> {selectedCarrier?.company_name}<br/>
                <strong>MC Number:</strong> {selectedCarrier?.mc_number}<br/>
                <strong>Contact:</strong> {selectedCarrier?.contact_name}<br/>
                <strong>Phone:</strong> {selectedCarrier?.phone}<br/>
                <strong>Email:</strong> {selectedCarrier?.email}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="review_notes">Review Notes (Optional)</Label>
              <Textarea
                id="review_notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveProfile}
              disabled={isApproving}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isApproving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Profile
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Profile Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Decline Carrier Profile - {selectedCarrier?.company_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm text-red-800">
                <strong>Company:</strong> {selectedCarrier?.company_name}<br/>
                <strong>MC Number:</strong> {selectedCarrier?.mc_number}<br/>
                <strong>Contact:</strong> {selectedCarrier?.contact_name}<br/>
                <strong>Phone:</strong> {selectedCarrier?.phone}<br/>
                <strong>Email:</strong> {selectedCarrier?.email}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="decline_reason">Decline Reason *</Label>
              <Textarea
                id="decline_reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Please provide a reason for declining this profile..."
                rows={3}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="decline_review_notes">Additional Notes (Optional)</Label>
              <Textarea
                id="decline_review_notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeclineDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeclineProfile}
              disabled={isDeclining || !declineReason}
              variant="destructive"
              className="flex-1"
            >
              {isDeclining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Declining...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Decline Profile
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Profile History - {selectedCarrier?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {profileHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No profile history available.</p>
                    </div>
            ) : (
              profileHistory.map((history, index) => (
                <Card key={history.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Version {history.version_number}
                        </Badge>
                        <Badge 
                          variant={history.profile_status === 'approved' ? 'default' : 
                                  history.profile_status === 'declined' ? 'destructive' : 'secondary'}
                          className={history.profile_status === 'approved' ? 'bg-green-500' : 
                                    history.profile_status === 'declined' ? 'bg-red-500' : ''}
                        >
                          {history.profile_status.charAt(0).toUpperCase() + history.profile_status.slice(1)}
                        </Badge>
                  </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(history.submitted_at).toLocaleString()}
                      </span>
                </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Company:</strong> {history.profile_data.legal_name || history.profile_data.company_name}
                      </div>
                      <div>
                        <strong>MC #:</strong> {history.profile_data.mc_number}
                      </div>
                      <div>
                        <strong>Contact:</strong> {history.profile_data.contact_name}
                      </div>
                      <div>
                        <strong>Phone:</strong> {history.profile_data.phone}
                      </div>
                      {history.profile_data.dot_number && (
                        <div>
                          <strong>DOT #:</strong> {history.profile_data.dot_number}
                        </div>
                      )}
                    </div>

                    {history.review_notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-md">
                        <strong className="text-sm">Review Notes:</strong>
                        <p className="text-sm text-muted-foreground mt-1">
                          {history.review_notes}
                        </p>
                  </div>
                    )}

                    {history.decline_reason && (
                      <div className="mt-4 p-3 bg-red-50 rounded-md">
                        <strong className="text-sm text-red-700">Decline Reason:</strong>
                        <p className="text-sm text-red-600 mt-1">
                          {history.decline_reason}
                        </p>
                  </div>
                    )}

                    {history.reviewed_at && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Reviewed: {new Date(history.reviewed_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
                )}
              </div>

          <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
              onClick={() => setShowHistoryDialog(false)}
                >
                  Close
                </Button>
              </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
