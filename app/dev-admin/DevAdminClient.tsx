"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Shield, 
  User, 
  Search, 
  Crown, 
  Truck, 
  Key, 
  Zap, 
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Gamepad2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useAccentColor } from "@/hooks/useAccentColor";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: "admin" | "carrier" | "none";
  createdAt: string;
  lastSignIn?: string;
  profileImageUrl?: string;
  hasImage?: boolean;
}

interface DevKeyResponse {
  valid: boolean;
  message: string;
}

export default function DevAdminClient() {
  const [devKey, setDevKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(true);
  
  const { accentColor } = useAccentColor();

  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };

  const verifyDevKey = async (key: string) => {
    try {
      const response = await fetch('/api/dev-admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devKey: key })
      });
      
      const result: DevKeyResponse = await response.json();
      
      if (result.valid) {
        setIsAuthenticated(true);
        setShowKeyDialog(false);
        toast.success("🔑 Dev Key Accepted! Welcome to the Admin Console");
        loadUsers();
      } else {
        toast.error("❌ Invalid Dev Key");
      }
    } catch (error) {
      toast.error("🚨 Error verifying dev key");
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      console.log("🔄 Loading users from API...");
      const response = await fetch('/api/dev-admin/users');
      console.log("📊 API Response Status:", response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log("📋 API Response Data:", userData);
        setUsers(userData.users || []);
        console.log("✅ Users loaded:", userData.users?.length || 0);
      } else {
        const errorData = await response.json();
        console.error("❌ API Error:", errorData);
        toast.error(`Failed to load users: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("❌ Network Error:", error);
      toast.error("Network error loading users");
    } finally {
      setIsLoading(false);
    }
  };

  const assignRole = async (userId: string, role: "admin" | "carrier") => {
    try {
      const response = await fetch('/api/dev-admin/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role })
      });
      
      if (response.ok) {
        toast.success(`🎯 Role assigned! User is now ${role}`);
        loadUsers();
        setSelectedUser(null);
      } else {
        toast.error("Failed to assign role");
      }
    } catch (error) {
      toast.error("Error assigning role");
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="w-4 h-4" />;
      case "carrier": return <Truck className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-500";
      case "carrier": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={showKeyDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center">
              <Gamepad2 className="h-6 w-6 text-purple-500" />
              Dev Console Access
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-xl font-bold">Admin Role Manager</h2>
              <p className="text-muted-foreground">Enter your dev key to access the admin console</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Dev Key</label>
              <Input
                type="password"
                placeholder="Enter dev key..."
                value={devKey}
                onChange={(e) => setDevKey(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyDevKey(devKey)}
              />
            </div>
            
            <Button
              onClick={() => verifyDevKey(devKey)}
              disabled={!devKey}
              className="w-full"
              style={{
                backgroundColor: accentColor,
                color: getButtonTextColor()
              }}
            >
              <Key className="w-4 h-4 mr-2" />
              Access Console
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-indigo-500/10 rounded-3xl blur-2xl"></div>
        <div className="relative bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm rounded-3xl p-8 border border-slate-700/50">
          <div className="text-8xl mb-6 animate-bounce">🎮</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent mb-4">
            Admin Role Manager
          </h1>
          <p className="text-xl text-slate-300 mb-2">Game-like interface for managing user roles</p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>System Online</span>
            <div className="w-1 h-1 bg-slate-500 rounded-full mx-2"></div>
            <span>{users.length} Users Connected</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-lg"></div>
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-purple-200 font-medium">Admins</p>
                  <p className="text-3xl font-bold text-white">
                    {users.filter(u => u.role === "admin").length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-purple-300">Power Users</div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-lg"></div>
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-200 font-medium">Carriers</p>
                  <p className="text-3xl font-bold text-white">
                    {users.filter(u => u.role === "carrier").length}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-300">Active Users</div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative bg-gradient-to-br from-slate-500/20 to-slate-600/20 border-slate-500/30 hover:border-slate-400/50 transition-all duration-300 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent rounded-lg"></div>
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gradient-to-r from-slate-500 to-slate-600 shadow-lg group-hover:shadow-slate-500/25 transition-all duration-300">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-white">{users.length}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">Registered</div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Controls */}
      <Card className="relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-600/40 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-indigo-500/5 rounded-lg"></div>
        <CardContent className="relative p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-1 w-full">
              <div className="p-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20">
                <Search className="w-5 h-5 text-purple-300" />
              </div>
              <Input
                placeholder="Search users by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-purple-400/50 focus:ring-purple-400/20 backdrop-blur-sm"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={loadUsers}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-300"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/dev-admin/test-clerk');
                    const data = await response.json();
                    console.log("🧪 Clerk Test Result:", data);
                    if (data.success) {
                      toast.success(`✅ Clerk API working! Found ${data.userCount} users`);
                    } else {
                      toast.error(`❌ Clerk API error: ${data.error}`);
                    }
                  } catch (error) {
                    toast.error("❌ Test failed");
                  }
                }}
                variant="outline"
                size="sm"
                className="border-blue-600/50 text-blue-300 hover:bg-blue-700/50 hover:border-blue-500 transition-all duration-300"
                title="Test Clerk API Connection"
              >
                <AlertTriangle className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/dev-admin/db-health');
                    const data = await response.json();
                    console.log("🗄️ DB Health Result:", data);
                    if (data.success) {
                      toast.success(`✅ DB OK! user_roles exists: ${data.userRolesTableExists}`);
                    } else {
                      toast.error(`❌ DB error: ${data.error}`);
                    }
                  } catch (error) {
                    toast.error("❌ DB test failed");
                  }
                }}
                variant="outline"
                size="sm"
                className="border-green-600/50 text-green-300 hover:bg-green-700/50 hover:border-green-500 transition-all duration-300"
                title="Check Database Health"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="relative mx-auto w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-300 text-lg">Loading users from Clerk...</p>
            <p className="text-slate-500 text-sm mt-1">Fetching latest user data</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-6">👥</div>
            <h3 className="text-2xl font-bold text-white mb-3">No Users Found</h3>
            <p className="text-slate-400 text-lg">
              {searchTerm ? "No users match your search criteria" : "No users found in Clerk"}
            </p>
            {searchTerm && (
              <Button
                onClick={() => setSearchTerm("")}
                variant="outline"
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="relative bg-gradient-to-r from-slate-800/60 to-slate-900/60 border-slate-600/40 hover:border-slate-500/60 transition-all duration-300 hover:scale-[1.02] group backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-indigo-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {user.hasImage && user.profileImageUrl ? (
                          <img 
                            src={user.profileImageUrl} 
                            alt="Profile" 
                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-600/50 shadow-lg group-hover:border-purple-400/50 transition-all duration-300"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                            {user.firstName?.[0] || user.email[0].toUpperCase()}
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800 ${getRoleColor(user.role)} flex items-center justify-center`}>
                          {getRoleIcon(user.role)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-200 transition-colors duration-300 truncate">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.email
                          }
                        </h3>
                        <p className="text-slate-400 text-xs mb-2 truncate">{user.email}</p>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={`${getRoleColor(user.role)} text-white px-2 py-1 text-xs font-medium shadow-lg`}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1 capitalize">{user.role}</span>
                          </Badge>
                          
                          {user.lastSignIn && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="truncate">{new Date(user.lastSignIn).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:scale-105 text-xs px-3"
                        onClick={() => setSelectedUser(user)}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Role Assignment Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-purple-500" />
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
                  {getRoleIcon(selectedUser.role)}
                  <span className="ml-1 capitalize">Current: {selectedUser.role}</span>
                </Badge>
                {selectedUser.lastSignIn && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last seen: {new Date(selectedUser.lastSignIn).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => assignRole(selectedUser.id, "admin")}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  disabled={selectedUser.role === "admin"}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Make Admin
                </Button>
                
                <Button
                  onClick={() => assignRole(selectedUser.id, "carrier")}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  disabled={selectedUser.role === "carrier"}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Make Carrier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
