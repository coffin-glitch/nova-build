"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/lib/clerk-roles";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Crown, RefreshCw, Search, Settings, Shield, Truck, User, X } from "lucide-react";
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
  
  const { user, isLoaded } = useUser();
  const buttonRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

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
    if (!isDragging && dragDuration > 10) {
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
      const response = await fetch('/api/clerk-roles?action=list');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        toast.error("Failed to load users");
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
      const response = await fetch('/api/clerk-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, role }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        loadUsers(); // Reload users
        setSelectedUser(null);
      } else {
        toast.error("Failed to assign role");
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
    console.log("🚫 FloatingDevAdminButton: Not rendering - not admin");
    console.log("📊 Current state - isAdmin:", isAdmin);
    return null;
  }

  console.log("✅ FloatingDevAdminButton: Rendering button");
  console.log("📊 Current state - isAdmin:", isAdmin);
  console.log("📍 Button position:", position);

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
              "h-16 w-16 rounded-full p-0 transition-all duration-200 ease-out",
              "bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700",
              "hover:from-purple-600 hover:via-purple-700 hover:to-purple-800",
              "shadow-2xl hover:shadow-3xl hover:scale-110",
              "border-2 border-purple-300/50 backdrop-blur-sm",
              "text-white font-bold",
              "cursor-move select-none",
              isDragging && "scale-105 cursor-grabbing"
            )}
            style={{ userSelect: 'none' }}
          >
            <Settings className="h-8 w-8" />
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
            <div className="h-full bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 rounded-3xl shadow-2xl border border-purple-500/20 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-indigo-500/10 border-b border-purple-500/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Dev Admin Console</h2>
                    <p className="text-purple-200">Manage user roles and system settings</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDevConsole(false)}
                  className="h-10 w-10 p-0 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Crown className="w-6 h-6 text-purple-400" />
                          <div>
                            <p className="text-sm text-purple-200">Admins</p>
                            <p className="text-2xl font-bold text-white">
                              {users.filter(u => u.role === "admin").length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Truck className="w-6 h-6 text-blue-400" />
                          <div>
                            <p className="text-sm text-blue-200">Carriers</p>
                            <p className="text-2xl font-bold text-white">
                              {users.filter(u => u.role === "carrier").length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-slate-500/20 to-slate-600/20 border-slate-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <User className="w-6 h-6 text-slate-400" />
                          <div>
                            <p className="text-sm text-slate-200">Total Users</p>
                            <p className="text-2xl font-bold text-white">{users.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search and Controls */}
                  <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-600/40">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Search className="w-5 h-5 text-purple-300" />
                          <Input
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400"
                          />
                        </div>
                        <Button
                          onClick={loadUsers}
                          disabled={isLoading}
                          variant="outline"
                          size="sm"
                          className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
                        >
                          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
                        <Card key={user.id} className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 border-slate-600/40">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  {user.hasImage && user.profileImageUrl ? (
                                    <img 
                                      src={user.profileImageUrl} 
                                      alt="Profile" 
                                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-600/50"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                      {user.firstName?.[0] || user.email[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800 ${getRoleColor(user.role)} flex items-center justify-center`}>
                                    {getRoleIcon(user.role)}
                                  </div>
                                </div>
                                <div>
                                  <h3 className="font-bold text-white">
                                    {user.firstName && user.lastName 
                                      ? `${user.firstName} ${user.lastName}` 
                                      : user.email
                                    }
                                  </h3>
                                  <p className="text-slate-400 text-sm">{user.email}</p>
                                  <Badge className={`${getRoleColor(user.role)} text-white px-2 py-1 text-xs mt-1`}>
                                    {user.role}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(user)}
                                className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
                              >
                                <Shield className="w-4 h-4 mr-1" />
                                Manage
                              </Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-white flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
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

              <div className="space-y-3">
                <Button
                  onClick={() => assignRole(selectedUser.id, "admin")}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  disabled={isLoading || selectedUser.role === "admin"}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Make Admin
                </Button>
                <Button
                  onClick={() => assignRole(selectedUser.id, "carrier")}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  disabled={isLoading || selectedUser.role === "carrier"}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Make Carrier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
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
