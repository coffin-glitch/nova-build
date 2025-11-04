"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    ArrowLeft,
    MessageCircle,
    Send,
    X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface UserInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  emailAddresses?: Array<{ emailAddress: string }>;
  username?: string;
  role?: string;
}

export function CarrierFloatingChatConsole() {
  const { user, isLoaded } = useUnifiedUser();
  const { accentColor, accentBgStyle } = useAccentColor();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const groups: Record<string, { message: AdminMessage; responses: CarrierResponse[] }[]> = {};
    
    messages.forEach((message: AdminMessage) => {
      const adminId = message.admin_user_id;
      if (!groups[adminId]) {
        groups[adminId] = [];
      }
      
      const messageResponses = responses.filter((resp: CarrierResponse) => 
        resp.message_id === message.id
      );
      
      groups[adminId].push({ message, responses: messageResponses });
    });
    
    return groups;
  }, [messages, responses]);

  // Calculate unread count
  const totalUnreadCount = useMemo(() => {
    return messages.filter((msg: AdminMessage) => !msg.is_read).length;
  }, [messages]);

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
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedMessage, newMessage, isSendingMessage, mutateResponses, scrollToBottom]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/carrier/messages/${messageId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      mutateMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [mutateMessages]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((adminId: string) => {
    const adminMessages = messageGroups[adminId];
    if (adminMessages && adminMessages.length > 0) {
      const latestMessage = adminMessages[adminMessages.length - 1].message;
      setSelectedMessage(latestMessage);
      
      // Mark as read if unread
      if (!latestMessage.is_read) {
        markMessageAsRead(latestMessage.id);
      }
    }
  }, [messageGroups, markMessageAsRead]);

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

  if (!isLoaded || !user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Subtle floating animation rings */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 opacity-10 animate-ping scale-110"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 opacity-8 animate-pulse scale-105"></div>
          
          <Button
            onClick={() => setIsOpen(!isOpen)}
            className="floating-button relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 hover:from-slate-700 hover:via-slate-600 hover:to-slate-800 border border-slate-600/50 hover:border-slate-500/70 backdrop-blur-sm p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]"
            data-testid="carrier-floating-chat-button"
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

      {/* Chat Console */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Chat Console */}
          <div className="fixed bottom-6 right-6 z-50 w-80 h-[500px] animate-in slide-in-from-bottom-4 duration-500 ease-out">
            <div className="h-full bg-white/10 dark:bg-gray-900/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 border-b border-white/10 dark:border-gray-700/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin Chat</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Direct communication</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Conversations List */}
                {!selectedMessage && (
                  <div className="space-y-3">
                    <div className="text-center mb-3">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-wide uppercase">
                          Active Chats
                        </h3>
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Select a conversation
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      {Object.keys(messageGroups).length === 0 ? (
                        <div className="text-center py-8 bg-white/5 dark:bg-gray-800/20 rounded-xl border border-white/10 dark:border-gray-700/20">
                          <MessageCircle className="h-8 w-8 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No conversations yet</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Admins will appear here when they message you</p>
                        </div>
                      ) : (
                        Object.entries(messageGroups).map(([adminId, conversations]) => {
                          const latestConversation = conversations[conversations.length - 1];
                          const latestMessage = latestConversation.message;
                          const unreadCount = conversations.filter(conv => !conv.message.is_read).length;
                          const displayName = getDisplayName(adminId);
                          
                          return (
                            <div
                              key={adminId}
                              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-white/10 dark:border-gray-700/20 bg-white/5 dark:bg-gray-800/20 hover:bg-white/10 dark:hover:bg-gray-700/30 hover:shadow-lg hover:scale-[1.02] backdrop-blur-sm"
                              onClick={() => handleConversationSelect(adminId)}
                            >
                              <div className="relative">
                                <Avatar className="h-10 w-10 border-2 border-white/20 dark:border-gray-600/30 shadow-lg">
                                  <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-inner">
                                    {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {unreadCount > 0 && (
                                  <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold animate-pulse shadow-lg border-2 border-white dark:border-gray-800">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{displayName}</h4>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-white/20 dark:bg-gray-700/30 px-2 py-0.5 rounded-full">
                                    {new Date(latestMessage.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
                                  {latestMessage.subject}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Chat Messages */}
                {selectedMessage && (
                  <div className="flex flex-col h-full">
                    {/* Chat Header */}
                    <div className="p-3 border-b border-white/10 dark:border-gray-700/20 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMessage(null)}
                          className="h-7 w-7 p-0 rounded-full hover:bg-gray-500/20 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </Button>
                        <Avatar className="h-8 w-8 border-2 border-white/20 dark:border-gray-600/30 shadow-lg">
                          <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-inner">
                            {getDisplayName(selectedMessage.admin_user_id).split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{getDisplayName(selectedMessage.admin_user_id)}</h3>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Online</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3">
                      <div className="space-y-3">
                        {/* Admin Message */}
                        <div className="flex gap-2">
                          <Avatar className="h-6 w-6 border border-white/20 dark:border-gray-600/30 shadow-md">
                            <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-inner">
                              {getDisplayName(selectedMessage.admin_user_id).split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-2 border border-white/10 dark:border-gray-700/20 backdrop-blur-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-xs text-gray-900 dark:text-white">{getDisplayName(selectedMessage.admin_user_id)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(selectedMessage.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200">{selectedMessage.message}</p>
                            </div>
                          </div>
                        </div>

                        {/* Carrier Responses - Sort by creation time (oldest first) */}
                        {responses
                          .filter((response: CarrierResponse) => response.message_id === selectedMessage.id)
                          .sort((a: CarrierResponse, b: CarrierResponse) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((response: CarrierResponse) => (
                          <div key={response.id} className="flex gap-2 justify-end">
                            <div className="flex-1 max-w-[80%]">
                              <div className="rounded-lg p-2 text-sm bg-gradient-to-r from-blue-500 to-purple-600 border border-blue-400/30 shadow-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-xs text-white">You</span>
                                  <span className="text-xs text-white/70">
                                    {new Date(response.created_at).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-white text-sm">{response.response}</p>
                              </div>
                            </div>
                            <Avatar className="h-6 w-6 border border-white/20 dark:border-gray-600/30 shadow-md">
                              <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-inner">
                                {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress?.[0] || 'C'}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    {/* Message Input */}
                    <div className="p-3 border-t border-white/10 dark:border-gray-700/20 bg-gradient-to-r from-white/5 to-gray-100/5 dark:from-gray-800/10 dark:to-gray-700/10">
                      <div className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                          placeholder="Type your message..."
                          className="flex-1 bg-white/20 dark:bg-gray-800/30 border-white/20 dark:border-gray-600/30 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-400/50 rounded-lg px-3 py-2 text-sm backdrop-blur-sm"
                          disabled={isSendingMessage}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={isSendingMessage || !newMessage.trim()}
                          size="sm"
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3 py-2 rounded-lg shadow-lg"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
