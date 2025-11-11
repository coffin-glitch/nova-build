"use client";

// import FloatingChatConsole from "@/components/ui/FloatingChatConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { Clock, MessageCircle, Trash2, User, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AdminMessagesPage() {
  const { user, isLoaded } = useUnifiedUser();
  const { isAdmin, isLoading: roleLoading, role } = useUnifiedRole();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showConversations, setShowConversations] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // Fetch conversations data (new unified system)
  const { data: conversationsData, mutate: mutateConversations } = useSWR(
    user && isAdmin ? "/api/admin/conversations" : null,
    fetcher,
    { 
      refreshInterval: 10000,
      keepPreviousData: true, // Keep previous data during refetch to prevent flashing
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on network reconnect
    }
  );
  const { data: carriersData } = useSWR(
    user && isAdmin ? "/api/admin/carriers" : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: adminsData } = useSWR(
    user && isAdmin ? "/api/admin/admins" : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  // Fetch average response time
  const { data: responseTimeData } = useSWR(
    user && isAdmin ? "/api/admin/conversations/stats" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Use previous data if available to prevent flashing during refetch
  const conversations = (conversationsData?.data ?? conversationsData) || [];
  const carriers = Array.isArray(carriersData) ? carriersData : [];
  const admins = Array.isArray(adminsData) ? adminsData.filter((admin: any) => admin.user_id !== user?.id) : [];

  // Get unique user IDs from conversations (both carriers and admins)
  // Need to get the other user's ID, not the current user's ID
  const conversationUserIds = Array.from(new Set(
    conversations.map((conv: any) => {
      // Determine the other user's ID (not current user)
      const otherUserId = conv.admin_user_id === user?.id 
        ? conv.carrier_user_id 
        : conv.admin_user_id;
      return otherUserId || conv.other_user_id || conv.carrier_user_id;
    }).filter(Boolean)
  ));
  
  // Also include admin IDs from the admins array (for "Start New Chat" section)
  const adminIdsFromList = admins.map((admin: any) => admin.user_id || admin.id).filter(Boolean);
  
  // Combine all user IDs (from conversations + from admin list)
  const allUserIds = Array.from(new Set([...conversationUserIds, ...adminIdsFromList]));

  // Fetch user information for all users (carriers and admins)
  const { data: userInfos = {} } = useSWR(
    allUserIds.length > 0 ? `/api/users/batch?ids=${allUserIds.join(',')}` : null,
    fetcher
  );

  // Helper function to get display name (works for both carriers and admins)
  const getDisplayName = (userId: string, isAdmin?: boolean): string => {
    const userInfo = userInfos[userId];
    if (!userInfo) {
      return isAdmin ? "Admin" : "Carrier";
    }
    
    // Admin display names are already set in fullName by /api/users/batch
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return isAdmin ? "Admin" : "Carrier";
  };

  // Calculate stats from conversations
  const activeChats = conversations.length;

  const unreadMessages = conversations.reduce((sum: number, conv: any) => {
    // Ensure unread_count is a number (handle string "00" or "01" cases)
    const unreadCount = typeof conv.unread_count === 'string' 
      ? parseInt(conv.unread_count, 10) || 0
      : (conv.unread_count || 0);
    return sum + unreadCount;
  }, 0);

  // Calculate average response time from API
  const avgResponseTimeMinutes = responseTimeData?.avg_response_minutes || 0;
  const calculateAvgResponseTime = () => {
    if (avgResponseTimeMinutes === 0 || conversations.length === 0) return "0m";
    if (avgResponseTimeMinutes < 60) {
      return `${Math.round(avgResponseTimeMinutes)}m`;
    }
    const hours = Math.floor(avgResponseTimeMinutes / 60);
    const minutes = Math.round(avgResponseTimeMinutes % 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  // Get carriers without existing chats (check conversations)
  const carriersWithoutChats = carriers.filter((carrier: any) => {
    const carrierId = carrier.user_id || carrier.id;
    const hasExistingChat = conversations.some((conv: any) => 
      (conv.other_user_id || conv.carrier_user_id) === carrierId
    );
    return !hasExistingChat;
  });

  // Get admins without existing chats (check conversations)
  const adminsWithoutChats = admins.filter((admin: any) => {
    const adminId = admin.user_id || admin.id;
    const hasExistingChat = conversations.some((conv: any) => 
      (conv.other_user_id || conv.carrier_user_id) === adminId
    );
    return !hasExistingChat;
  });

  // Function to start a new chat using conversation system
  const startNewChat = async (userId: string) => {
    try {
      // Create a new conversation using the conversation API
      const response = await fetch('/api/admin/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Close the new chat panel
        setShowNewChat(false);
        
        // Refresh conversations list if visible
        if (showConversations) {
          // Trigger a refresh by toggling
          setShowConversations(false);
          setTimeout(() => setShowConversations(true), 100);
        }
        
        // Open the floating chat console
        const chatButton = document.querySelector('[data-testid="admin-chat-button"]') as HTMLElement;
        if (chatButton) {
          chatButton.click();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create new chat');
      }
    } catch (error: any) {
      console.error('Error starting new chat:', error);
      toast.error(error.message || 'Failed to start new chat. Please try again.');
    }
  };

  // Function to delete a conversation
  const deleteConversation = async (conversationId: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete the conversation with ${displayName}? This will permanently remove all messages and reset the chat. The user will be able to start a new chat with you.`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/conversations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Conversation with ${displayName} deleted successfully. Chat has been reset.`);
        
        // Refresh conversations list
        mutateConversations();
        
        // If conversations list is visible, refresh it
        if (showConversations) {
          setShowConversations(false);
          setTimeout(() => setShowConversations(true), 100);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete conversation' }));
        throw new Error(errorData.error || 'Failed to delete conversation');
      }
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast.error(error.message || 'Failed to delete conversation. Please try again.');
    }
  };

  useEffect(() => {
    // Wait for both user and role to be loaded before making any decisions
    if (!isLoaded || roleLoading) {
      return;
    }

    // If no user, redirect to sign-in
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Only redirect to forbidden if:
    // 1. Role loading is complete (!roleLoading)
    // 2. User exists (we already checked above)
    // 3. Role has been determined and is NOT "admin"
    // We check both role and isAdmin to prevent race conditions:
    // - If role === "carrier", user is definitely not admin
    // - If role !== "admin" AND isAdmin === false, user is not admin
    // - If role === "none", wait (role might still be loading)
    // - If role === "admin" OR isAdmin === true, allow access
    if (!roleLoading && user) {
      // Only redirect if we're certain the user is not an admin
      // Check both role and isAdmin to handle all edge cases
      if (role === "carrier" || (role !== "admin" && role !== "none" && !isAdmin)) {
        // Role has been determined and user is definitely not an admin
        router.push('/forbidden');
        return;
      }
    }

    // Only set loading to false if we have a user and role is loaded
    // and either we're an admin or we're about to redirect
    if (user && !roleLoading) {
      setIsLoading(false);
    }
  }, [user, isLoaded, isAdmin, roleLoading, role, router]);

  if (!isLoaded || isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Please wait while we load the page.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-primary" />
              Live Chat Center
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage customer conversations and provide real-time support with our innovative floating chat console
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <Zap className="h-4 w-4 mr-1" />
              Live Support
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeChats}</div>
              <p className="text-xs text-muted-foreground">
                Live conversations
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unreadMessages.toString()}</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateAvgResponseTime()}</div>
              <p className="text-xs text-muted-foreground">
                Average response time
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Profile</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user?.firstName || user?.email || 'Admin'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Online
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Floating Chat Console
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="relative mb-6">
                <MessageCircle className="h-20 w-20 mx-auto text-muted-foreground opacity-30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Innovative Chat Experience</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Click the floating chat button in the bottom-right corner to access our modern, 
                efficient chat console. Features include profile photos, real-time typing indicators, 
                and smart conversation management.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => setShowConversations(!showConversations)}
                >
                  <Users className="h-4 w-4" />
                  View All Conversations
                </Button>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => setShowNewChat(!showNewChat)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Start New Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversations List */}
        {showConversations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Conversations ({activeChats})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeChats === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active conversations</p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv: any) => {
                      // Determine the other user's ID (not current user)
                      // If current user is admin_user_id, other user is carrier_user_id
                      // If current user is carrier_user_id, other user is admin_user_id
                      const otherUserId = conv.admin_user_id === user?.id 
                        ? conv.carrier_user_id 
                        : conv.admin_user_id;
                      
                      const conversationType = conv.conversation_with_type || 'carrier';
                      const isOtherUserAdmin = conversationType === 'admin';
                      const displayName = getDisplayName(otherUserId || conv.carrier_user_id, isOtherUserAdmin);
                      const unreadCount = conv.unread_count || 0;
                      
                      // Determine if the last message was from the current user
                      const isLastMessageFromCurrentUser = conv.last_message_sender_id 
                        ? conv.last_message_sender_id === user?.id
                        : ((conv.last_message_sender_type === 'admin' && 
                            conv.admin_user_id === user?.id) ||
                           (conv.last_message_sender_type === 'carrier' && 
                            conv.carrier_user_id === user?.id));
                      
                      return (
                        <div key={conv.conversation_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 group">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {conversationType === 'admin' ? 'Admin' : 'Carrier'} • {otherUserId || conv.carrier_user_id}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.last_message ? (
                                  isLastMessageFromCurrentUser 
                                    ? 'You: ' 
                                    : `${displayName}: `
                                ) + conv.last_message.substring(0, 50) + '...' : 'No messages'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              {unreadCount > 0 && (
                                <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center mb-1">
                                  {unreadCount}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {conv.last_message_timestamp || conv.last_message_at 
                                  ? new Date(conv.last_message_timestamp || conv.last_message_at).toLocaleTimeString() 
                                  : ''}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.conversation_id, displayName);
                              }}
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete conversation and reset chat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Chat Selection */}
        {showNewChat && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Start New Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(carriers.length === 0 && admins.length === 0) ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">No users available</p>
                    <p className="text-sm text-muted-foreground">
                      No carriers or admins registered yet
                    </p>
                  </div>
                ) : (carriersWithoutChats.length === 0 && adminsWithoutChats.length === 0) ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">No users available for new chats</p>
                    <p className="text-sm text-muted-foreground">
                      All users already have active conversations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Admins Section */}
                    {adminsWithoutChats.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Admins</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {adminsWithoutChats.map((admin: any) => {
                            const adminId = admin.user_id || admin.id;
                            return (
                              <div key={adminId} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{getDisplayName(adminId, true)}</p>
                                  <p className="text-sm text-muted-foreground">{admin.email || 'Admin'}</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => startNewChat(adminId)}
                                >
                                  Start Chat
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Carriers Section */}
                    {carriersWithoutChats.length > 0 && (
                      <div>
                        {adminsWithoutChats.length > 0 && (
                          <h4 className="text-sm font-semibold mb-2 mt-4 text-muted-foreground">Carriers</h4>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {carriersWithoutChats.map((carrier: any) => {
                            const carrierId = carrier.user_id || carrier.id;
                            return (
                              <div key={carrierId} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{carrier.company_name || getDisplayName(carrierId)}</p>
                                  <p className="text-sm text-muted-foreground">{carrier.contact_name || 'Carrier'}</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => startNewChat(carrierId)}
                                >
                                  Start Chat
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Smart Contact Cards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Compact contact cards with profile photos, company names, and unread message indicators for quick identification.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Real-time Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Live message updates with proper read/unread detection and typing indicators for seamless communication.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Modern Interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Floating console design with minimize/maximize functionality and intuitive navigation for enhanced productivity.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Chat Console - Now handled by FloatingAdminMessagesButton */}
      {/* <FloatingChatConsole /> */}
    </div>
  );
}
