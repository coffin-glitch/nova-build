"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { cn } from "@/lib/utils";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    ArrowLeft,
    FileText,
    Mail,
    Maximize2,
    MessageCircle,
    Minimize2,
    MoreVertical,
    Paperclip,
    Phone,
    Search,
    Send,
    User,
    Users,
    X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useRealtimeConversations } from "@/hooks/useRealtimeConversations";
import { useRealtimeConversationMessages } from "@/hooks/useRealtimeConversationMessages";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { ChatMessageItem, type ChatMessage } from "@/components/chat/ChatMessageItem";
import { useChatScroll } from "@/hooks/use-chat-scroll";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  // Handle API response structure: { ok: true, data: [...] } or { error: "..." }
  if (data.ok && data.data) {
    return data.data;
  }
  if (data.error) {
    console.error(`[FloatingCarrierChat] API error for ${url}:`, data.error);
    return [];
  }
  // Fallback: return data directly if it's already an array or object
  return data.data || data || [];
};

interface Conversation {
  conversation_id: string;
  admin_user_id: string;
  admin_display_name?: string;
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
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_size?: number;
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
  const { user, isLoaded } = useUnifiedUser();
  const { isCarrier, isAdmin, role, isLoading: roleLoading } = useUnifiedRole();
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    { refreshInterval: 0 } // Disable polling - using Realtime instead
  );

  // Fetch messages for selected conversation
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    selectedConversation ? `/api/carrier/conversations/${selectedConversation.conversation_id}` : null,
    fetcher,
    { refreshInterval: 0 } // Disable polling - using Realtime instead
  );

  // Fetcher already unwraps the data, so use directly
  const conversations = Array.isArray(conversationsData) ? conversationsData : (conversationsData?.data || []);

  // Use the reusable chat scroll hook
  const { containerRef: messagesContainerRef, scrollToBottom } = useChatScroll();
  
  // Keep messagesEndRef for backward compatibility (if needed elsewhere)
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time conversation updates
  useRealtimeConversations({
    enabled: !!user?.id,
    userId: user?.id,
    onInsert: () => {
      console.log('[FloatingCarrierChat] New conversation created, refreshing...');
      mutateConversations();
    },
    onUpdate: () => {
      console.log('[FloatingCarrierChat] Conversation updated, refreshing...');
      mutateConversations();
    },
  });

  // Subscribe to real-time message updates for selected conversation (postgres_changes for persistence)
  useRealtimeConversationMessages({
    enabled: !!selectedConversation?.conversation_id,
    conversationId: selectedConversation?.conversation_id,
    onInsert: (payload?: any) => {
      console.log('[FloatingCarrierChat] New message received via postgres_changes, refreshing...', payload);
      
      // If we have a new message from postgres_changes, update the messages list
      if (payload?.new) {
        const newMessage: Message = {
          id: payload.new.id,
          sender_id: payload.new.supabase_sender_id,
          sender_type: payload.new.sender_type,
          message: payload.new.message,
          created_at: payload.new.created_at,
          updated_at: payload.new.updated_at || payload.new.created_at,
          attachment_url: payload.new.attachment_url,
          attachment_type: payload.new.attachment_type,
          attachment_name: payload.new.attachment_name,
          attachment_size: payload.new.attachment_size,
          is_read: payload.new.is_read || false,
        };
        
        // Add or replace the message (replace if it's an optimistic update)
        mutateMessages((current: any[] = []) => {
          // Remove any optimistic message with matching content from same sender
          const filtered = current.filter((msg: any) => 
            !(msg.id.startsWith('temp-') && 
              msg.message === newMessage.message && 
              msg.sender_id === newMessage.sender_id &&
              Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000)
          );
          
          // Check if message already exists
          if (filtered.some((msg: any) => msg.id === newMessage.id)) {
            return filtered;
          }
          
          // Add the new message and sort
          return [...filtered, newMessage].sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }, false);
      } else {
        // Fallback: revalidate if no payload data
        mutateMessages();
      }
      
      setTimeout(scrollToBottom, 100);
    },
    onUpdate: (payload?: any) => {
      console.log('[FloatingCarrierChat] Message updated via postgres_changes, refreshing...', payload);
      // Force revalidation to get the latest messages
      mutateMessages();
    },
  });

  // Subscribe to Broadcast for instant message delivery
  // Note: username will be updated after getDisplayName is defined
  const { sendBroadcast } = useRealtimeChat({
    roomName: selectedConversation?.conversation_id || '',
    userId: user?.id,
    username: user?.email || 'Carrier',
    enabled: !!selectedConversation?.conversation_id,
    onBroadcast: (broadcastMessage) => {
      // Show broadcast messages from other users for instant delivery
      // Our own messages are handled via optimistic updates
      if (broadcastMessage.user.id !== user?.id) {
        console.log('[FloatingCarrierChat] Broadcast message received from other user:', broadcastMessage);
        // Convert broadcast message to Message format
        const convertedMessage: Message = {
          id: broadcastMessage.id,
          sender_id: broadcastMessage.user.id,
          sender_type: 'admin', // Will be updated by postgres_changes when real message arrives
          message: broadcastMessage.content,
          created_at: broadcastMessage.createdAt,
          updated_at: broadcastMessage.createdAt,
          attachment_url: broadcastMessage.attachment_url,
          attachment_type: broadcastMessage.attachment_type,
          attachment_name: broadcastMessage.attachment_name,
          is_read: false,
        };
        // Add to messages immediately for instant display
        mutateMessages((current: any[] = []) => {
          // Check if message already exists (avoid duplicates by checking content + sender + time)
          const exists = current.some((msg: any) => 
            msg.id === convertedMessage.id || 
            (msg.message === convertedMessage.message && 
             msg.sender_id === convertedMessage.sender_id &&
             Math.abs(new Date(msg.created_at).getTime() - new Date(convertedMessage.created_at).getTime()) < 2000)
          );
          if (exists) {
            return current;
          }
          const updated = [...current, convertedMessage].sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return updated;
        }, false);
        setTimeout(scrollToBottom, 50);
      }
    },
  });
  const messages = Array.isArray(messagesData) ? messagesData : (messagesData?.data || []);

  // Get unique admin user IDs from conversations, plus the selected conversation's admin if any
  const adminUserIds = useMemo(() => {
    const ids = new Set<string>();
    // Add all admin IDs from conversations
    conversations.forEach((conv: Conversation) => {
      if (conv.admin_user_id) {
        ids.add(conv.admin_user_id);
      }
    });
    // Also add the selected conversation's admin ID if it exists
    if (selectedConversation?.admin_user_id) {
      ids.add(selectedConversation.admin_user_id);
    }
    return Array.from(ids);
  }, [conversations, selectedConversation]);

  // Fetch admin user information
  const { data: userInfosData, isLoading: isLoadingUserInfos, error: userInfosError } = useSWR(
    adminUserIds.length > 0 ? `/api/users/batch?ids=${adminUserIds.join(',')}` : null,
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Batch API returns the object directly, not wrapped in { ok: true, data: {...} }
        if (data.error) {
          console.error(`[FloatingCarrierChat] API error for ${url}:`, data.error);
          return {};
        }
        // Return data directly (it's already an object with user IDs as keys)
        console.log('[FloatingCarrierChat] UserInfos loaded:', data);
        return data || {};
      } catch (error) {
        console.error(`[FloatingCarrierChat] Error fetching user infos from ${url}:`, error);
        return {};
      }
    }
  );
  
  const userInfos = userInfosData || {};

  // Fallback: Fetch specific admin info when popover opens if not already loaded
  const selectedAdminId = selectedConversation?.admin_user_id;
  const { data: fallbackAdminInfo } = useSWR(
    isProfilePopoverOpen && selectedAdminId && !userInfos[selectedAdminId]
      ? `/api/users/${selectedAdminId}`
      : null,
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('[FloatingCarrierChat] Fallback admin info loaded:', data);
        return data;
      } catch (error) {
        console.error(`[FloatingCarrierChat] Error fetching fallback admin info from ${url}:`, error);
        return null;
      }
    }
  );

  // Merge fallback data into userInfos if available
  const mergedUserInfos = useMemo(() => {
    const merged = { ...userInfos };
    if (selectedAdminId && fallbackAdminInfo && !merged[selectedAdminId]) {
      merged[selectedAdminId] = fallbackAdminInfo;
    }
    return merged;
  }, [userInfos, fallbackAdminInfo, selectedAdminId]);

  // Helper function to get display name
  // Priority: admin_display_name from API > batch API > fallback
  const getDisplayName = useCallback((userId: string, adminDisplayName?: string): string => {
    // First check if admin_display_name is provided from the API
    if (adminDisplayName) return adminDisplayName;
    
    // Fallback to merged user infos (includes batch + fallback data)
    const userInfo = mergedUserInfos[userId] as UserInfo;
    if (!userInfo) return "Admin";
    
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return "Admin";
  }, [mergedUserInfos]);

  // Convert Message to ChatMessage format
  const convertToChatMessage = useCallback((msg: Message): ChatMessage => {
    return {
      id: msg.id,
      content: msg.message || '',
      user: {
        id: msg.sender_id,
        name: msg.sender_type === 'carrier' 
          ? (user?.email || 'Carrier')
          : getDisplayName(msg.sender_id),
      },
      createdAt: msg.created_at,
      attachment_url: msg.attachment_url,
      attachment_type: msg.attachment_type,
      attachment_name: msg.attachment_name,
    };
  }, [getDisplayName, user?.email]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    
    return conversations.filter((conv: Conversation) => {
      const displayName = getDisplayName(conv.admin_user_id, conv.admin_display_name);
      const searchLower = searchTerm.toLowerCase();
      return (
        displayName.toLowerCase().includes(searchLower) ||
        conv.admin_user_id.toLowerCase().includes(searchLower) ||
        (conv.last_message && conv.last_message.toLowerCase().includes(searchLower))
      );
    });
  }, [conversations, searchTerm, getDisplayName]);

  // Fetch all available admins for "Start New Chat"
  const { data: adminsData } = useSWR(
    user ? "/api/carrier/admins" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Get admins without existing conversations
  const adminsWithoutChats = useMemo(() => {
    const admins = Array.isArray(adminsData) ? adminsData : (adminsData?.data || []);
    const existingAdminIds = new Set(conversations.map((conv: Conversation) => conv.admin_user_id));
    return admins.filter((admin: any) => {
      const adminId = admin.user_id || admin.supabase_user_id;
      return adminId && !existingAdminIds.has(adminId);
    });
  }, [adminsData, conversations]);

  // Debug logging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    if (conversationsData !== undefined) {
      console.log('[FloatingCarrierChat] Conversations data:', {
        raw: conversationsData,
        processed: conversations,
        count: conversations.length,
        filteredCount: filteredConversations.length,
        searchTerm,
        sample: conversations[0],
        isArray: Array.isArray(conversationsData),
        hasData: conversationsData?.data !== undefined,
        apiUrl: '/api/carrier/conversations'
      });
    }
    if (messagesData !== undefined && selectedConversation) {
      console.log('[FloatingCarrierChat] Messages data:', {
        conversationId: selectedConversation.conversation_id,
        raw: messagesData,
        processed: messages,
        count: messages.length,
        isArray: Array.isArray(messagesData),
        hasData: messagesData?.data !== undefined,
        apiUrl: `/api/carrier/conversations/${selectedConversation.conversation_id}`
      });
    }
  }, [conversationsData, messagesData, conversations, messages, selectedConversation, filteredConversations, searchTerm]);

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((total: number, conv: Conversation) => total + conv.unread_count, 0);
  }, [conversations]);

  // NOTE: scrollToBottom is defined earlier (before useRealtimeConversationMessages) to prevent TDZ error

  // Auto-scroll when messages change
  useEffect(() => {
    if (isOpen && selectedConversation) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, selectedConversation, scrollToBottom]);

  // Handle send message with optimistic updates
  const handleSendMessage = useCallback(async () => {
    if (!selectedConversation || (!newMessage.trim() && !selectedFile) || isSendingMessage) return;

    const messageText = newMessage.trim();
    const tempMessageId = `temp-${Date.now()}`;
    
    // Optimistic update: Add message to UI immediately
    const optimisticMessage = {
      id: tempMessageId,
      conversation_id: selectedConversation.conversation_id,
      sender_id: user?.id || '',
      sender_type: 'carrier',
      message: messageText,
      created_at: new Date().toISOString(),
      attachment_url: null,
      attachment_type: selectedFile?.type || null,
      attachment_name: selectedFile?.name || null,
      attachment_size: selectedFile?.size || null,
      is_read: false,
    };

    // Optimistically update messages
    mutateMessages((current: any[] = []) => {
      return [...current, optimisticMessage];
    }, false); // false = don't revalidate yet

    // Send via Broadcast for instant delivery to other users
    if (sendBroadcast) {
      const displayName = getDisplayName(user?.id || '', false);
      sendBroadcast({
        content: messageText,
        user: {
          id: user?.id || '',
          name: displayName,
        },
        attachment_url: null, // Files will be sent via API
        attachment_type: selectedFile?.type,
        attachment_name: selectedFile?.name,
      });
    }

    setIsSendingMessage(true);
    setNewMessage("");
    const fileToSend = selectedFile;
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTimeout(scrollToBottom, 100);

    try {
      let response;
      
      if (fileToSend) {
        // Send file with optional message
        const formData = new FormData();
        if (messageText) {
          formData.append('message', messageText);
        }
        formData.append('file', fileToSend);

        response = await fetch(`/api/carrier/conversations/${selectedConversation.conversation_id}`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Send text-only message
        response = await fetch(`/api/carrier/conversations/${selectedConversation.conversation_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText })
        });
      }

      if (response.ok) {
        // Keep the optimistic message - postgres_changes will replace it with the real one
        // This prevents the message from disappearing temporarily
        // The handleMessageInsert callback will replace the temp message with the real one
        
        // Trigger revalidation after a short delay to let the database commit
        setTimeout(() => {
          mutateMessages(); // Revalidate to get real message from database
          mutateConversations(); // Refresh conversations list
        }, 300);
        
        setTimeout(scrollToBottom, 200);
        toast.success("Message sent successfully!");
      } else {
        // Revert optimistic update on error
        mutateMessages((current: any[] = []) => {
          return current.filter((msg: any) => msg.id !== tempMessageId);
        }, false);
        
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || "Failed to send message. Please try again.");
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversation, newMessage, selectedFile, isSendingMessage, user?.id, mutateMessages, mutateConversations, scrollToBottom, sendBroadcast, getDisplayName]);

  // Handle start new chat
  const handleStartNewChat = useCallback(async (adminId: string, adminDisplayName: string) => {
    try {
      const response = await fetch('/api/carrier/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_user_id: adminId,
          message: 'Hello! I\'m starting a new conversation with you.',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`New chat started with ${adminDisplayName}!`);
        setShowNewChat(false);
        mutateConversations();
        // Select the new conversation if returned
        if (data.conversation) {
          setSelectedConversation(data.conversation);
        } else {
          // Refresh and find the new conversation
          setTimeout(() => {
            mutateConversations();
          }, 500);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create new chat' }));
        throw new Error(errorData.error || 'Failed to create new chat');
      }
    } catch (error: any) {
      console.error('Error starting new chat:', error);
      toast.error(error.message || 'Failed to start new chat. Please try again.');
    }
  }, [mutateConversations]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size exceeds 10MB limit');
        return;
      }
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and PDF are allowed');
        return;
      }
      setSelectedFile(file);
    }
  }, []);

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

  // CRITICAL: Only show for carriers, not admins
  // isCarrier is true for both carriers AND admins, so we need to check role explicitly
  // Don't render until user and role are loaded - prevents both buttons from showing
  if (!isLoaded || !user || roleLoading || !isCarrier || isAdmin || role !== "carrier") return null;

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
                            id="carrier-chat-search"
                            name="carrier-chat-search"
                            placeholder="Search conversations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      <ScrollArea className="flex-1">
                        <div className="p-2">
                          {showNewChat ? (
                            // Start New Chat Section
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 border-b">
                                <h3 className="text-sm font-semibold">Start New Chat</h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowNewChat(false)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              {adminsWithoutChats.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p>No admins available</p>
                                  <p className="text-xs mt-2">All admins already have active conversations</p>
                                </div>
                              ) : (
                                adminsWithoutChats.map((admin: any) => {
                                  const adminId = admin.user_id || admin.supabase_user_id;
                                  const adminDisplayName = admin.display_name || "Admin";
                                  return (
                                    <div
                                      key={adminId}
                                      onClick={() => handleStartNewChat(adminId, adminDisplayName)}
                                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                      <Avatar className="h-10 w-10">
                                        <AvatarImage src={undefined} />
                                        <AvatarFallback className="text-xs">
                                          {getInitials(adminDisplayName)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                          {adminDisplayName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          Click to start chatting
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          ) : (
                            <>
                              {conversations.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p>No conversations yet</p>
                                  <p className="text-xs mt-2">Start a conversation to begin chatting</p>
                                  {adminsWithoutChats.length > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowNewChat(true)}
                                      className="mt-4"
                                    >
                                      <Users className="h-4 w-4 mr-2" />
                                      Start New Chat
                                    </Button>
                                  )}
                                </div>
                              ) : filteredConversations.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p>No conversations match your search</p>
                                  <p className="text-xs mt-2">Try a different search term</p>
                                </div>
                              ) : (
                                <>
                                  {adminsWithoutChats.length > 0 && (
                                    <div className="mb-2 p-2 border-b">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowNewChat(true)}
                                        className="w-full"
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        Start New Chat ({adminsWithoutChats.length})
                                      </Button>
                                    </div>
                                  )}
                                  {filteredConversations.map((conversation: Conversation) => {
                                    const displayName = getDisplayName(conversation.admin_user_id, conversation.admin_display_name);
                                    
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
                                  })}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    // Chat Interface
                    <div className="flex flex-col h-full">
                      {(() => {
                        const displayName = getDisplayName(selectedConversation.admin_user_id, selectedConversation.admin_display_name);
                        
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
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Popover open={isProfilePopoverOpen} onOpenChange={setIsProfilePopoverOpen}>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0" align="end">
                                    <div className="p-4">
                                      <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                                        <Avatar className="h-12 w-12">
                                          <AvatarImage src={undefined} />
                                          <AvatarFallback>
                                            {getInitials(displayName)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="font-semibold text-sm">
                                            {displayName}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Admin Profile
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {(() => {
                                        const adminUserId = selectedConversation?.admin_user_id;
                                        const adminInfo = adminUserId ? (mergedUserInfos[adminUserId] as UserInfo | undefined) : undefined;
                                        
                                        // Debug logging
                                        console.log('[FloatingCarrierChat] Profile popover state:', {
                                          adminUserId,
                                          isLoadingUserInfos,
                                          userInfosKeys: Object.keys(mergedUserInfos),
                                          hasFallbackData: !!fallbackAdminInfo,
                                          adminInfo,
                                          hasAdminInfo: !!adminInfo,
                                          adminInfoKeys: adminInfo ? Object.keys(adminInfo) : []
                                        });
                                        
                                        // Show loading only if we're actively loading AND we don't have the data yet
                                        if (isLoadingUserInfos && !adminInfo) {
                                          return (
                                            <div className="text-center py-4">
                                              <p className="text-sm text-muted-foreground">Loading profile...</p>
                                            </div>
                                          );
                                        }
                                        
                                        // If we have an error, show error message
                                        if (userInfosError) {
                                          return (
                                            <div className="text-center py-4">
                                              <p className="text-sm text-red-500">Error loading profile</p>
                                              <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
                                            </div>
                                          );
                                        }
                                        
                                        // If we have admin info, show it
                                        if (adminInfo) {
                                          return (
                                          <div className="space-y-3">
                                            {adminInfo.fullName && (
                                              <div className="flex items-start gap-3">
                                                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                  <p className="text-xs text-muted-foreground">Full Name</p>
                                                  <p className="text-sm font-medium">{adminInfo.fullName}</p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {(adminInfo.firstName || adminInfo.lastName) && !adminInfo.fullName && (
                                              <div className="flex items-start gap-3">
                                                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                  <p className="text-xs text-muted-foreground">Name</p>
                                                  <p className="text-sm font-medium">
                                                    {[adminInfo.firstName, adminInfo.lastName].filter(Boolean).join(' ') || 'N/A'}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {adminInfo.emailAddresses?.[0]?.emailAddress && (
                                              <div className="flex items-start gap-3">
                                                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                  <p className="text-xs text-muted-foreground">Email</p>
                                                  <p className="text-sm font-medium break-all">{adminInfo.emailAddresses[0].emailAddress}</p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {adminInfo.username && (
                                              <div className="flex items-start gap-3">
                                                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                  <p className="text-xs text-muted-foreground">Username</p>
                                                  <p className="text-sm font-medium">{adminInfo.username}</p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {adminInfo.role && (
                                              <div className="flex items-start gap-3">
                                                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                  <p className="text-xs text-muted-foreground">Role</p>
                                                  <p className="text-sm font-medium">{adminInfo.role}</p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {!adminInfo.fullName && !adminInfo.firstName && !adminInfo.lastName && !adminInfo.emailAddresses?.[0]?.emailAddress && !adminInfo.username && (
                                              <div className="text-center py-4">
                                                <p className="text-sm text-muted-foreground">Limited profile information available</p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                        }
                                        
                                        // Fallback: No admin info available
                                        return (
                                          <div className="text-center py-4">
                                            <p className="text-sm text-muted-foreground">Profile information not available</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {adminUserId ? `Admin ID: ${adminUserId}` : 'No admin selected'}
                                            </p>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </PopoverContent>
                                </Popover>
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
                                      {/* Attachment */}
                                      {message.attachment_url && (
                                        <div className="mb-2">
                                          {message.attachment_type?.startsWith('image/') ? (
                                            <a 
                                              href={message.attachment_url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="block rounded-lg overflow-hidden border border-border/50 hover:opacity-90 transition-opacity max-w-xs"
                                            >
                                              <img 
                                                src={message.attachment_url} 
                                                alt={message.attachment_name || 'Attachment'} 
                                                className="max-w-full max-h-64 w-auto h-auto object-contain rounded"
                                                onError={(e) => {
                                                  // Fallback if image fails to load
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const parent = target.parentElement;
                                                  if (parent) {
                                                    parent.innerHTML = `
                                                      <div class="flex items-center gap-2 p-2 rounded border bg-muted/50">
                                                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <span class="text-sm">${message.attachment_name || 'Image'}</span>
                                                      </div>
                                                    `;
                                                  }
                                                }}
                                              />
                                            </a>
                                          ) : (
                                            <a
                                              href={message.attachment_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`flex items-center gap-2 p-2 rounded border ${
                                                message.sender_type === 'carrier'
                                                  ? 'bg-primary/20 border-primary/30'
                                                  : 'bg-muted/50 border-border/50'
                                              } hover:opacity-80 transition-opacity max-w-xs`}
                                            >
                                              <FileText className="h-4 w-4 flex-shrink-0" />
                                              <span className="text-sm truncate">{message.attachment_name || 'Document'}</span>
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      {/* Message text */}
                                      {message.message && (
                                        <p className="text-sm">{message.message}</p>
                                      )}
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
                              {/* Selected file preview */}
                              {selectedFile && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
                                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedFile(null);
                                      if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                      }
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input
                                  id="carrier-chat-file-input"
                                  name="carrier-chat-file-input"
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                                  onChange={handleFileSelect}
                                  className="hidden"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isSendingMessage}
                                  className="shrink-0"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </Button>
                                <Input
                                  id="carrier-chat-message-input"
                                  name="carrier-chat-message-input"
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
                                  disabled={(!newMessage.trim() && !selectedFile) || isSendingMessage}
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
