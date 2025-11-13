"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface OfferComment {
  id: string;
  offer_id: string;
  author_id: string;
  author_role: 'admin' | 'carrier';
  comment_text: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  author_email?: string;
  author_display_name?: string;
}

interface OfferMessageConsoleProps {
  offerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OfferMessageConsole({ offerId, isOpen, onClose }: OfferMessageConsoleProps) {
  const { user } = useUnifiedUser();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch offer comments (using existing API)
  const { data: commentsData, mutate: mutateComments } = useSWR(
    offerId ? `/api/offers/${offerId}/comments` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const comments = commentsData?.comments || [];

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !offerId) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment_text: newMessage.trim(),
          is_internal: false // Allow carriers to see messages
        })
      });

      if (response.ok) {
        toast.success("Message sent successfully");
        setNewMessage("");
        mutateComments();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, offerId, mutateComments]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getSenderInitials = (authorId: string, authorRole: string) => {
    if (authorRole === 'admin') {
      return 'AD';
    }
    return user?.id === authorId ? 'ME' : 'CR';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Offer Messages - #{offerId}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start a conversation about this offer</p>
                </div>
              ) : (
                comments.map((comment: OfferComment) => (
                  <div
                    key={comment.id}
                    className={`flex gap-3 ${
                      comment.author_id === user?.id ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getSenderInitials(comment.author_id, comment.author_role)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className={`flex-1 max-w-[80%] ${
                      comment.author_id === user?.id ? 'text-right' : ''
                    }`}>
                      <div className={`rounded-lg px-3 py-2 ${
                        comment.author_id === user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted text-foreground'
                      }`}>
                        <p className="text-sm">{comment.comment_text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(comment.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isSending}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
