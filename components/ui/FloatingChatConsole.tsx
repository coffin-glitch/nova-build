"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
    Maximize2,
    MessageCircle,
    Minimize2,
    MoreVertical,
    Search,
    Send,
    Users,
    X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface ChatMessage {
  id: string;
  carrier_user_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface AdminMessage {
  id: string;
  carrier_user_id: string;
  subject: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface CarrierProfile {
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  profile_image_url?: string;
}

interface UserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  username: string | null;
}

export default function FloatingChatConsole() {
  const { accentColor } = useAccentColor();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Add floating animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { 
          transform: translateY(0px) rotate(0deg); 
        }
        25% { 
          transform: translateY(-8px) rotate(1deg); 
        }
        50% { 
          transform: translateY(-12px) rotate(0deg); 
        }
        75% { 
          transform: translateY(-8px) rotate(-1deg); 
        }
      }
      
      @keyframes float-gentle {
        0%, 100% { 
          transform: translateY(0px); 
        }
        50% { 
          transform: translateY(-6px); 
        }
      }
      
      @keyframes pulse-glow {
        0%, 100% { 
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
        50% { 
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 40px rgba(147, 51, 234, 0.3);
        }
      }
      
      .floating-button {
        animation: float 4s ease-in-out infinite, pulse-glow 3s ease-in-out infinite;
      }
      
      .floating-console {
        animation: float-gentle 6s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data
  const { data: chatMessagesData, mutate: mutateChatMessages } = useSWR(
    "/api/admin/all-chat-messages",
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: adminMessagesData, mutate: mutateAdminMessages } = useSWR(
    "/api/admin/all-messages",
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: carriersData } = useSWR(
    "/api/admin/carriers",
    fetcher,
    { refreshInterval: 10000 }
  );

  const chatMessages: ChatMessage[] = chatMessagesData?.data || [];
  const adminMessages: AdminMessage[] = adminMessagesData?.data || [];
  const carriers: CarrierProfile[] = Array.isArray(carriersData) ? carriersData : [];

  // Get unique carrier user IDs
  const carrierUserIds = Array.from(new Set([
    ...chatMessages.map((msg: ChatMessage) => msg.carrier_user_id),
    ...adminMessages.map((msg: AdminMessage) => msg.carrier_user_id)
  ]));

  // Fetch user information for all carriers
  const { data: userInfos = {} } = useSWR(
    carrierUserIds.length > 0 ? `/api/users/batch?ids=${carrierUserIds.join(',')}` : null,
    fetcher
  );

  // Helper function to get display name
  const getDisplayName = (userId: string): string => {
    const userInfo = userInfos[userId] as UserInfo;
    if (!userInfo) return userId;
    
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return userId;
  };

  // Create carriers map for quick lookup
  const carriersMap = useMemo(() => {
    const map = new Map<string, CarrierProfile>();
    carriers.forEach(carrier => {
      map.set(carrier.user_id, carrier);
    });
    return map;
  }, [carriers]);

  // Group messages by carrier_user_id
  const chatGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    
    // Add chat messages
    chatMessages.forEach((msg: ChatMessage) => {
      if (!groups.has(msg.carrier_user_id)) {
        groups.set(msg.carrier_user_id, []);
      }
      groups.get(msg.carrier_user_id)!.push({
        ...msg,
        type: 'carrier',
        timestamp: msg.created_at
      });
    });

    // Add admin messages
    adminMessages.forEach((msg: AdminMessage) => {
      if (!groups.has(msg.carrier_user_id)) {
        groups.set(msg.carrier_user_id, []);
      }
      groups.get(msg.carrier_user_id)!.push({
        ...msg,
        type: 'admin',
        timestamp: msg.created_at
      });
    });

    // Sort messages by timestamp within each group
    groups.forEach((messages) => {
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    return groups;
  }, [chatMessages, adminMessages]);

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    chatGroups.forEach((messages, carrierId) => {
      const unreadCount = messages.filter(m => m.type === 'carrier' && !m.is_read).length;
      if (unreadCount > 0) {
        counts.set(carrierId, unreadCount);
      }
    });
    return counts;
  }, [chatGroups]);

  // Get total unread count
  const totalUnreadCount = useMemo(() => {
    return Array.from(unreadCounts.values()).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return Array.from(chatGroups.entries());
    
    return Array.from(chatGroups.entries()).filter(([carrierId, messages]) => {
      const displayName = getDisplayName(carrierId);
      const searchLower = searchTerm.toLowerCase();
      return (
        displayName.toLowerCase().includes(searchLower) ||
        carrierId.toLowerCase().includes(searchLower) ||
        messages.some(msg => msg.message.toLowerCase().includes(searchLower))
      );
    });
  }, [chatGroups, searchTerm, getDisplayName]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Scroll to bottom when messages change or when a new message is sent
  useEffect(() => {
    if (selectedChat) {
      scrollToBottom();
    }
  }, [selectedChat, chatGroups, scrollToBottom]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Function to mark messages as read when conversation is selected
  const markMessagesAsRead = useCallback(async (carrierId: string) => {
    try {
      await fetch(`/api/admin/chat-messages/${carrierId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      // Refresh chat messages to update read status
      mutateChatMessages();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [mutateChatMessages]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedChat || !newMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingMessage(true);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier_user_id: selectedChat,
          subject: 'Admin Response',
          message: newMessage.trim()
        })
      });

      if (response.ok) {
        toast.success("Message sent successfully");
        setNewMessage("");
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        mutateAdminMessages();
        // Scroll to bottom after sending message
        setTimeout(() => scrollToBottom(), 100);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedChat, newMessage, mutateAdminMessages]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Enhanced floating animation rings */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-20 animate-ping scale-110"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-15 animate-pulse scale-105"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-10 animate-ping scale-125"></div>
          
          <Button
            onClick={() => setIsOpen(true)}
            className="floating-button relative h-16 w-16 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 hover:-translate-y-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-2 border-white/20"
            data-testid="floating-chat-button"
          >
            <MessageCircle className="h-7 w-7 text-white drop-shadow-lg" />
            {totalUnreadCount > 0 && (
              <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/30 text-white animate-bounce shadow-lg">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </div>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <Card className={`floating-console w-96 shadow-2xl transition-all duration-500 ease-out hover:shadow-3xl hover:-translate-y-1 ${isMinimized ? 'h-16' : 'h-[600px]'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" style={{ color: accentColor }} />
                <CardTitle className="text-lg">Live Chat</CardTitle>
              </div>
              {totalUnreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalUnreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 h-[500px] flex flex-col">
            {!selectedChat ? (
              // Conversations List
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {filteredConversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No conversations found</p>
                      </div>
                    ) : (
                      filteredConversations.map(([carrierId, messages]) => {
                        const displayName = getDisplayName(carrierId);
                        const latestMessage = messages[messages.length - 1];
                        const unreadCount = unreadCounts.get(carrierId) || 0;
                        
                        return (
                          <div
                            key={carrierId}
                            onClick={() => {
                              setSelectedChat(carrierId);
                              markMessagesAsRead(carrierId);
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(displayName)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">
                                  {displayName}
                                </p>
                                {unreadCount > 0 && (
                                  <Badge variant="destructive" className="text-xs h-5 px-1.5">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {carrierId}
                              </p>
                              {latestMessage && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {latestMessage.type === 'admin' ? 'You: ' : ''}
                                  {latestMessage.message}
                                </p>
                              )}
                            </div>
                            
                            {latestMessage && (
                              <div className="text-xs text-muted-foreground">
                                {formatTime(latestMessage.timestamp)}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              // Chat Interface
              <div className="flex flex-col h-full">
                {(() => {
                  const displayName = getDisplayName(selectedChat);
                  const messages = chatGroups.get(selectedChat) || [];
                  
                  return (
                    <>
                      {/* Chat Header */}
                      <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedChat(null)}
                            className="h-8 w-8 p-0"
                          >
                            ←
                          </Button>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {selectedChat}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Messages */}
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages.map((message, index) => (
                            <div
                              key={`${message.id}-${index}`}
                              className={`flex ${message.type === 'admin' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                  message.type === 'admin'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm">{message.message}</p>
                                <p className={`text-xs mt-1 ${
                                  message.type === 'admin' 
                                    ? 'text-primary-foreground/70' 
                                    : 'text-muted-foreground'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Message Input */}
                      <div className="p-4 border-t">
                        <div className="flex gap-2">
                          <Input
                            ref={inputRef}
                            value={newMessage}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            placeholder="Type your message..."
                            className="flex-1"
                            disabled={isSendingMessage}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || isSendingMessage}
                            size="sm"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
