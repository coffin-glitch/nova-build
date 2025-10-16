"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClerkRole } from "@/lib/clerk-roles";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import {
    ArrowLeft,
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
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  emailAddresses?: Array<{ emailAddress: string }>;
  username?: string;
  role?: string;
}

export default function FloatingCarrierChatButton() {
  const { user, isLoaded } = useUser();
  const { isCarrier } = useClerkRole();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Chat functionality state
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
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

  // Fetch admin messages
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    user ? "/api/carrier/messages" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Fetch carrier responses
  const { data: responsesData, mutate: mutateResponses } = useSWR(
    user ? "/api/carrier/messages/responses" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const messages = messagesData?.data || [];
  const responses = responsesData?.data || [];

  // Get unique admin user IDs
  const adminUserIds = useMemo(() => {
    return Array.from(new Set(messages.map((msg: AdminMessage) => msg.admin_user_id)));
  }, [messages]);

  // Fetch admin user information
  const { data: userInfos = {} } = useSWR(
    adminUserIds.length > 0 ? `/api/users/batch?ids=${adminUserIds.join(',')}` : null,
    fetcher
  );

  // Helper function to get display name
  const getDisplayName = useCallback((userId: string): string => {
    const userInfo = userInfos[userId] as UserInfo;
    if (!userInfo) return "Admin";
    
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return "Admin";
  }, [userInfos]);

  // Group messages by admin
  const messageGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    
    // Add admin messages
    messages.forEach((message: AdminMessage) => {
      if (!groups.has(message.admin_user_id)) {
        groups.set(message.admin_user_id, []);
      }
      groups.get(message.admin_user_id)!.push({
        ...message,
        type: 'admin',
        timestamp: message.created_at
      });
    });

    // Add carrier responses
    responses.forEach((response: CarrierResponse) => {
      const adminId = messages.find(msg => msg.id === response.message_id)?.admin_user_id;
      if (adminId) {
        if (!groups.has(adminId)) {
          groups.set(adminId, []);
        }
        groups.get(adminId)!.push({
          ...response,
          type: 'carrier',
          message: response.response,
          timestamp: response.created_at
        });
      }
    });

    // Sort messages by timestamp within each group
    groups.forEach((messages) => {
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    return groups;
  }, [messages, responses]);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    // Count unread admin messages
    const unreadAdminMessages = messages.filter((msg: AdminMessage) => !msg.is_read).length;
    // Count unread carrier responses (responses that haven't been read by admin)
    const unreadCarrierResponses = responses.filter((response: CarrierResponse) => !response.is_read).length;
    return unreadAdminMessages + unreadCarrierResponses;
  }, [messages, responses]);

  // Calculate unread counts per admin
  const unreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    messageGroups.forEach((messages, adminId) => {
      const unreadAdminMessages = messages.filter(m => m.type === 'admin' && !m.is_read).length;
      const unreadCarrierResponses = messages.filter(m => m.type === 'carrier' && !m.is_read).length;
      const totalUnread = unreadAdminMessages + unreadCarrierResponses;
      if (totalUnread > 0) {
        counts.set(adminId, totalUnread);
      }
    });
    return counts;
  }, [messageGroups]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return Array.from(messageGroups.entries());
    
    return Array.from(messageGroups.entries()).filter(([adminId, messages]) => {
      const displayName = getDisplayName(adminId);
      const searchLower = searchTerm.toLowerCase();
      return (
        displayName.toLowerCase().includes(searchLower) ||
        adminId.toLowerCase().includes(searchLower) ||
        messages.some(msg => msg.message.toLowerCase().includes(searchLower))
      );
    });
  }, [messageGroups, searchTerm, getDisplayName]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (isOpen && selectedMessage) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, responses, isOpen, selectedMessage, scrollToBottom]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handle input change with debounced typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    
    if (!isTyping && value.trim()) {
      setIsTyping(true);
    }
  }, [isTyping]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!selectedMessage || !newMessage.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);

    try {
      const response = await fetch('/api/carrier/messages/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: selectedMessage.id,
          response: newMessage.trim()
        })
      });

      if (response.ok) {
        setNewMessage("");
        mutateResponses();
        setTimeout(scrollToBottom, 100);
        toast.success("Message sent successfully!");
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedMessage, newMessage, isSendingMessage, mutateResponses, scrollToBottom]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string, messageType: 'admin' | 'carrier') => {
    try {
      const endpoint = messageType === 'admin' 
        ? `/api/carrier/messages/${messageId}/read`
        : `/api/carrier/messages/responses/${messageId}/read`;
      
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Refresh both data sources
      mutateMessages();
      mutateResponses();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [mutateMessages, mutateResponses]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((adminId: string) => {
    const adminMessages = messageGroups.get(adminId);
    if (adminMessages && adminMessages.length > 0) {
      const latestMessage = adminMessages.find(m => m.type === 'admin');
      if (latestMessage) {
        setSelectedMessage(latestMessage);
        
        // Mark all unread messages in this conversation as read
        adminMessages.forEach(message => {
          if (!message.is_read) {
            markMessageAsRead(message.id, message.type);
          }
        });
      }
    }
  }, [messageGroups, markMessageAsRead]);

  // Helper functions
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
    const maxX = window.innerWidth - 48;
    const maxY = window.innerHeight - 48;
    
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
    // Only open messages if not dragging
    if (!isDragging && dragDuration < 200) {
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
      
      .floating-carrier-chat-button {
        animation: float 4s ease-in-out infinite, pulse-glow 3s ease-in-out infinite;
      }
      
      .floating-carrier-chat-console {
        animation: float-gentle 6s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!isLoaded || !user || !isCarrier) return null;

  return (
    <>
      {/* Floating Chat Button */}
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
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 opacity-10 animate-ping scale-110"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 opacity-8 animate-pulse scale-105"></div>
            
            <Button
              onClick={handleButtonClick}
              className={cn(
                "floating-carrier-chat-button relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 border border-blue-500/50 hover:border-blue-600/70 backdrop-blur-sm p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]",
                "cursor-move select-none",
                isDragging && "scale-105 cursor-grabbing",
                isOpen && "scale-0 opacity-0"
              )}
              style={{ userSelect: 'none' }}
              data-testid="carrier-chat-button"
            >
              <MessageCircle className="h-5 w-5 text-white drop-shadow-sm" />
              {totalUnreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse shadow-md border-2 border-blue-900">
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
            className="fixed z-50 w-96 h-[600px] animate-in slide-in-from-bottom-4 duration-500 ease-out floating-carrier-chat-console"
            style={{
              left: Math.min(position.x, window.innerWidth - 384),
              top: Math.min(position.y - 620, window.innerHeight - 620),
            }}
          >
            <Card className="h-full shadow-2xl transition-all duration-500 ease-out hover:shadow-3xl hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">Admin Chat</CardTitle>
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
                  {!selectedMessage ? (
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
                            filteredConversations.map(([adminId, messages]) => {
                              const displayName = getDisplayName(adminId);
                              const latestMessage = messages[messages.length - 1];
                              const unreadCount = unreadCounts.get(adminId) || 0;
                              
                              return (
                                <div
                                  key={adminId}
                                  onClick={() => handleConversationSelect(adminId)}
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
                                      {adminId}
                                    </p>
                                    {latestMessage && (
                                      <p className="text-xs text-muted-foreground truncate mt-1">
                                        {latestMessage.type === 'carrier' ? 'You: ' : ''}
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
                        const displayName = getDisplayName(selectedMessage.admin_user_id);
                        const messages = messageGroups.get(selectedMessage.admin_user_id) || [];
                        
                        return (
                          <>
                            {/* Chat Header */}
                            <div className="p-4 border-b flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedMessage(null)}
                                  className="h-8 w-8 p-0"
                                >
                                  <ArrowLeft className="h-4 w-4" />
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
                                    {selectedMessage.admin_user_id}
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
                                    className={`flex ${message.type === 'carrier' ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                        message.type === 'carrier'
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted'
                                      }`}
                                    >
                                      <p className="text-sm">{message.message}</p>
                                      <p className={`text-xs mt-1 ${
                                        message.type === 'carrier' 
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
