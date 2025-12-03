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
import { useRealtimeConversationMessages } from "@/hooks/useRealtimeConversationMessages";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import {
    ArrowLeft,
    Building2,
    FileText,
    Image,
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

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  // Handle API response structure: { ok: true, data: [...] } or { error: "..." }
  if (data.ok && data.data) {
    return data.data;
  }
  if (data.error) {
    console.error(`[FloatingAdminChat] API error for ${url}:`, data.error);
    return [];
  }
  // Fallback: return data directly if it's already an array or object
  return data.data || data || [];
};

interface Conversation {
  conversation_id: string;
  carrier_user_id: string;
  admin_user_id?: string; // Legacy field name
  supabase_admin_user_id?: string; // Actual field name from API
  other_user_id?: string;
  last_message_at: string;
  last_message_timestamp?: string;
  created_at: string;
  updated_at: string;
  last_message: string;
  last_message_sender_type: 'admin' | 'carrier';
  last_message_sender_id?: string;
  unread_count: number;
  conversation_with_type?: 'carrier' | 'admin';
}

interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'admin' | 'carrier';
  message: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_size?: number;
  created_at: string;
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

export default function FloatingAdminChatButton() {
  const { user, isLoaded } = useUnifiedUser();
  const { isAdmin, isLoading: roleLoading } = useUnifiedRole();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 }); // Safe default for SSR
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Chat functionality state
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Carrier profile preview state
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 200, y: window.innerHeight - 100 });
    }
  }, []);

  // Fetch conversations
  const { data: conversationsData, mutate: mutateConversations } = useSWR(
    user && isAdmin ? "/api/admin/conversations" : null,
    fetcher,
    { refreshInterval: 5000 } // Refresh conversations every 5 seconds
  );

  // Fetcher already unwraps the data, so use directly
  const conversations: Conversation[] = Array.isArray(conversationsData) 
    ? conversationsData 
    : (conversationsData?.data || []);
  
  // Clear selected conversation if it no longer exists
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversationExists = conversations.some(
        (conv: Conversation) => conv.conversation_id === selectedConversationId
      );
      if (!conversationExists) {
        console.log('[FloatingAdminChat] Selected conversation no longer exists, clearing selection');
        setSelectedConversationId(null);
      }
    }
  }, [conversations, selectedConversationId]);

  // Fetch messages for selected conversation
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    user && isAdmin && selectedConversationId ? `/api/admin/conversations/${selectedConversationId}` : null,
    async (url: string) => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        // Handle API response structure: { ok: true, data: [...] } or { error: "..." }
        if (data.ok && data.data) {
          return data.data;
        }
        if (data.error) {
          // If conversation not found, clear selection
          if (data.error.includes('not found') || data.error.includes('Conversation not found')) {
            console.log('[FloatingAdminChat] Conversation not found, clearing selection');
            setSelectedConversationId(null);
            return [];
          }
          console.error(`[FloatingAdminChat] API error for ${url}:`, data.error);
          return [];
        }
        // Fallback: return data directly if it's already an array or object
        return data.data || data || [];
      } catch (error: any) {
        // If conversation not found, clear selection
        if (error?.message?.includes('not found') || error?.message?.includes('Conversation not found')) {
          console.log('[FloatingAdminChat] Conversation not found, clearing selection');
          setSelectedConversationId(null);
          return [];
        }
        throw error;
      }
    },
    { refreshInterval: 0 } // Disable polling - using Realtime instead
  );

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleMessageInsert = useCallback((payload?: any) => {
    console.log('[FloatingAdminChat] New message received via postgres_changes, refreshing...', payload);
    
    // If we have a new message from postgres_changes, update the messages list
    if (payload?.new) {
      const newMessage: ConversationMessage = {
        id: payload.new.id,
        conversation_id: payload.new.conversation_id,
        sender_id: payload.new.supabase_sender_id,
        sender_type: payload.new.sender_type,
        message: payload.new.message,
        created_at: payload.new.created_at,
        attachment_url: payload.new.attachment_url,
        attachment_type: payload.new.attachment_type,
        attachment_name: payload.new.attachment_name,
        is_read: payload.new.is_read || false,
      };
      
      // Add or replace the message (replace if it's an optimistic update)
      mutateMessages((current: ConversationMessage[] = []) => {
        // Remove any optimistic message with matching content from same sender
        const filtered = current.filter(msg => 
          !(msg.id.startsWith('temp-') && 
            msg.message === newMessage.message && 
            msg.sender_id === newMessage.sender_id &&
            Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000)
        );
        
        // Check if message already exists
        if (filtered.some(msg => msg.id === newMessage.id)) {
          return filtered;
        }
        
        // Add the new message and sort
        return [...filtered, newMessage].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }, false);
    } else {
      // Fallback: revalidate if no payload data
      mutateMessages();
    }
    
    setTimeout(scrollToBottom, 100);
  }, [mutateMessages, scrollToBottom]);

  const handleMessageUpdate = useCallback((payload?: any) => {
    console.log('[FloatingAdminChat] Message updated via postgres_changes, refreshing...', payload);
    // Force revalidation to get the latest messages
    mutateMessages(undefined, { revalidate: true });
  }, [mutateMessages]);

  // Subscribe to real-time message updates (postgres_changes for persistence)
  useRealtimeConversationMessages({
    enabled: !!selectedConversationId && isAdmin,
    conversationId: selectedConversationId || undefined,
    onInsert: handleMessageInsert,
    onUpdate: handleMessageUpdate,
  });

  // Subscribe to Broadcast for instant message delivery
  const { sendBroadcast } = useRealtimeChat({
    roomName: selectedConversationId || '',
    userId: user?.id,
    username: getDisplayName(user?.id || '', true),
    enabled: !!selectedConversationId && isAdmin,
    onBroadcast: (broadcastMessage) => {
      // Show broadcast messages from other users for instant delivery
      // Our own messages are handled via optimistic updates
      if (broadcastMessage.user.id !== user?.id) {
        console.log('[FloatingAdminChat] Broadcast message received from other user:', broadcastMessage);
        // Convert broadcast message to ConversationMessage format
        const convertedMessage: ConversationMessage = {
          id: broadcastMessage.id,
          conversation_id: selectedConversationId || '',
          sender_id: broadcastMessage.user.id,
          sender_type: 'admin', // Will be updated by postgres_changes when real message arrives
          message: broadcastMessage.content,
          created_at: broadcastMessage.createdAt,
          attachment_url: broadcastMessage.attachment_url,
          attachment_type: broadcastMessage.attachment_type,
          attachment_name: broadcastMessage.attachment_name,
          is_read: false,
        };
        // Add to messages immediately for instant display
        mutateMessages((current: ConversationMessage[] = []) => {
          // Check if message already exists (avoid duplicates by checking content + sender + time)
          const exists = current.some(msg => 
            msg.id === convertedMessage.id || 
            (msg.message === convertedMessage.message && 
             msg.sender_id === convertedMessage.sender_id &&
             Math.abs(new Date(msg.created_at).getTime() - new Date(convertedMessage.created_at).getTime()) < 2000)
          );
          if (exists) {
            return current;
          }
          const updated = [...current, convertedMessage].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return updated;
        }, false);
        setTimeout(scrollToBottom, 50);
      }
    },
  });

  // Fetcher already unwraps the data, so use directly
  const rawMessages: ConversationMessage[] = Array.isArray(messagesData) 
    ? messagesData 
    : (messagesData?.data || []);

  // Deduplicate messages by id (only for carrier chats to avoid duplicate keys)
  const messages = useMemo(() => {
    if (!selectedConversationId || conversations.length === 0) return rawMessages;
    
    // Find the selected conversation
    const selectedConv = conversations.find(c => c.conversation_id === selectedConversationId);
    if (!selectedConv) return rawMessages;
    
    // Only deduplicate for carrier chats
    const isCarrierChat = selectedConv.conversation_with_type === 'carrier';
    if (!isCarrierChat) return rawMessages;
    
    // Deduplicate by message id, keeping the most recent one
    const seen = new Map<string, ConversationMessage>();
    for (const msg of rawMessages) {
      if (!seen.has(msg.id) || 
          (seen.get(msg.id)?.created_at && msg.created_at && 
           new Date(msg.created_at) > new Date(seen.get(msg.id)!.created_at))) {
        seen.set(msg.id, msg);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [rawMessages, selectedConversationId, conversations]);

  // Get unique carrier user IDs from conversations (exclude admins)
  // Only include actual carriers, not admins in admin-to-admin chats
  const carrierUserIds = useMemo(() => {
    const userIds = new Set<string>();
    conversations.forEach(conv => {
      // Only add carriers, not admins
      if (conv.conversation_with_type === 'carrier') {
        // Get the actual admin_user_id (could be admin_user_id or supabase_admin_user_id)
        const actualAdminUserId = conv.supabase_admin_user_id || conv.admin_user_id;
        // Determine the other user's ID (not current user)
        const otherUserId = actualAdminUserId === user?.id 
          ? conv.carrier_user_id 
          : actualAdminUserId;
        if (otherUserId && otherUserId !== user?.id) {
          userIds.add(otherUserId);
        }
      }
    });
    return Array.from(userIds);
  }, [conversations, user?.id]);

  // Get unique admin user IDs from conversations and messages
  // This includes other admins in admin-to-admin chats
  const adminUserIds = useMemo(() => {
    const adminIds = new Set<string>();
    // Add current user if they're an admin
    if (user?.id) adminIds.add(user.id);
    // Add all admin senders from messages
    messages.forEach((msg: ConversationMessage) => {
      if (msg.sender_type === 'admin' && msg.sender_id) {
        adminIds.add(msg.sender_id);
      }
    });
    // For admin-to-admin chats, add the other admin (who is in carrier_user_id)
    conversations.forEach(conv => {
      // Get the actual admin_user_id (could be admin_user_id or supabase_admin_user_id)
      const actualAdminUserId = conv.supabase_admin_user_id || conv.admin_user_id;
      
      // Debug: Log each conversation to see its structure
      if (conv.conversation_with_type === 'admin') {
        console.log('[FloatingAdminChat] Processing admin-to-admin conversation:', {
          conversation_id: conv.conversation_id,
          conversation_with_type: conv.conversation_with_type,
          admin_user_id: actualAdminUserId,
          carrier_user_id: conv.carrier_user_id,
          current_user_id: user?.id
        });
        
        // The other admin is in carrier_user_id for admin-to-admin chats
        const otherAdminId = actualAdminUserId === user?.id 
          ? conv.carrier_user_id 
          : actualAdminUserId;
        console.log('[FloatingAdminChat] Calculated otherAdminId:', otherAdminId);
        
        if (otherAdminId && otherAdminId !== user?.id) {
          adminIds.add(otherAdminId);
          console.log('[FloatingAdminChat] Added otherAdminId to adminIds:', otherAdminId);
        }
        // Also explicitly add carrier_user_id when it's an admin-to-admin chat
        if (conv.carrier_user_id && conv.carrier_user_id !== user?.id) {
          adminIds.add(conv.carrier_user_id);
          console.log('[FloatingAdminChat] Added carrier_user_id to adminIds:', conv.carrier_user_id);
        }
      } else {
        // Debug: Log non-admin conversations to see what we're missing
        console.log('[FloatingAdminChat] Non-admin conversation:', {
          conversation_id: conv.conversation_id,
          conversation_with_type: conv.conversation_with_type,
          admin_user_id: actualAdminUserId,
          carrier_user_id: conv.carrier_user_id
        });
      }
      // Also add admin_user_id if it's not the current user
      // But only if conversation_with_type is not explicitly 'carrier'
      if (actualAdminUserId && actualAdminUserId !== user?.id && conv.conversation_with_type !== 'carrier') {
        adminIds.add(actualAdminUserId);
      }
    });
    const adminIdsArray = Array.from(adminIds);
    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[FloatingAdminChat] Final collected admin user IDs:', adminIdsArray, 'from', conversations.length, 'conversations');
    }
    return adminIdsArray;
  }, [messages, conversations, user?.id]);

  // Fetch carrier user information
  const { data: userInfos = {} } = useSWR(
    carrierUserIds.length > 0 ? `/api/users/batch?ids=${carrierUserIds.join(',')}` : null,
    fetcher
  );

  // Fetch admin user information (including display names from admin_profiles)
  const { data: adminUserInfos = {}, isLoading: isLoadingAdminInfos } = useSWR(
    adminUserIds.length > 0 ? `/api/users/batch?ids=${adminUserIds.join(',')}` : null,
    fetcher
  );

  // Merge user infos (carriers + admins)
  const allUserInfos = useMemo(() => {
    return { ...userInfos, ...adminUserInfos };
  }, [userInfos, adminUserInfos]);

  // Helper function to get display name (works for both carriers and admins)
  const getDisplayName = useCallback((userId: string, isAdmin?: boolean): string => {
    if (!userId) {
      return isAdmin ? "Admin" : "Carrier";
    }
    
    const userInfo = allUserInfos[userId] as UserInfo;
    if (!userInfo) {
      // If it's the current user and they're an admin, try to get their display name
      if (isAdmin && userId === user?.id) {
        return "You"; // Fallback for current admin
      }
      // If admin info is still loading, try to show user ID as fallback
      if (isAdmin && isLoadingAdminInfos) {
        return userId.substring(0, 8) + "..."; // Show partial user ID while loading
      }
      // Debug: Log when admin info is missing (only if not loading)
      if (isAdmin && !isLoadingAdminInfos) {
        console.log(`[FloatingAdminChat] Admin user info not found for ${userId}. AdminUserIds:`, adminUserIds, 'AllUserInfos keys:', Object.keys(allUserInfos), 'IsLoading:', isLoadingAdminInfos);
      }
      return isAdmin ? "Admin" : "Carrier";
    }

    // Admin display names are already set in fullName by /api/users/batch
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return isAdmin ? "Admin" : "Carrier";
  }, [allUserInfos, user?.id, adminUserIds, isLoadingAdminInfos]);

  // Calculate total unread count for the button badge
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
  }, [conversations]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    
    const searchLower = searchTerm.toLowerCase();
    return conversations.filter(conv => {
      // Get the other user's ID (not current user)
      const otherUserId = conv.admin_user_id === user?.id 
        ? conv.carrier_user_id 
        : conv.admin_user_id;
      const isOtherUserAdmin = conv.conversation_with_type === 'admin';
      const displayName = getDisplayName(otherUserId || '', isOtherUserAdmin);
      
      return (
        displayName.toLowerCase().includes(searchLower) ||
        (otherUserId && otherUserId.toLowerCase().includes(searchLower)) ||
        (conv.last_message && conv.last_message.toLowerCase().includes(searchLower))
      );
    });
  }, [conversations, searchTerm, getDisplayName, user?.id]);

  // Auto-cleanup self-conversations on mount
  useEffect(() => {
    if (user?.id && isAdmin) {
      // Clean up any self-conversations (where admin_user_id = carrier_user_id)
      fetch('/api/admin/conversations?cleanup=true', {
        method: 'DELETE'
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.deleted_count > 0) {
            console.log(`[FloatingAdminChat] Cleaned up ${data.deleted_count} self-conversation(s)`);
            mutateConversations(); // Refresh conversations list
          }
        })
        .catch(err => {
          console.error('[FloatingAdminChat] Error cleaning up self-conversations:', err);
        });
    }
  }, [user?.id, isAdmin, mutateConversations]);

  // Debug logging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    if (conversationsData !== undefined) {
      console.log('[FloatingAdminChat] Conversations data:', {
        raw: conversationsData,
        processed: conversations,
        count: conversations.length,
        filteredCount: filteredConversations.length,
        sample: conversations[0],
        isArray: Array.isArray(conversationsData),
        hasData: conversationsData?.data !== undefined
      });
    }
    if (messagesData !== undefined && selectedConversationId) {
      console.log('[FloatingAdminChat] Messages data:', {
        conversationId: selectedConversationId,
        raw: messagesData,
        processed: messages,
        count: messages.length,
        isArray: Array.isArray(messagesData),
        hasData: messagesData?.data !== undefined
      });
    }
  }, [conversationsData, messagesData, conversations, messages, selectedConversationId, filteredConversations]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll when messages change or conversation changes
  useEffect(() => {
    if (isOpen && selectedConversationId) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, selectedConversationId, scrollToBottom]);

  // Handle send message with optimistic updates
  const handleSendMessage = useCallback(async () => {
    if (!selectedConversationId || (!newMessage.trim() && !selectedFile) || isSendingMessage) return;

    const messageText = newMessage.trim();
    const tempMessageId = `temp-${Date.now()}`;
    
    // Optimistic update: Add message to UI immediately
    const optimisticMessage: ConversationMessage = {
      id: tempMessageId,
      conversation_id: selectedConversationId,
      sender_id: user?.id || '',
      sender_type: 'admin',
      sender_name: user?.email || 'Admin',
      message: messageText,
      created_at: new Date().toISOString(),
      file_url: null,
      file_name: selectedFile?.name || null,
      file_type: selectedFile?.type || null,
    };

    // Optimistically update messages
    mutateMessages((current: ConversationMessage[] = []) => {
      return [...current, optimisticMessage];
    }, false); // false = don't revalidate yet

    // Send via Broadcast for instant delivery to other users
    if (sendBroadcast) {
      sendBroadcast({
        content: messageText,
        user: {
          id: user?.id || '',
          name: getDisplayName(user?.id || '', true),
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

        response = await fetch(`/api/admin/conversations/${selectedConversationId}`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Send text-only message
        response = await fetch(`/api/admin/conversations/${selectedConversationId}`, {
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
        mutateMessages((current: ConversationMessage[] = []) => {
          return current.filter(msg => msg.id !== tempMessageId);
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
  }, [selectedConversationId, newMessage, selectedFile, isSendingMessage, mutateMessages, mutateConversations, scrollToBottom, sendBroadcast, user?.id, getDisplayName]);

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
  const markConversationAsRead = useCallback(async (convId: string) => {
    try {
      await fetch(`/api/admin/conversations/${convId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      mutateConversations(); // Refresh conversations to update unread counts
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [mutateConversations]);

  // Handle conversation selection
  const handleConversationSelect = useCallback((convId: string) => {
    setSelectedConversationId(convId);
    // Mark all messages in this conversation as read for the current user
    markConversationAsRead(convId);
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
    if (!isDragging && dragDuration < 200) { // Only trigger click if not dragging or very short drag
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
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }
        50% { 
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6), 0 0 40px rgba(34, 197, 94, 0.3);
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

  const selectedConversation = conversations.find(c => c.conversation_id === selectedConversationId);
  // Get the other user's ID (not current user) for the selected conversation
  // If current user is admin_user_id, other user is carrier_user_id
  // If current user is carrier_user_id, other user is admin_user_id
  const actualAdminUserId = selectedConversation?.supabase_admin_user_id || selectedConversation?.admin_user_id;
  const otherUserId = selectedConversation 
    ? (actualAdminUserId === user?.id 
       ? selectedConversation.carrier_user_id 
       : actualAdminUserId)
    : null;
  const isOtherUserAdmin = selectedConversation?.conversation_with_type === 'admin';
  // Ensure we use otherUserId (which is correctly identified) and pass isAdmin flag
  const carrierDisplayName = selectedConversation && otherUserId
    ? getDisplayName(otherUserId, isOtherUserAdmin) 
    : selectedConversation
    ? getDisplayName(selectedConversation.carrier_user_id || selectedConversation.admin_user_id || '', isOtherUserAdmin)
    : "Carrier";
  const carrierUserId = otherUserId || selectedConversation?.carrier_user_id;

  // Fetch carrier profile for preview (must be before any conditional returns)
  const { data: carrierProfileData, isLoading: isLoadingCarrierProfile, error: carrierProfileError } = useSWR(
    user && isAdmin && carrierUserId && isProfilePopoverOpen 
      ? `/api/admin/carriers/${carrierUserId}` 
      : null,
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // API returns { ok: true, data: {...} } structure
        if (data.ok && data.data) {
          console.log('[FloatingAdminChat] Carrier profile loaded:', data.data);
          return data.data;
        }
        if (data.error) {
          console.error(`[FloatingAdminChat] API error for ${url}:`, data.error);
          throw new Error(data.error);
        }
        // Fallback: return data directly if structure is different
        console.log('[FloatingAdminChat] Carrier profile loaded (fallback):', data);
        return data;
      } catch (error) {
        console.error(`[FloatingAdminChat] Error fetching carrier profile from ${url}:`, error);
        throw error;
      }
    }
  );

  const carrierProfile = carrierProfileData || null;

  // Don't render until user and role are loaded - prevents both buttons from showing
  if (!isLoaded || !user || roleLoading || !isAdmin) return null;

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
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 opacity-10 animate-ping scale-110"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 opacity-8 animate-pulse scale-105"></div>
            
            <Button
              onClick={handleButtonClick}
              className={cn(
                "floating-admin-button relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 border border-emerald-500/50 hover:border-emerald-600/70 backdrop-blur-sm p-0 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem]",
                "cursor-move select-none",
                isDragging && "scale-105 cursor-grabbing",
                isOpen && "scale-0 opacity-0"
              )}
              style={{ userSelect: 'none' }}
              data-testid="admin-chat-button"
            >
              <MessageCircle className="h-5 w-5 text-white drop-shadow-sm" />
              {totalUnreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse shadow-md border-2 border-emerald-900">
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
            className="fixed z-50 w-[420px] h-[600px] animate-in slide-in-from-bottom-4 duration-500 ease-out floating-admin-console"
            style={{
              left: Math.min(position.x, window.innerWidth - 420), // 420px for console width
              top: Math.min(position.y - 620, window.innerHeight - 620), // 620px for console height
            }}
          >
            <Card className="h-full shadow-2xl transition-all duration-500 ease-out hover:shadow-3xl hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-emerald-600" />
                      <CardTitle className="text-lg">Carrier Chat</CardTitle>
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
                  {!selectedConversationId ? (
                    // Conversations List
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="admin-chat-search"
                            name="admin-chat-search"
                            placeholder="Search conversations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      <ScrollArea className="flex-1">
                        <div className="p-2">
                          {conversations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No conversations yet</p>
                              <p className="text-xs mt-2">Start a conversation to begin chatting</p>
                            </div>
                          ) : filteredConversations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No conversations match your search</p>
                              <p className="text-xs mt-2">Try a different search term</p>
                            </div>
                          ) : (
                            filteredConversations.map((conv) => {
                              // Determine the other user's ID (not the current admin)
                              // If current user is admin_user_id, other user is carrier_user_id
                              // If current user is carrier_user_id, other user is admin_user_id
                              const actualAdminUserId = conv.supabase_admin_user_id || conv.admin_user_id;
                              const otherUserId = actualAdminUserId === user?.id 
                                ? conv.carrier_user_id 
                                : actualAdminUserId;
                              
                              const isOtherUserAdmin = conv.conversation_with_type === 'admin';
                              // Ensure otherUserId is valid before calling getDisplayName
                              const displayName = otherUserId 
                                ? getDisplayName(otherUserId, isOtherUserAdmin)
                                : isOtherUserAdmin ? "Admin" : "Carrier";
                              
                              // Determine if the last message was from the current user
                              // Use last_message_sender_id if available, otherwise fall back to sender_type check
                              const isLastMessageFromCurrentUser = conv.last_message_sender_id 
                                ? conv.last_message_sender_id === user?.id
                                : ((conv.last_message_sender_type === 'admin' && 
                                    actualAdminUserId === user?.id) ||
                                   (conv.last_message_sender_type === 'carrier' && 
                                    conv.carrier_user_id === user?.id));
                              
                              return (
                                <div
                                  key={conv.conversation_id}
                                  onClick={() => handleConversationSelect(conv.conversation_id)}
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
                                      {conv.unread_count > 0 && (
                                        <Badge variant="destructive" className="text-xs h-5 px-1.5">
                                          {conv.unread_count}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {otherUserId}
                                    </p>
                                    {conv.last_message && (
                                      <p className="text-xs text-muted-foreground truncate mt-1">
                                        {isLastMessageFromCurrentUser ? 'You: ' : `${displayName}: `}
                                        {conv.last_message}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {(conv.last_message_timestamp || conv.last_message_at) && (
                                    <div className="text-xs text-muted-foreground">
                                      {formatTime(conv.last_message_timestamp || conv.last_message_at)}
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
                      {selectedConversation && (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedConversationId(null)}
                                  className="h-8 w-8 p-0"
                                >
                                  <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(carrierDisplayName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {carrierDisplayName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {carrierUserId || selectedConversation.carrier_user_id}
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
                                            {getInitials(carrierDisplayName)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="font-semibold text-sm">
                                            {carrierProfile?.legal_name || carrierProfile?.company_name || carrierDisplayName}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Carrier Profile
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {(() => {
                                        // Debug logging
                                        console.log('[FloatingAdminChat] Carrier profile popover state:', {
                                          carrierUserId,
                                          isLoadingCarrierProfile,
                                          carrierProfileError,
                                          carrierProfile,
                                          hasCarrierProfile: !!carrierProfile
                                        });
                                        
                                        // Show loading only if we're actively loading AND we don't have the data yet
                                        if (isLoadingCarrierProfile && !carrierProfile) {
                                          return (
                                            <div className="text-center py-4">
                                              <p className="text-sm text-muted-foreground">Loading profile...</p>
                                            </div>
                                          );
                                        }
                                        
                                        // If we have an error, show error message
                                        if (carrierProfileError) {
                                          return (
                                            <div className="text-center py-4">
                                              <p className="text-sm text-red-500">Error loading profile</p>
                                              <p className="text-xs text-muted-foreground mt-1">
                                                {carrierProfileError instanceof Error 
                                                  ? carrierProfileError.message 
                                                  : 'Please try again later'}
                                              </p>
                                            </div>
                                          );
                                        }
                                        
                                        // If we have carrier profile, show it
                                        if (carrierProfile) {
                                          return (
                                            <div className="space-y-3">
                                              {carrierProfile.contact_name && (
                                                <div className="flex items-start gap-3">
                                                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                  <div>
                                                    <p className="text-xs text-muted-foreground">Contact Name</p>
                                                    <p className="text-sm font-medium">{carrierProfile.contact_name}</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {carrierProfile.mc_number && (
                                                <div className="flex items-start gap-3">
                                                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                  <div>
                                                    <p className="text-xs text-muted-foreground">MC Number</p>
                                                    <p className="text-sm font-medium">{carrierProfile.mc_number}</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {carrierProfile.dot_number && (
                                                <div className="flex items-start gap-3">
                                                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                  <div>
                                                    <p className="text-xs text-muted-foreground">DOT Number</p>
                                                    <p className="text-sm font-medium">{carrierProfile.dot_number}</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {carrierProfile.email && carrierProfile.email !== 'N/A' && (
                                                <div className="flex items-start gap-3">
                                                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                  <div>
                                                    <p className="text-xs text-muted-foreground">Email</p>
                                                    <p className="text-sm font-medium break-all">{carrierProfile.email}</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {carrierProfile.phone && (
                                                <div className="flex items-start gap-3">
                                                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                  <div>
                                                    <p className="text-xs text-muted-foreground">Phone</p>
                                                    <p className="text-sm font-medium">{carrierProfile.phone}</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {!carrierProfile.contact_name && !carrierProfile.mc_number && !carrierProfile.dot_number && 
                                               (!carrierProfile.email || carrierProfile.email === 'N/A') && !carrierProfile.phone && (
                                                <div className="text-center py-4">
                                                  <p className="text-sm text-muted-foreground">Limited profile information available</p>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }
                                        
                                        // Fallback: No carrier profile available
                                        return (
                                          <div className="text-center py-4">
                                            <p className="text-sm text-muted-foreground">Profile information not available</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {carrierUserId ? `Carrier ID: ${carrierUserId}` : 'No carrier selected'}
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
                                {messages.map((message, index) => {
                                  const isCurrentUser = message.sender_id === user?.id;
                                  const senderDisplayName = getDisplayName(message.sender_id, message.sender_type === 'admin');
                                  
                                  return (
                                    <div
                                      key={`${message.id}-${index}-${message.created_at}`}
                                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`max-w-[80%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                                        {/* Sender name (only show if not current user or if admin-to-admin chat) */}
                                        {!isCurrentUser && (
                                          <p className="text-xs text-muted-foreground mb-1 px-1">
                                            {senderDisplayName}
                                          </p>
                                        )}
                                        <div
                                          className={`rounded-lg px-3 py-2 ${
                                            isCurrentUser
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
                                                message.sender_id === user?.id
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
                                            isCurrentUser
                                              ? 'opacity-70' 
                                              : 'text-muted-foreground'
                                          }`}>
                                            {new Date(message.created_at).toLocaleTimeString()}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
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
                                  id="admin-chat-file-input"
                                  name="admin-chat-file-input"
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
                                  id="admin-chat-message-input"
                                  name="admin-chat-message-input"
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
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                        </>
                      )}
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