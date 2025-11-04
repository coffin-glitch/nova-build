"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { cn } from "@/lib/utils";
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

export default function FloatingAdminMessagesButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 }); // Safe default for SSR
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const { isAdmin } = useUnifiedRole();
  
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Chat functionality state
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    }
  }, []);

  // Fetch data
  const { data: chatMessagesData, mutate: mutateChatMessages } = useSWR(
    isAdmin ? "/api/admin/all-chat-messages" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: adminMessagesData, mutate: mutateAdminMessages } = useSWR(
    isAdmin ? "/api/admin/all-messages" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: carriersData } = useSWR(
    isAdmin ? "/api/admin/carriers" : null,
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

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStartTime(Date.now());
    const rect = buttonRef.current!.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 48; // 48px for button width
    const maxY = window.innerHeight - 48; // 48px for button height
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleButtonClick = () => {
    const dragDuration = Date.now() - dragStartTime;
    // Only open messages if not dragging and enough time has passed since drag start
    if (!isDragging && dragDuration > 100) {
      setIsOpen(!isOpen);
    }
  };

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
      
      .floating-admin-button {
        animation: float 4s ease-in-out infinite, pulse-glow 3s ease-in-out infinite;
      }
      
      .floating-admin-console {
        animation: float-gentle 6s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Floating Admin Messages Button */}
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        <div
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "relative cursor-move select-none",
            isDragging && "cursor-grabbing"
          )}
        >
          <div className="relative">
            {/* Subtle floating animation rings */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 opacity-10 animate-ping scale-110"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 opacity-8 animate-pulse scale-105"></div>
            
            <Button
              onClick={handleButtonClick}
              className={cn(
                "floating-admin-button relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 hover:from-slate-700 hover:via-slate-600 hover:to-slate-800 border border-slate-600/50 hover:border-slate-500/70 backdrop-blur-sm p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]",
                "cursor-move select-none",
                isDragging && "scale-105 cursor-grabbing",
                isOpen && "scale-0 opacity-0"
              )}
              style={{ userSelect: 'none' }}
            >
              <MessageCircle className="h-5 w-5 text-slate-100 drop-shadow-sm" />
              {totalUnreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse shadow-md border-2 border-slate-900">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Console */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Chat Console */}
          <div 
            className="fixed z-50 w-96 h-[600px] animate-in slide-in-from-bottom-4 duration-500 ease-out floating-admin-console"
            style={{
              left: Math.min(position.x, window.innerWidth - 384), // 384px for console width
              top: Math.min(position.y - 620, window.innerHeight - 620), // 620px for console height
            }}
          >
            <Card className="h-full shadow-2xl transition-all duration-500 ease-out hover:shadow-3xl hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
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
                                  className="bg-blue-600 hover:bg-blue-700"
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
        </>
      )}
    </>
  );
}
