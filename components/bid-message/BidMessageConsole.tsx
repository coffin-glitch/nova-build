"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useRealtimeBidMessages } from "@/hooks/useRealtimeBidMessages";
import { EyeOff, MessageSquare, Send, Shield, Truck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
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
  const [displayLimit, setDisplayLimit] = useState(50); // Show last N messages
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { accentColor } = useAccentColor();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  const { data, mutate } = useSWR(
    `/api/bid-messages/${bidNumber}`,
    fetcher,
    { refreshInterval: 60000 } // Reduced from 5s - Realtime handles instant updates
  );

  // Realtime updates for bid_messages
  useRealtimeBidMessages({
    bidNumber: bidNumber,
    onInsert: () => {
      mutate();
    },
    onUpdate: () => {
      mutate();
    },
    onDelete: () => {
      mutate();
    },
    enabled: !!bidNumber,
  });

  const allMessages = data?.data?.messages || [];
  const unreadCount = data?.data?.unreadCount || 0;
  
  // Double-check: Filter out internal messages for carriers (should be done server-side but extra safety)
  const filteredMessages = userRole === 'carrier' 
    ? allMessages.filter((m: any) => !m.is_internal)
    : allMessages;
  
  // Pagination: Show last N messages (most recent)
  const messages = filteredMessages.slice(-displayLimit);
  const hasMoreMessages = filteredMessages.length > displayLimit;
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length]); // Only scroll when total count changes (new messages)
  
  // Infinite scroll handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    
    // Load more when scrolled to near the top (within 300px)
    if (scrollTop < 300 && hasMoreMessages && !isLoadingRef.current) {
      isLoadingRef.current = true;
      setIsLoadingMore(true);
      
      setTimeout(() => {
        const prevScrollHeight = element.scrollHeight;
        setDisplayLimit(prev => prev + 25);
        
        // Maintain scroll position after loading more
        setTimeout(() => {
          const newScrollHeight = element.scrollHeight;
          element.scrollTop = newScrollHeight - prevScrollHeight + scrollTop;
          isLoadingRef.current = false;
          setIsLoadingMore(false);
        }, 50);
      }, 100);
    }
  };

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
      
      if (!response.ok) {
        console.error('[Message Console] HTTP Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[Message Console] Error response body:', errorText);
        toast.error(`Failed to send message (${response.status})`);
        return;
      }
      
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
      <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shrink-0">
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
          </div>
        </div>

        {/* Messages Container */}
        <div 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50 dark:bg-slate-950 min-h-0"
        >
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="text-sm text-muted-foreground">Loading more messages...</div>
            </div>
          )}
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
                const isAdmin = msg.sender_role === 'admin';
                // For carriers: their messages on right, admin messages on left
                // For admins: their messages on right, carrier messages on left
                // Note: API uses supabase_sender_id (migration 078 removed sender_id)
                const senderId = msg.supabase_sender_id || msg.sender_id;
                const isOwn = userRole === 'carrier' 
                  ? senderId === userId  // Carrier's own messages
                  : isAdmin && senderId === userId;  // Admin's own messages
                
                return (
                  <React.Fragment key={msg.id || `msg-${index}`}>
                    {/* Internal Message Banner */}
                    {msg.is_internal && userRole === 'admin' && index === 0 && (
                      <div className="flex items-center justify-center mb-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                          <EyeOff className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                            Internal Admin Notes
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div
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
                        {msg.is_internal && userRole === 'admin' && (
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
                          msg.is_internal && userRole === 'admin'
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
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t bg-white dark:bg-slate-900 shrink-0">
          {/* Internal Note Checkbox - Only for Admins */}
          {userRole === 'admin' && (
            <div className="mb-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600">
                <Checkbox
                  checked={isInternal}
                  onCheckedChange={(checked) => setIsInternal(checked === true)}
                  className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                />
                <div className="flex-1 flex items-center gap-2">
                  <EyeOff className={`w-4 h-4 ${isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${isInternal ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    Send as internal note
                  </span>
                </div>
                {isInternal && (
                  <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                    Admin Only
                  </Badge>
                )}
              </label>
              {isInternal && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-1 flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  This note will only be visible to other admins
                </p>
              )}
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

