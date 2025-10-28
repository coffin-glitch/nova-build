"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface BidMessageConsoleProps {
  bidNumber: string;
  userRole: 'admin' | 'carrier';
  userId: string;
  onClose: () => void;
}

export function BidMessageConsole({ bidNumber, userRole, userId, onClose }: BidMessageConsoleProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { accentColor } = useAccentColor();

  const { data, mutate } = useSWR(
    `/api/bid-messages/${bidNumber}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const messages = data?.data?.messages || [];
  const unreadCount = data?.data?.unreadCount || 0;

  const handleSend = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/bid-messages/${bidNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() })
      });

      const result = await response.json();

      if (result.ok) {
        setMessage("");
        mutate();
      } else {
        toast.error(result.error || 'Failed to send message');
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={!!bidNumber} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 border-violet-500/30 backdrop-blur-xl">
        <DialogHeader className="pb-4 border-b border-violet-500/20">
          <DialogTitle className="flex items-center justify-between">
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-200 to-purple-200 bg-clip-text text-transparent">
                Bid Messages
              </span>
              <Badge className="ml-2 bg-violet-500/20 text-violet-300 border-violet-500/30">
                #{bidNumber}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-[400px] max-h-[60vh] pr-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg: any) => {
                const isOwn = msg.sender_id === userId;
                const isAdmin = msg.sender_role === 'admin';
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isAdmin
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : isOwn
                          ? 'bg-blue-500/20 border border-blue-500/30'
                          : 'bg-slate-800/50 border border-slate-600/30'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-1">
                        {msg.sender_name || (msg.sender_role === 'admin' ? 'Admin' : 'Carrier')}
                      </div>
                      <div className="text-sm">{msg.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-violet-500/20 pt-4">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              size="icon"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Badge } from "@/components/ui/badge";

