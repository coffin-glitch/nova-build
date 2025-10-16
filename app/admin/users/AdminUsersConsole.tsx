"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
    Building2,
    CheckCircle,
    Edit3,
    Lock,
    MessageSquare,
    Search,
    Send,
    Unlock,
    Users
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface CarrierProfile {
  id: string;
  user_id: string;
  company_name: string;
  mc_number: string;
  dot_number?: string;
  contact_name: string;
  phone: string;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  lock_reason?: string;
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

export function AdminUsersConsole() {
  const { accentColor } = useAccentColor();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierProfile | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Message form state
  const [messageSubject, setMessageSubject] = useState("");
  const [messageContent, setMessageContent] = useState("");
  
  // Profile edit state
  const [editFormData, setEditFormData] = useState<Partial<CarrierProfile>>({});

  const { data: carriersData, mutate: mutateCarriers } = useSWR(
    "/api/admin/carriers",
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: messagesData, mutate: mutateMessages } = useSWR(
    selectedCarrier ? `/api/admin/messages/${selectedCarrier.user_id}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: chatMessagesData, mutate: mutateChatMessages } = useSWR(
    selectedCarrier ? `/api/admin/chat-messages/${selectedCarrier.user_id}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const carriers = carriersData?.data || [];
  const messages = messagesData?.data || [];
  const chatMessages = chatMessagesData?.data || [];

  // Filter carriers based on search term
  const filteredCarriers = carriers.filter((carrier: CarrierProfile) =>
    carrier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.mc_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.user_id.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleSendMessage = (carrier: CarrierProfile) => {
    setSelectedCarrier(carrier);
    setMessageSubject("");
    setMessageContent("");
    setShowMessageDialog(true);
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

  const handleSendMessageSubmit = async () => {
    if (!selectedCarrier || !messageSubject || !messageContent) {
      toast.error("Please fill in all message fields");
      return;
    }

    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier_user_id: selectedCarrier.user_id,
          subject: messageSubject,
          message: messageContent
        })
      });

      if (response.ok) {
        toast.success("Message sent successfully");
        setShowMessageDialog(false);
        setMessageSubject("");
        setMessageContent("");
        mutateMessages();
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getStatusBadge = (carrier: CarrierProfile) => {
    if (carrier.is_locked) {
      return <Badge variant="destructive">Locked</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
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
            {carrier.is_locked && (
              <Lock className="h-4 w-4 text-red-500" />
            )}
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
            <span className="text-muted-foreground">DOT #:</span>
            <div className="font-medium">{carrier.dot_number || 'N/A'}</div>
          </div>
        </div>

        {/* Lock Info */}
        {carrier.is_locked && carrier.lock_reason && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm text-red-800">
              <strong>Lock Reason:</strong> {carrier.lock_reason}
            </div>
            <div className="text-xs text-red-600 mt-1">
              Locked: {new Date(carrier.locked_at!).toLocaleDateString()}
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
            Edit Profile
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            style={{ backgroundColor: accentColor }}
            onClick={() => handleSendMessage(carrier)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>

        {/* Chat Console Button */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              setSelectedCarrier(carrier);
              setShowChatDialog(true);
            }}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            View Chat
          </Button>
        </div>

        {/* Lock/Unlock Actions */}
        <div className="flex gap-2">
          {carrier.is_locked ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => handleUnlockProfile(carrier)}
            >
              <Unlock className="h-4 w-4 mr-2" />
              Unlock Profile
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                const reason = prompt("Enter lock reason:");
                if (reason) handleLockProfile(carrier, reason);
              }}
            >
              <Lock className="h-4 w-4 mr-2" />
              Lock Profile
            </Button>
          )}
        </div>
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
                  {carriers.filter((c: CarrierProfile) => !c.is_locked).length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">
                  {carriers.filter((c: CarrierProfile) => c.is_locked).length}
                </div>
                <div className="text-sm text-muted-foreground">Locked</div>
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
                  {messages.filter((m: AdminMessage) => !m.is_read).length}
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

      {/* Send Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Message to {selectedCarrier?.company_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message_subject">Subject</Label>
              <Input
                id="message_subject"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Enter message subject"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message_content">Message</Label>
              <Textarea
                id="message_content"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter your message to the carrier..."
                rows={6}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowMessageDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessageSubmit}
              disabled={isSendingMessage || !messageSubject || !messageContent}
              style={{ backgroundColor: accentColor }}
              className="flex-1"
            >
              {isSendingMessage ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Console Dialog */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chat Console - {selectedCarrier?.company_name}</DialogTitle>
          </DialogHeader>
          
          {selectedCarrier && (
            <div className="flex flex-col h-[70vh]">
              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30 rounded-lg">
                {/* Welcome Message */}
                <div className="flex flex-col items-start">
                  <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                    <div className="font-semibold text-xs mb-1">Admin</div>
                    <div>Welcome to NOVA Build! How can we help you today?</div>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                {chatMessages.map((msg: CarrierChatMessage) => (
                  <div key={msg.id} className="space-y-2">
                    {/* Carrier Message */}
                    <div className="flex flex-col items-end">
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-slate-500 text-white">
                        <div className="font-semibold text-xs mb-1">You</div>
                        <div>{msg.message}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    
                    {/* Admin Response */}
                    <div className="flex flex-col items-start">
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                        <div className="font-semibold text-xs mb-1">Admin</div>
                        <div>Thank you for your message. We'll get back to you shortly!</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No chat messages yet</p>
                    <p className="text-sm">Messages from the floating Nova chat will appear here</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowChatDialog(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowChatDialog(false);
                    handleSendMessage(selectedCarrier);
                  }}
                  style={{ backgroundColor: accentColor }}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Formal Message
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
