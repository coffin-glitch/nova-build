"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/hooks/useUnifiedRole";
import { cn } from "@/lib/utils";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { Crown, RefreshCw, Search, Settings, Shield, Truck, User, X, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function FloatingDevAdminButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 1200, y: 100 }); // Safe default for SSR
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const isAdmin = useIsAdmin();
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [devKey, setDevKey] = useState("");
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  
  // Dev Admin Console State
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeUser, setWipeUser] = useState<any>(null);
  const [isWiping, setIsWiping] = useState(false);
  
  const { user, isLoaded } = useUnifiedUser();
  const buttonRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // Check if current user is the main admin (duke@novafreight.io)
  const isMainAdmin = user?.email === 'duke@novafreight.io';

  // Set initial position on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 100, y: 100 });
    }
  }, []);

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
    const maxX = window.innerWidth - 64; // 64px for button width
    const maxY = window.innerHeight - 64; // 64px for button height
    
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
    console.log("🔍 Button clicked! isDragging:", isDragging, "dragDuration:", Date.now() - dragStartTime);
    const dragDuration = Date.now() - dragStartTime;
    // Only open console if not dragging and enough time has passed since drag start
    if (!isDragging && dragDuration < 200) {
      if (isAdmin) {
        // Admin users can access directly
        console.log("🎯 Admin user clicking button - opening floating dev console");
        setShowDevConsole(true);
        loadUsers();
      } else {
        // Non-admin users need to enter dev key
        console.log("🔑 Non-admin user clicking button - showing key dialog");
        setShowKeyDialog(true);
      }
    } else {
      console.log("❌ Click ignored - dragging or too soon");
    }
  };

  const verifyDevKey = async () => {
    if (!devKey.trim()) {
      setKeyError("Please enter a dev key");
      return;
    }

    console.log("🔑 Frontend: Starting dev key verification...");
    console.log("🔑 Frontend: Key to verify:", devKey);

    setIsVerifyingKey(true);
    setKeyError("");

    try {
      const response = await fetch('/api/dev-admin/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: devKey }),
      });

      console.log("📡 Frontend: Response status:", response.status);
      const data = await response.json();
      console.log("📡 Frontend: Response data:", data);

      if (data.success) {
        console.log("✅ Frontend: Dev key verification successful");
        // Key is valid, open floating dev console
        setShowDevConsole(true);
        setIsAuthenticated(true);
        setShowKeyDialog(false);
        setDevKey("");
        loadUsers();
      } else {
        console.log("❌ Frontend: Dev key verification failed");
        setKeyError(data.error || "Invalid dev key");
      }
    } catch (error) {
      console.error("❌ Frontend: Dev key verification error:", error);
      setKeyError("Failed to verify dev key");
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyDevKey();
    }
  };

  // Dev Admin Functions
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Use Supabase admin users API
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // The API returns { ok: true, data: [...] }
        const usersList = data.data || data.users || [];
        // Transform Supabase users to expected format
        const transformedUsers = usersList.map((user: any) => ({
          id: user.user_id || user.supabase_user_id,
          supabase_user_id: user.supabase_user_id,
          email: user.email || user.user_id || '', // Use email from cache
          firstName: user.contact_name?.split(' ')[0] || user.firstName || '',
          lastName: user.contact_name?.split(' ').slice(1).join(' ') || user.lastName || '',
          role: user.role || 'carrier',
        }));
        console.log('📊 Loaded users:', transformedUsers.length, transformedUsers);
        setUsers(transformedUsers);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to load users");
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const assignRole = async (userId: string, role: "admin" | "carrier") => {
    setIsLoading(true);
    try {
      // Use Supabase admin users API for role assignment
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          user_id: userId, 
          role: role 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || `User role updated to ${role}`);
        loadUsers(); // Reload users
        setSelectedUser(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to assign role");
      }
    } catch (error) {
      console.error("Error assigning role:", error);
      toast.error("Failed to assign role");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-500';
      case 'carrier': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-3 h-3 text-white" />;
      case 'carrier': return <Truck className="w-3 h-3 text-white" />;
      default: return <User className="w-3 h-3 text-white" />;
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Don't render if not admin
  if (!isAdmin) {
    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log("🚫 FloatingDevAdminButton: Not rendering - not admin");
      console.log("📊 Current state - isAdmin:", isAdmin);
    }
    return null;
  }

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log("✅ FloatingDevAdminButton: Rendering button");
    console.log("📊 Current state - isAdmin:", isAdmin);
    console.log("📍 Button position:", position);
  }

  return (
    <>
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        {/* Floating Dev Admin Button */}
        <div
          ref={buttonRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "relative cursor-move select-none",
            isDragging && "cursor-grabbing"
          )}
        >
          <Button
            onClick={handleButtonClick}
            className={cn(
              "h-16 w-16 rounded-full p-0 transition-all duration-300 ease-out",
              "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700",
              "hover:from-violet-600 hover:via-purple-700 hover:to-indigo-800",
              "shadow-2xl hover:shadow-4xl hover:scale-110",
              "border-2 border-violet-300/60 backdrop-blur-md",
              "text-white font-bold",
              "cursor-move select-none",
              "ring-2 ring-violet-500/20 hover:ring-violet-400/40",
              "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-white/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
              isDragging && "scale-105 cursor-grabbing"
            )}
            style={{ userSelect: 'none' }}
          >
            <Settings className="h-8 w-8 drop-shadow-lg" />
          </Button>
        </div>
      </div>

      {/* Dev Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-white flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Dev Admin Access
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                <Settings className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Enter Dev Key</h3>
              <p className="text-muted-foreground text-sm">
                Access the dev admin console with your developer key
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Enter dev key..."
                value={devKey}
                onChange={(e) => setDevKey(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full"
                disabled={isVerifyingKey}
              />
              
              {keyError && (
                <p className="text-red-500 text-sm text-center">{keyError}</p>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={verifyDevKey}
                  disabled={!devKey.trim() || isVerifyingKey}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                >
                  {isVerifyingKey ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Access Dev Admin
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowKeyDialog(false);
                    setDevKey("");
                    setKeyError("");
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Dev Admin Console */}
      {showDevConsole && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={() => setShowDevConsole(false)}
          />
          
          {/* Dev Console */}
          <div className="fixed inset-4 z-50 animate-in slide-in-from-bottom-4 duration-500 ease-out">
            <div className="h-full bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 rounded-3xl shadow-2xl border border-violet-500/30 overflow-hidden flex flex-col backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-indigo-500/20 border-b border-violet-500/30 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full shadow-lg ring-2 ring-violet-400/30">
                    <Settings className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-violet-200 to-purple-200 bg-clip-text text-transparent">
                      Dev Admin Console
                    </h2>
                    <p className="text-violet-200/80 text-sm font-medium">Manage user roles and system settings</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDevConsole(false)}
                  className="h-10 w-10 p-0 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 ring-1 ring-red-500/20 hover:ring-red-400/40"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-violet-500/20 to-purple-600/20 border-violet-500/40 backdrop-blur-sm hover:border-violet-400/60 transition-all duration-300 hover:scale-105 group">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg group-hover:shadow-violet-500/25 transition-all duration-300">
                            <Crown className="w-6 h-6 text-white drop-shadow-lg" />
                          </div>
                          <div>
                            <p className="text-sm text-violet-200/80 font-medium">Admins</p>
                            <p className="text-3xl font-bold text-white bg-gradient-to-r from-violet-200 to-purple-200 bg-clip-text text-transparent">
                              {users.filter(u => u.role === "admin").length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border-blue-500/40 backdrop-blur-sm hover:border-blue-400/60 transition-all duration-300 hover:scale-105 group">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                            <Truck className="w-6 h-6 text-white drop-shadow-lg" />
                          </div>
                          <div>
                            <p className="text-sm text-blue-200/80 font-medium">Carriers</p>
                            <p className="text-3xl font-bold text-white bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
                              {users.filter(u => u.role === "carrier").length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-slate-500/20 to-gray-600/20 border-slate-500/40 backdrop-blur-sm hover:border-slate-400/60 transition-all duration-300 hover:scale-105 group">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl shadow-lg group-hover:shadow-slate-500/25 transition-all duration-300">
                            <User className="w-6 h-6 text-white drop-shadow-lg" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-200/80 font-medium">Total Users</p>
                            <p className="text-3xl font-bold text-white bg-gradient-to-r from-slate-200 to-gray-200 bg-clip-text text-transparent">
                              {users.length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search and Controls */}
                  <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-600/30 backdrop-blur-sm hover:border-slate-500/50 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-lg border border-violet-500/30">
                            <Search className="w-5 h-5 text-violet-300" />
                          </div>
                          <Input
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all duration-300"
                          />
                        </div>
                        <Button
                          onClick={loadUsers}
                          disabled={isLoading}
                          variant="outline"
                          size="sm"
                          className="border-violet-500/50 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/60 transition-all duration-300 px-4"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Users List */}
                  <div className="space-y-3">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-slate-300 mt-2">Loading users...</p>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-400">No users found</p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <Card key={user.id} className="bg-gradient-to-r from-slate-800/40 to-slate-900/40 border-slate-600/30 backdrop-blur-sm hover:border-slate-500/50 transition-all duration-300 hover:scale-[1.02] group">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  {user.hasImage && user.profileImageUrl ? (
                                    <img 
                                      src={user.profileImageUrl} 
                                      alt="Profile" 
                                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-600/50 shadow-lg group-hover:border-violet-500/50 transition-all duration-300"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:shadow-violet-500/25 transition-all duration-300">
                                      {user.firstName?.[0] || user.email[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-800 ${getRoleColor(user.role)} flex items-center justify-center shadow-lg`}>
                                    {getRoleIcon(user.role)}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-white text-lg group-hover:text-violet-200 transition-colors duration-300">
                                    {user.firstName && user.lastName 
                                      ? `${user.firstName} ${user.lastName}` 
                                      : user.email
                                    }
                                  </h3>
                                  <p className="text-slate-400 text-sm mb-2">{user.email}</p>
                                  <Badge className={`${getRoleColor(user.role)} text-white px-3 py-1 text-xs font-medium shadow-sm`}>
                                    {user.role}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedUser(user)}
                                  className="border-violet-500/50 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/60 transition-all duration-300 px-4"
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Manage
                                </Button>
                                {isMainAdmin && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setWipeUser(user)}
                                    className="border-red-500/50 text-red-300 hover:bg-red-500/20 hover:border-red-400/60 transition-all duration-300 px-4"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Wipe All
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Role Assignment Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-violet-900 to-indigo-900 border-violet-500/30 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-white flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-violet-200 to-purple-200 bg-clip-text text-transparent">
              <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-lg border border-violet-500/30">
                <Shield className="w-5 h-5 text-violet-300" />
              </div>
              Assign Role
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="text-center">
                {selectedUser.hasImage && selectedUser.profileImageUrl ? (
                  <img 
                    src={selectedUser.profileImageUrl} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover border-4 border-slate-300 mx-auto mb-3"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                    {selectedUser.firstName?.[0] || selectedUser.email[0].toUpperCase()}
                  </div>
                )}
                <h3 className="text-lg font-semibold">
                  {selectedUser.firstName && selectedUser.lastName 
                    ? `${selectedUser.firstName} ${selectedUser.lastName}` 
                    : selectedUser.email
                  }
                </h3>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <Badge className={`${getRoleColor(selectedUser.role)} text-white mt-2`}>
                  Current: {selectedUser.role}
                </Badge>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => assignRole(selectedUser.id, "admin")}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg hover:shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || selectedUser.role === "admin"}
                >
                  <Crown className="w-4 h-4 mr-2 drop-shadow-sm" />
                  Make Admin
                </Button>
                <Button
                  onClick={() => assignRole(selectedUser.id, "carrier")}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || selectedUser.role === "carrier"}
                >
                  <Truck className="w-4 h-4 mr-2 drop-shadow-sm" />
                  Make Carrier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  className="w-full border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all duration-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wipe All Dialog */}
      <Dialog open={!!wipeUser} onOpenChange={() => setWipeUser(null)}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-red-900 to-orange-900 border-red-500/30 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-white flex items-center justify-center gap-2 text-xl font-bold bg-gradient-to-r from-red-200 to-orange-200 bg-clip-text text-transparent">
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-orange-600/20 rounded-lg border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-300" />
              </div>
              Wipe User Data
            </DialogTitle>
          </DialogHeader>
          
          {wipeUser && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                  {wipeUser.firstName?.[0] || wipeUser.email[0].toUpperCase()}
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {wipeUser.firstName && wipeUser.lastName 
                    ? `${wipeUser.firstName} ${wipeUser.lastName}` 
                    : wipeUser.email
                  }
                </h3>
                <p className="text-red-200/80">{wipeUser.email}</p>
                <Badge className={`${getRoleColor(wipeUser.role)} text-white mt-2`}>
                  {wipeUser.role}
                </Badge>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-2">
                <p className="text-red-200 text-sm font-semibold">⚠️ Warning: Destructive Actions</p>
                <p className="text-red-200/70 text-xs">
                  These actions cannot be undone. All user data will be permanently removed.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    setIsWiping(true);
                    try {
                      const response = await fetch('/api/admin/users', {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: { 
                          'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({ 
                          user_id: wipeUser.id, 
                          action: 'wipe' 
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        toast.success(result.message || 'All user data wiped successfully');
                        loadUsers();
                        setWipeUser(null);
                      } else {
                        const errorData = await response.json().catch(() => ({}));
                        toast.error(errorData.error || "Failed to wipe user data");
                      }
                    } catch (error) {
                      console.error("Error wiping user data:", error);
                      toast.error("Failed to wipe user data");
                    } finally {
                      setIsWiping(false);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isWiping}
                >
                  <Trash2 className="w-4 h-4 mr-2 drop-shadow-sm" />
                  {isWiping ? 'Wiping Data...' : 'Clear All Data'}
                </Button>
                <Button
                  onClick={async () => {
                    if (!confirm(`⚠️ PERMANENT DELETE: Are you absolutely sure you want to permanently delete ${wipeUser.email}? This will:\n\n- Delete ALL user data\n- Remove from Supabase Auth\n- Remove from user_roles_cache\n\nThis action CANNOT be undone!`)) {
                      return;
                    }
                    
                    setIsWiping(true);
                    try {
                      const response = await fetch('/api/admin/users', {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: { 
                          'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({ 
                          user_id: wipeUser.id, 
                          action: 'delete' 
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        toast.success(result.message || 'User account permanently deleted');
                        loadUsers();
                        setWipeUser(null);
                      } else {
                        const errorData = await response.json().catch(() => ({}));
                        toast.error(errorData.error || "Failed to delete user account");
                      }
                    } catch (error) {
                      console.error("Error deleting user account:", error);
                      toast.error("Failed to delete user account");
                    } finally {
                      setIsWiping(false);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isWiping}
                >
                  <AlertTriangle className="w-4 h-4 mr-2 drop-shadow-sm" />
                  {isWiping ? 'Deleting Account...' : 'Delete Account Permanently'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setWipeUser(null)}
                  className="w-full border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50 transition-all duration-300"
                  disabled={isWiping}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
