"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeCarrierResponses } from "@/hooks/useRealtimeCarrierResponses";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Mail,
    MessageSquare,
    Reply,
    Send,
    User
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

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

interface CarrierResponse {
  id: string;
  message_id: string;
  carrier_user_id: string;
  response: string;
  created_at: string;
  updated_at: string;
}

export function CarrierMessagesClient() {
  const { accentColor } = useAccentColor();
  const { user } = useUnifiedUser();
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [responseText, setResponseText] = useState("");

  const { data: messagesData, mutate: mutateMessages } = useSWR(
    "/api/carrier/messages",
    fetcher,
    { refreshInterval: 60000 } // Reduced from 10s - Realtime handles instant updates
  );

  // Realtime updates for carrier_responses (to show responses in the UI)
  useRealtimeCarrierResponses({
    userId: user?.id,
    onInsert: () => {
      mutateMessages(); // Refresh to show new responses
    },
    onUpdate: () => {
      mutateMessages();
    },
    enabled: !!user,
  });

  const messages = messagesData?.data || [];

  const handleViewMessage = async (message: AdminMessage) => {
    setSelectedMessage(message);
    setShowMessageDialog(true);

    // Mark message as read if not already read
    if (!message.is_read) {
      try {
        await fetch(`/api/carrier/messages/${message.id}/read`, {
          method: 'POST'
        });
        mutateMessages();
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  const handleReply = (message: AdminMessage) => {
    setSelectedMessage(message);
    setResponseText("");
    setShowResponseDialog(true);
  };

  const handleSendResponse = async () => {
    if (!selectedMessage || !responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }

    setIsSendingResponse(true);
    try {
      const response = await fetch('/api/carrier/messages/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: selectedMessage.id,
          response: responseText.trim()
        })
      });

      if (response.ok) {
        toast.success("Response sent successfully");
        setShowResponseDialog(false);
        setResponseText("");
        mutateMessages();
      } else {
        throw new Error('Failed to send response');
      }
    } catch (error) {
      toast.error("Failed to send response");
      console.error(error);
    } finally {
      setIsSendingResponse(false);
    }
  };

  const getStatusBadge = (message: AdminMessage) => {
    if (message.is_read) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Read</Badge>;
    }
    return <Badge variant="destructive">Unread</Badge>;
  };

  const MessageCard = ({ message }: { message: AdminMessage }) => (
    <Card className={`hover:shadow-lg transition-shadow duration-200 ${!message.is_read ? 'border-l-4 border-l-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{message.subject}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(message)}
            {!message.is_read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Preview */}
        <div className="text-sm text-muted-foreground">
          {message.message.length > 150 
            ? `${message.message.substring(0, 150)}...` 
            : message.message
          }
        </div>

        {/* Message Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(message.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Admin</span>
            </div>
          </div>
          {message.is_read && message.read_at && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              <span>Read {new Date(message.read_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => handleViewMessage(message)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            View Message
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            style={{ backgroundColor: accentColor }}
            onClick={() => handleReply(message)}
          >
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const unreadCount = messages.filter((m: AdminMessage) => !m.is_read).length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{messages.length}</div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{unreadCount}</div>
                <div className="text-sm text-muted-foreground">Unread</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{messages.length - unreadCount}</div>
                <div className="text-sm text-muted-foreground">Read</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Messages from Administrators ({messages.length})
        </h3>
        
        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Messages</h3>
              <p className="text-muted-foreground">
                You don't have any messages from administrators yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {messages.map((message: AdminMessage) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* Message View Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
          </DialogHeader>
          
          {selectedMessage && (
            <div className="space-y-6">
              {/* Message Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Administrator</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedMessage)}
                </div>
              </div>

              {/* Message Content */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowMessageDialog(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowMessageDialog(false);
                    handleReply(selectedMessage);
                  }}
                  style={{ backgroundColor: accentColor }}
                  className="flex-1"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to: {selectedMessage?.subject}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Response</label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type your response to the administrator..."
                rows={6}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowResponseDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendResponse}
              disabled={isSendingResponse || !responseText.trim()}
              style={{ backgroundColor: accentColor }}
              className="flex-1"
            >
              {isSendingResponse ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Response
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
