"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccentColor } from "@/hooks/useAccentColor";
import { EyeOff, MessageSquare, Send, Shield, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const { accentColor } = useAccentColor();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR(
    `/api/bid-messages/${bidNumber}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const messages = data?.data?.messages || [];
  const unreadCount = data?.data?.unreadCount || 0;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      console.log('[Message Console] Sending message:', { bidNumber, message: message.trim().substring(0, 50), isInternal, userRole });
      
      const response = await fetch(`/api/bid-messages/${bidNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: message.trim(),
          is_internal: userRole === 'admin' ? isInternal : false
        })
      });

      console.log('[Message Console] Response status:', response.status);
      
      const result = await response.json();
      console.log('[Message Console] Response data:', result);

      if (result.ok) {
        setMessage("");
        setIsInternal(false);
        mutate();
        if (isInternal) {
          toast.success('Internal note sent');
        } else {
          toast.success('Message sent');
        }
      } else {
        console.error('[Message Console] Error response:', result);
        toast.error(result.error || result.details || 'Failed to send message');
      }
    } catch (error) {
      console.error('[Message Console] Exception caught:', error);
      toast.error('Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Bid Messages
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    #{bidNumber}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {userRole === 'admin' ? 'Admin' : 'Carrier'} View
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200 dark:hover:bg-slate-700">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages Container */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50 dark:bg-slate-950">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No messages yet
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Start the conversation by sending your first message below.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg: any, index: number) => {
                const isOwn = msg.sender_id === userId;
                const isAdmin = msg.sender_role === 'admin';
                
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <Avatar className="w-10 h-10 shadow-md shrink-0">
                      <AvatarFallback className={
                        isAdmin
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      }>
                        {isAdmin ? <Shield className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Content */}
                    <div className={`flex-1 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {msg.sender_name || (isAdmin ? 'Admin' : 'Carrier')}
                        </span>
                        {msg.is_internal && (
                          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Internal
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                        msg.is_internal
                          ? 'bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-white border-2 border-amber-400 dark:border-amber-600'
                          : isAdmin
                          ? 'bg-gradient-to-br from-violet-500/90 to-purple-600/90 text-white'
                          : isOwn
                          ? 'bg-gradient-to-br from-blue-500/90 to-indigo-600/90 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t bg-white dark:bg-slate-900">
          {/* Internal Message Toggle - Only for Admins */}
          {userRole === 'admin' && (
            <div className="mb-3 flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <Label htmlFor="internal-toggle" className="text-sm font-medium text-amber-900 dark:text-amber-300 cursor-pointer">
                  Internal Note
                </Label>
              </div>
              <Switch
                id="internal-toggle"
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              <p className="text-xs text-amber-700 dark:text-amber-400 ml-2">
                Only visible to admins
              </p>
            </div>
          )}
          
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isInternal ? "Type internal note..." : "Type your message..."}
                className="pr-12 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              size="icon"
              className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-5 w-5 text-white" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

