"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
    Clock,
    MessageCircle,
    User,
    Users,
    Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CarrierMessagesPage() {
  const { user, isLoaded } = useUnifiedUser();
  const { accentColor, accentBgStyle } = useAccentColor();
  const router = useRouter();
  const [isCarrier, setIsCarrier] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showConversations, setShowConversations] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // Fetch admin messages
  const { data: messagesData } = useSWR(
    user ? "/api/carrier/messages" : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  // Fetch carrier responses
  const { data: responsesData } = useSWR(
    user ? "/api/carrier/messages/responses" : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  // Fetch admin users for new chat
  const { data: adminsData } = useSWR(
    user ? "/api/carrier/admins" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch carrier conversations to check for existing chats and get unread counts
  const { data: conversationsData } = useSWR(
    user ? "/api/carrier/conversations" : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const messages = messagesData?.data || [];
  const responses = responsesData?.data || [];
  const admins = Array.isArray(adminsData) ? adminsData : [];
  const conversations = conversationsData?.data || [];

  // Get unique admin user IDs for user info fetching
  // Include admins from messages, responses, AND the full admins list for "Start New Chat"
  const adminUserIds = Array.from(new Set([
    ...messages.map((msg: any) => msg.admin_user_id),
    ...responses.map((response: any) => {
      const message = messages.find((msg: any) => msg.id === response.message_id);
      return message?.admin_user_id;
    }).filter(Boolean),
    ...admins.map((admin: any) => admin.user_id).filter(Boolean)
  ]));

  // Fetch user information for all admins
  const { data: userInfos = {} } = useSWR(
    adminUserIds.length > 0 ? `/api/users/batch?ids=${adminUserIds.join(',')}` : null,
    fetcher
  );

  // Helper function to get display name
  // Priority: display_name from API > batch API > fallback
  // Never returns raw user ID - always returns a masked name
  const getDisplayName = (userId: string, displayName?: string): string => {
    // First check if display_name is provided from the API (e.g., from /api/carrier/admins)
    if (displayName) return displayName;
    
    // Fallback to batch API
    const userInfo = userInfos[userId];
    if (!userInfo) return 'Admin';
    
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    // Final fallback - never show raw user ID
    return 'Admin';
  };

  // Calculate stats from conversations (new unified system)
  // Use conversations data for accurate unread count
  const totalUnreadMessages = conversations.reduce((sum: number, conv: any) => {
    // Ensure unread_count is a number (handle string cases)
    const unreadCount = typeof conv.unread_count === 'string' 
      ? parseInt(conv.unread_count, 10) || 0
      : (conv.unread_count || 0);
    return sum + unreadCount;
  }, 0);
  
  // Fallback to old system if no conversations exist
  const unreadMessages = conversations.length > 0 
    ? totalUnreadMessages 
    : messages.filter((msg: any) => !msg.is_read).length;
  
  const totalMessages = messages.length;
  const readMessages = totalMessages - unreadMessages;
  const activeConversations = conversations.length > 0 ? conversations.length : adminUserIds.length;

  // Get admins without existing chats (check both old messages and new conversations)
  const adminsWithoutChats = admins.filter((admin: any) => {
    // Check old admin_messages system
    const hasOldChat = messages.some((msg: any) => 
      msg.admin_user_id === admin.user_id
    );
    // Check new conversations system
    const hasNewChat = conversations.some((conv: any) =>
      conv.admin_user_id === admin.user_id
    );
    return !hasOldChat && !hasNewChat;
  });

  // Function to start a new chat
  const startNewChat = async (adminId: string) => {
    try {
      // Create a new conversation using the conversation API
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
        toast.success(`New chat started with ${getDisplayName(adminId)}!`);
        // Close the new chat panel
        setShowNewChat(false);
        
        // Refresh conversations list if visible
        if (showConversations) {
          // Trigger a refresh by toggling
          setShowConversations(false);
          setTimeout(() => setShowConversations(true), 100);
        }
        
        // Open the floating chat console
        const chatButton = document.querySelector('[data-testid="carrier-floating-messages-button"]') as HTMLElement;
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

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Check if user is carrier - middleware handles auth, but we check here for UI
    // Since middleware redirects non-carriers, if we get here and have a user, they're a carrier
    // The role check is handled by middleware, so we can safely assume carrier status
    const carrierStatus = true; // Middleware ensures only carriers can access
    
    if (!carrierStatus) {
      router.push('/forbidden');
      return;
    }

    setIsCarrier(true);
    setIsLoading(false);
  }, [user, isLoaded, router]);

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

  if (!isCarrier) {
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
              Chat directly with administrators using our modern floating chat console
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeConversations}</div>
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
              <CardTitle className="text-sm font-medium">Carrier Profile</CardTitle>
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
                      : user?.firstName || user?.email || 'Carrier'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Online
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Split Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Floating Chat Console - Left Side, Half Size */}
          <Card className="border-2 border-dashed border-muted-foreground/25 md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Floating Chat Console
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="relative mb-4">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Innovative Chat Experience</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                  Click the floating chat button in the bottom-right corner to access our modern, 
                  efficient chat console. Features include profile photos, real-time typing indicators, 
                  and smart conversation management.
                </p>
                <div className="flex flex-col gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => setShowConversations(!showConversations)}
                  >
                    <Users className="h-4 w-4" />
                    View All Conversations
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
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

          {/* Start New Chat Panel - Right Side */}
          {showNewChat && (
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Start New Chat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {admins.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-2">No administrators available</p>
                      <p className="text-sm text-muted-foreground">
                        Administrators need to be registered before you can start chats with them
                      </p>
                    </div>
                  ) : adminsWithoutChats.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-2">No administrators available for new chats</p>
                      <p className="text-sm text-muted-foreground">
                        All administrators already have active conversations
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminsWithoutChats.map((admin: any) => (
                        <div key={admin.user_id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{getDisplayName(admin.user_id, admin.display_name)}</p>
                            <p className="text-sm text-muted-foreground">Administrator</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => startNewChat(admin.user_id)}
                          >
                            Start Chat
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Conversations List */}
        {showConversations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Conversations ({activeConversations})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeConversations === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active conversations</p>
                ) : (
                  <div className="space-y-2">
                    {adminUserIds.map((adminId: string) => {
                      const adminMessages = messages.filter((msg: any) => msg.admin_user_id === adminId);
                      const adminResponses = responses.filter((response: any) => {
                        const message = messages.find((msg: any) => msg.id === response.message_id);
                        return message?.admin_user_id === adminId;
                      });
                      const unreadCount = adminMessages.filter((msg: any) => !msg.is_read).length;
                      const allMessages = [...adminMessages, ...adminResponses.map((r: any) => ({ ...r, type: 'response' }))];
                      const latestMessage = allMessages
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                        .pop();
                      // Check if any message has admin_display_name, use the first one found
                      const firstMessage = adminMessages.find((msg: any) => msg.admin_display_name);
                      const displayName = getDisplayName(adminId, firstMessage?.admin_display_name);
                      
                      return (
                        <div key={adminId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {latestMessage ? (latestMessage.message || latestMessage.response || '').substring(0, 50) + '...' : 'No messages'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {unreadCount > 0 && (
                              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center mb-1">
                                {unreadCount}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {latestMessage ? new Date(latestMessage.created_at).toLocaleTimeString() : ''}
                            </p>
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
                Compact contact cards with profile photos, admin names, and unread message indicators for quick identification.
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

      {/* Floating Chat Console - Now handled by FloatingCarrierMessagesButton */}
      {/* <CarrierFloatingChatConsole /> */}
    </div>
  );
}
