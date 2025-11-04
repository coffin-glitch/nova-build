"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccentColor } from "@/hooks/useAccentColor";
import {
    Clock,
    MessageSquare,
    Search,
    Send,
    User,
    Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface UserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  emailAddresses: any[];
  username: string | null;
  role: string;
}

interface ChatMessage {
  id: string;
  carrier_user_id: string;
  message: string;
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

export function AdminMessagesClient() {
  const { accentColor } = useAccentColor();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: chatMessagesData, mutate: mutateChatMessages } = useSWR(
    "/api/admin/all-chat-messages",
    fetcher,
    { refreshInterval: 30000 } // Increased to prevent rate limiting // Increased from 2000 to reduce re-renders
  );

  const { data: adminMessagesData, mutate: mutateAdminMessages } = useSWR(
    "/api/admin/all-messages",
    fetcher,
    { refreshInterval: 30000 } // Increased to prevent rate limiting // Increased from 2000 to reduce re-renders
  );

  const chatMessages = chatMessagesData?.data || [];
  const adminMessages = adminMessagesData?.data || [];

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

  // Memoize chat groups to prevent unnecessary recalculations
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

  // Simplified approach - no auto-scroll to prevent focus issues
  // Users can manually scroll to see new messages

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Removed problematic focus restoration useEffect that was causing focus loss

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
        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        mutateAdminMessages();
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
    console.log('Input onChange:', e.target.value);
    setNewMessage(e.target.value);
    
    // Debounced typing state to prevent excessive updates
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000); // Stop typing after 1 second of inactivity
  }, []);

  const handleInputFocus = useCallback(() => {
    console.log('Input focused');
    setIsInputFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    console.log('Input blurred');
    setIsInputFocused(false);
    setIsTyping(false);
    // Clear typing timeout on blur
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  const ChatCard = ({ carrierUserId, messages }: { carrierUserId: string, messages: any[] }) => {
    const latestMessage = messages[messages.length - 1];
    const unreadCount = messages.filter(m => m.type === 'carrier').length;
    const isSelected = selectedChat === carrierUserId;
    
    return (
      <Card 
        className={`hover:shadow-lg transition-all duration-200 cursor-pointer ${
          isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
        }`} 
        onClick={() => setSelectedChat(carrierUserId)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <CardTitle className="text-lg">{getDisplayName(carrierUserId)}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="default" className="bg-red-100 text-red-800">
                  {unreadCount} new
                </Badge>
              )}
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Live Chat
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Latest Message Preview */}
          <div className="text-sm text-muted-foreground">
            <div className="line-clamp-2">
              <strong>{latestMessage.type === 'carrier' ? 'Carrier' : 'Admin'}:</strong> {latestMessage.message}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(latestMessage.timestamp).toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {messages.length} messages
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ChatInterface = () => {
    if (!selectedChat) {
      return (
        <Card className="h-[600px] flex items-center justify-center">
          <CardContent className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Conversation</h3>
            <p className="text-muted-foreground">
              Choose a conversation from the list to start chatting.
            </p>
          </CardContent>
        </Card>
      );
    }

    const messages = chatGroups.get(selectedChat) || [];
    const unreadCount = messages.filter(m => m.type === 'carrier').length;

    return (
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle className="text-lg">{getDisplayName(selectedChat)}</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="default" className="bg-red-100 text-red-800">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedChat(null)}
            >
              Close Chat
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Welcome Message */}
              <div className="flex flex-col items-start">
                <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                  <div className="font-semibold text-xs mb-1">Admin</div>
                  <div>Welcome to NOVA! How can we help you today?</div>
                  <div className="text-xs opacity-70 mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {msg.type === 'carrier' ? (
                    // Carrier Message
                    <div className="flex flex-col items-end">
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-slate-500 text-white">
                        <div className="font-semibold text-xs mb-1">Carrier</div>
                        <div>{msg.message}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Admin Message
                    <div className="flex flex-col items-start">
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                        <div className="font-semibold text-xs mb-1">Admin</div>
                        <div>{msg.message}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )}
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
                style={{ backgroundColor: accentColor }}
              >
                {isSendingMessage ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Filter chat groups based on search
  const filteredChatGroups = Array.from(chatGroups.entries()).filter(([carrierUserId, messages]) => {
    const displayName = getDisplayName(carrierUserId);
    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           carrierUserId.toLowerCase().includes(searchTerm.toLowerCase()) ||
           messages.some(msg => msg.message.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations by user or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-muted-foreground">
            {filteredChatGroups.length} active conversations
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{chatGroups.size}</div>
                <div className="text-sm text-muted-foreground">Active Chats</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">
                  {Array.from(chatGroups.values()).reduce((total, messages) => 
                    total + messages.filter(m => m.type === 'carrier').length, 0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Unread Messages</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  {Array.from(chatGroups.values()).reduce((total, messages) => total + messages.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{chatGroups.size}</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            Conversations ({filteredChatGroups.length})
          </h3>
          
          {filteredChatGroups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Conversations Found</h3>
                <p className="text-muted-foreground">
                  No conversations match your search criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredChatGroups.map(([carrierUserId, messages]) => (
                <ChatCard key={carrierUserId} carrierUserId={carrierUserId} messages={messages} />
              ))}
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}