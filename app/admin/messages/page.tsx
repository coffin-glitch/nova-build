"use client";

// import FloatingChatConsole from "@/components/ui/FloatingChatConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnifiedRole } from "@/hooks/useUnifiedRole";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { Clock, MessageCircle, User, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AdminMessagesPage() {
  const { user, isLoaded } = useUnifiedUser();
  const { isAdmin, isLoading: roleLoading } = useUnifiedRole();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showConversations, setShowConversations] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // Fetch conversations data (new unified system)
  const { data: conversationsData } = useSWR(
    user && isAdmin ? "/api/admin/conversations" : null,
    fetcher,
    { refreshInterval: 10000 }
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

  const conversations = conversationsData?.data || [];
  const carriers = Array.isArray(carriersData) ? carriersData : [];
  const admins = Array.isArray(adminsData) ? adminsData.filter((admin: any) => admin.user_id !== user?.id) : [];

  // Get unique user IDs from conversations (both carriers and admins)
  const allUserIds = Array.from(new Set(
    conversations.map((conv: any) => conv.other_user_id || conv.carrier_user_id).filter(Boolean)
  ));

  // Fetch user information for all users (carriers and admins)
  const { data: userInfos = {} } = useSWR(
    allUserIds.length > 0 ? `/api/users/batch?ids=${allUserIds.join(',')}` : null,
    fetcher
  );

  // Helper function to get display name
  const getDisplayName = (userId: string): string => {
    const userInfo = userInfos[userId];
    if (!userInfo) return userId;
    
    if (userInfo.fullName) return userInfo.fullName;
    if (userInfo.firstName && userInfo.lastName) return `${userInfo.firstName} ${userInfo.lastName}`;
    if (userInfo.firstName) return userInfo.firstName;
    if (userInfo.username) return userInfo.username;
    if (userInfo.emailAddresses?.[0]?.emailAddress) return userInfo.emailAddresses[0].emailAddress;
    
    return userId;
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
      alert(error.message || 'Failed to start new chat. Please try again.');
    }
  };

  useEffect(() => {
    if (!isLoaded || roleLoading) return;

    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Check if user is admin - useUnifiedRole handles this with Supabase auth
    // Wait for role to load before checking
    if (!roleLoading && !isAdmin) {
      router.push('/forbidden');
      return;
    }

    // Only set loading to false if we have a user and role is loaded
    if (user && !roleLoading) {
      setIsLoading(false);
    }
  }, [user, isLoaded, isAdmin, roleLoading, router]);

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
                      const otherUserId = conv.other_user_id || conv.carrier_user_id;
                      const displayName = getDisplayName(otherUserId);
                      const unreadCount = conv.unread_count || 0;
                      const conversationType = conv.conversation_with_type || 'carrier';
                      
                      return (
                        <div key={conv.conversation_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {conversationType === 'admin' ? 'Admin' : 'Carrier'} • {otherUserId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {conv.last_message ? (
                                  (conv.last_message_sender_type === 'admin' && conv.supabase_admin_user_id === user?.id) || 
                                  (conv.last_message_sender_type === 'carrier' && conversationType === 'admin' && conv.carrier_user_id === user?.id)
                                    ? 'You: ' : ''
                                ) + conv.last_message.substring(0, 50) + '...' : 'No messages'}
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
                              {conv.last_message_timestamp || conv.last_message_at 
                                ? new Date(conv.last_message_timestamp || conv.last_message_at).toLocaleTimeString() 
                                : ''}
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
                                  <p className="font-medium">{getDisplayName(adminId)}</p>
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
