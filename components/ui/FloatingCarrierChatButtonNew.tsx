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

interface Conversation {
  conversation_id: string;
  admin_user_id: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_message: string;
  last_message_sender_type: 'admin' | 'carrier';
}

interface Message {
  id: string;
  sender_id: string;
  sender_type: 'admin' | 'carrier';
  message: string;
  created_at: string;
  updated_at: string;
  is_read: boolean;
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
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    }
  }, []);

  // Fetch conversations
  const { data: conversationsData, mutate: mutateConversations } = useSWR(
    user ? "/api/carrier/conversations" : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Fetch messages for selected conversation
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    selectedConversation ? `/api/carrier/conversations/${selectedConversation.conversation_id}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  const conversations = conversationsData?.data || [];
  const messages = messagesData?.data || [];

  // Get unique admin user IDs
  const adminUserIds = useMemo(() => {
    return Array.from(new Set(conversations.map((conv: Conversation) => conv.admin_user_id)));
  }, [conversations]);

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

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((total: number, conv: Conversation) => total + conv.unread_count, 0);
  }, [conversations]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    
    return conversations.filter((conv: Conversation) => {
      const displayName = getDisplayName(conv.admin_user_id);
      const searchLower = searchTerm.toLowerCase();
      return (
        displayName.toLowerCase().includes(searchLower) ||
        conv.admin_user_id.toLowerCase().includes(searchLower) ||
        conv.last_message.toLowerCase().includes(searchLower)
      );
    });
  }, [conversations, searchTerm, getDisplayName]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (isOpen && selectedConversation) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, selectedConversation, scrollToBottom]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!selectedConversation || !newMessage.trim() || isSendingMessage) return;

    setIsSendingMessage(true);

    try {
      const response = await fetch(`/api/carrier/conversations/${selectedConversation.conversation_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() })
      });

      if (response.ok) {
        setNewMessage("");
        mutateMessages();
        mutateConversations();
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
  }, [selectedConversation, newMessage, isSendingMessage, mutateMessages, mutateConversations, scrollToBottom]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Mark conversation as read
  const markConversationAsRead = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/carrier/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      mutateConversations();
      mutateMessages();
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [mutateConversations, mutateMessages]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark conversation as read if there are unread messages
    if (conversation.unread_count > 0) {
      markConversationAsRead(conversation.conversation_id);
    }
  }, [markConversationAsRead]);

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
            className="fixed z-50 w-[420px] h-[600px] animate-in slide-in-from-bottom-4 duration-500 ease-out floating-carrier-chat-console"
            style={{
              left: Math.min(position.x, window.innerWidth - 420),
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
                  {!selectedConversation ? (
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
                            filteredConversations.map((conversation: Conversation) => {
                              const displayName = getDisplayName(conversation.admin_user_id);
                              
                              return (
                                <div
                                  key={conversation.conversation_id}
                                  onClick={() => handleConversationSelect(conversation)}
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
                                      {conversation.unread_count > 0 && (
                                        <Badge variant="destructive" className="text-xs h-5 px-1.5">
                                          {conversation.unread_count}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {conversation.admin_user_id}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate mt-1">
                                      {conversation.last_message_sender_type === 'carrier' ? 'You: ' : ''}
                                      {conversation.last_message}
                                    </p>
                                  </div>
                                  
                                  <div className="text-xs text-muted-foreground">
                                    {formatTime(conversation.last_message_at)}
                                  </div>
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
                        const displayName = getDisplayName(selectedConversation.admin_user_id);
                        
                        return (
                          <>
                            {/* Chat Header */}
                            <div className="p-4 border-b flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedConversation(null)}
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
                                    {selectedConversation.admin_user_id}
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
                                {messages.map((message: Message) => (
                                  <div
                                    key={message.id}
                                    className={`flex ${message.sender_type === 'carrier' ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                        message.sender_type === 'carrier'
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted'
                                      }`}
                                    >
                                      <p className="text-sm">{message.message}</p>
                                      <p className={`text-xs mt-1 ${
                                        message.sender_type === 'carrier' 
                                          ? 'text-primary-foreground/70' 
                                          : 'text-muted-foreground'
                                      }`}>
                                        {formatTime(message.created_at)}
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
                                  onChange={(e) => setNewMessage(e.target.value)}
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
