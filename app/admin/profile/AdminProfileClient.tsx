"use client";

import { useState, useEffect } from "react";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  FileText,
  Bell,
  Palette,
  Globe,
  Save,
  Edit,
  X,
  Shield,
  BarChart3,
  Users,
  Truck,
  MessageSquare,
  Archive,
  Gavel,
  Loader2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AdminProfile {
  supabase_user_id: string;
  display_name: string | null;
  display_email: string | null;
  display_phone: string | null;
  title: string | null;
  department: string | null;
  bio: string | null;
  preferred_contact_method: string;
  notification_preferences: Record<string, any>;
  avatar_url: string | null;
  theme_preference: string;
  language_preference: string;
  system_email: string | null;
  account_created_at: string | null;
}

export function AdminProfileClient() {
  const { user, isLoaded } = useUnifiedUser();
  const { user: supabaseUser, supabase, loading: supabaseLoading } = useSupabase();
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; data: AdminProfile }>(
    "/api/admin/profile",
    fetcher
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<AdminProfile>>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionFormData, setSectionFormData] = useState<Partial<AdminProfile>>({});
  
  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'request' | 'verify' | 'change'>('request');
  const [emailCode, setEmailCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const profile = data?.data;

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        display_email: profile.display_email || "",
        display_phone: profile.display_phone || "",
        title: profile.title || "",
        department: profile.department || "",
        bio: profile.bio || "",
        preferred_contact_method: profile.preferred_contact_method || "email",
        theme_preference: profile.theme_preference || "system",
        language_preference: profile.language_preference || "en",
      });
    }
  }, [profile]);

  const handleSave = async (sectionData?: Partial<AdminProfile>) => {
    setIsSaving(true);
    try {
      const dataToSave = sectionData || formData;
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
        setEditingSection(null);
        setSectionFormData({});
        mutate();
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        display_email: profile.display_email || "",
        display_phone: profile.display_phone || "",
        title: profile.title || "",
        department: profile.department || "",
        bio: profile.bio || "",
        preferred_contact_method: profile.preferred_contact_method || "email",
        theme_preference: profile.theme_preference || "system",
        language_preference: profile.language_preference || "en",
      });
    }
    setIsEditing(false);
    setEditingSection(null);
    setSectionFormData({});
  };

  const handleEditSection = (section: string) => {
    if (!profile) return;
    
    // Initialize section-specific form data with current profile values
    // Use the same values that are displayed (with fallbacks)
    const sectionData: Partial<AdminProfile> = {};
    
    switch (section) {
      case 'header':
        // Use displayed value or fallback to system_email
        sectionData.display_name = profile.display_name || profile.system_email || "";
        sectionData.title = profile.title || "";
        sectionData.department = profile.department || "";
        sectionData.bio = profile.bio || "";
        break;
      case 'contact':
        // Use displayed values with fallbacks
        sectionData.display_name = profile.display_name || profile.system_email || "";
        sectionData.display_email = profile.display_email || profile.system_email || "";
        sectionData.display_phone = profile.display_phone || "";
        sectionData.preferred_contact_method = profile.preferred_contact_method || "email";
        break;
      case 'preferences':
        sectionData.theme_preference = profile.theme_preference || "system";
        sectionData.language_preference = profile.language_preference || "en";
        break;
    }
    
    setSectionFormData(sectionData);
    setEditingSection(section);
  };

  const handleSaveSection = async (section: string) => {
    // Merge section data with current profile data to preserve other fields
    const currentProfileData = {
      display_name: profile?.display_name || "",
      display_email: profile?.display_email || "",
      display_phone: profile?.display_phone || "",
      title: profile?.title || "",
      department: profile?.department || "",
      bio: profile?.bio || "",
      preferred_contact_method: profile?.preferred_contact_method || "email",
      theme_preference: profile?.theme_preference || "system",
      language_preference: profile?.language_preference || "en",
    };
    
    // Merge with section-specific changes
    const updatedData = { ...currentProfileData, ...sectionFormData };
    await handleSave(updatedData);
  };

  const handleCancelSection = () => {
    setEditingSection(null);
    setSectionFormData({});
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "AD";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user signed in with Google OAuth
  const isGoogleUser = supabaseUser?.app_metadata?.provider === 'google' || 
                       supabaseUser?.identities?.some((id: any) => id.provider === 'google');
  
  // Check if user has email/password auth (Supabase native)
  const hasPasswordAuth = supabaseUser?.app_metadata?.provider === 'email' || 
                          supabaseUser?.identities?.some((id: any) => id.provider === 'email');

  const handleRequestPasswordChange = async () => {
    if (!supabaseUser?.email) {
      toast.error("Email address not found");
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      const { error } = await supabase.auth.signInWithOtp({
        email: supabaseUser.email,
        options: {
          shouldCreateUser: false
        }
      });
      
      if (error) throw error;
      
      setCodeSent(true);
      setPasswordStep('verify');
      toast.success("Verification code sent to your email. Check your inbox for the 6-digit code.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setPasswordLoading(false);
    }
  };
  
  const handleVerifyCode = async () => {
    if (!supabaseUser?.email || !emailCode) {
      toast.error("Please enter the verification code");
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: supabaseUser.email!,
        token: emailCode,
        type: 'email'
      });
      
      if (verifyError) throw verifyError;
      
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin || 'https://novabuild.io';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(supabaseUser.email!, {
        redirectTo: `${baseUrl}/admin/profile?passwordReset=true`
      });
      
      if (resetError) throw resetError;
      
      setShowPasswordDialog(false);
      setPasswordStep('request');
      setEmailCode("");
      setCodeSent(false);
      toast.success("Code verified! Check your email for the password change link.");
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
    } finally {
      setPasswordLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast.success("Password changed successfully!");
      setShowPasswordDialog(false);
      setPasswordStep('request');
      setEmailCode("");
      setNewPassword("");
      setConfirmPassword("");
      setCodeSent(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };
  
  // Listen for password recovery event
  useEffect(() => {
    if (!supabase) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordDialog(true);
        setPasswordStep('change');
        toast.info("Enter your new password");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [supabase]);
  
  // Check URL for password reset parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('passwordReset') === 'true') {
        setShowPasswordDialog(true);
        setPasswordStep('change');
        window.history.replaceState({}, '', '/admin/profile');
      }
    }
  }, []);

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Content Container with Curved Edges and Theme Border */}
        <div className="rounded-3xl p-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 dark:from-blue-600 dark:via-indigo-600 dark:to-blue-600 shadow-2xl">
          <div className="rounded-3xl bg-gradient-to-br from-white/95 via-blue-50/70 to-white/95 dark:from-slate-900/95 dark:via-slate-800/70 dark:to-slate-900/95 backdrop-blur-md p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Admin Profile
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your profile settings and preferences
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header Card */}
            <Card className="border-2 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Profile Information</CardTitle>
                {editingSection !== 'header' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditSection('header')}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelSection}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveSection('header')}
                      disabled={isSaving}
                      className="h-8 w-8 p-0"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-8 pt-0">
                <div className="flex items-start gap-6">
                  <Avatar className="w-24 h-24 border-4 border-primary/20">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {getInitials(profile?.display_name || profile?.system_email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold">
                        {editingSection === 'header' ? (
                          <Input
                            value={sectionFormData.display_name ?? ""}
                            onChange={(e) =>
                              setSectionFormData({ ...sectionFormData, display_name: e.target.value })
                            }
                            placeholder="Display Name"
                            className="text-3xl font-bold border-0 border-b-2 rounded-none px-0"
                          />
                        ) : (
                          profile?.display_name || profile?.system_email || "Administrator"
                        )}
                      </h2>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    </div>
                    {editingSection === 'header' ? (
                      <Input
                        value={sectionFormData.title ?? ""}
                        onChange={(e) =>
                          setSectionFormData({ ...sectionFormData, title: e.target.value })
                        }
                        placeholder="Title (e.g., Senior Administrator)"
                        className="mt-2"
                      />
                    ) : (
                      profile?.title && (
                        <p className="text-lg text-muted-foreground">{profile.title}</p>
                      )
                    )}
                    {editingSection === 'header' ? (
                      <Input
                        value={sectionFormData.department ?? ""}
                        onChange={(e) =>
                          setSectionFormData({ ...sectionFormData, department: e.target.value })
                        }
                        placeholder="Department"
                        className="mt-2"
                      />
                    ) : (
                      profile?.department && (
                        <p className="text-muted-foreground">{profile.department}</p>
                      )
                    )}
                  </div>
                </div>
                {editingSection === 'header' ? (
                  <Textarea
                    value={sectionFormData.bio ?? ""}
                    onChange={(e) =>
                      setSectionFormData({ ...sectionFormData, bio: e.target.value })
                    }
                    placeholder="Bio / Description"
                    className="mt-6"
                    rows={3}
                  />
                ) : (
                  profile?.bio && (
                    <p className="mt-6 text-muted-foreground">{profile.bio}</p>
                  )
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Your contact details (masked from system data)
                  </CardDescription>
                </div>
                {editingSection !== 'contact' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditSection('contact')}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelSection}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveSection('contact')}
                      disabled={isSaving}
                      className="h-8 w-8 p-0"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  {editingSection === 'contact' ? (
                    <Input
                      value={sectionFormData.display_name ?? ""}
                      onChange={(e) =>
                        setSectionFormData({ ...sectionFormData, display_name: e.target.value })
                      }
                      placeholder="Your display name"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">
                      {profile?.display_name || profile?.system_email || "Not set"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    This is how your name appears throughout the system
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Display Email</Label>
                    {editingSection === 'contact' ? (
                      <Input
                        value={sectionFormData.display_email ?? ""}
                        onChange={(e) =>
                          setSectionFormData({ ...sectionFormData, display_email: e.target.value })
                        }
                        type="email"
                        placeholder="your.email@example.com"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">
                        {profile?.display_email || profile?.system_email || "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Display Phone</Label>
                    {editingSection === 'contact' ? (
                      <Input
                        value={sectionFormData.display_phone ?? ""}
                        onChange={(e) =>
                          setSectionFormData({ ...sectionFormData, display_phone: e.target.value })
                        }
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">
                        {profile?.display_phone || "Not set"}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Preferred Contact Method</Label>
                  {editingSection === 'contact' ? (
                    <Select
                      value={sectionFormData.preferred_contact_method ?? "email"}
                      onValueChange={(value) =>
                        setSectionFormData({ ...sectionFormData, preferred_contact_method: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm font-medium mt-1 capitalize">
                      {profile?.preferred_contact_method || "email"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Preferences
                </CardTitle>
                {editingSection !== 'preferences' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditSection('preferences')}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelSection}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveSection('preferences')}
                      disabled={isSaving}
                      className="h-8 w-8 p-0"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Theme Preference</Label>
                    {editingSection === 'preferences' ? (
                      <Select
                        value={sectionFormData.theme_preference ?? "system"}
                        onValueChange={(value) =>
                          setSectionFormData({ ...sectionFormData, theme_preference: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium mt-1 capitalize">
                        {profile?.theme_preference || "system"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Language</Label>
                    {editingSection === 'preferences' ? (
                      <Select
                        value={sectionFormData.language_preference ?? "en"}
                        onValueChange={(value) =>
                          setSectionFormData({ ...sectionFormData, language_preference: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium mt-1">
                        {profile?.language_preference || "en"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">System Email</Label>
                  <p className="text-sm font-medium mt-1">
                    {profile?.system_email || "Not available"}
                  </p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Account Created</Label>
                  <p className="text-sm font-medium mt-1">
                    {profile?.account_created_at
                      ? new Date(profile.account_created_at).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : "Not available"}
                  </p>
                </div>
                {hasPasswordAuth && (
                  <>
                    <Separator />
                    <Button
                      onClick={() => setShowPasswordDialog(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common admin tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/users">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Carriers
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/bids">
                    <Truck className="w-4 h-4 mr-2" />
                    Manage Bids
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/manage-loads">
                    <FileText className="w-4 h-4 mr-2" />
                    Manage Loads
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/messages">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Messages
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/archive-bids">
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Bids
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin/bids">
                    <Gavel className="w-4 h-4 mr-2" />
                    Adjudication Console
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/admin">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
          </div>
        </div>
      </div>
      
      {/* Change Password Dialog */}
      {hasPasswordAuth && (
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </DialogTitle>
              <DialogDescription>
                {passwordStep === 'request' && "We'll send a 6-digit verification code to your email to confirm your identity. Check your inbox for the code."}
                {passwordStep === 'verify' && 'Enter the 6-digit verification code from your email. After verification, you\'ll receive a password change link via email.'}
                {passwordStep === 'change' && 'Enter your new password. Make sure it meets the security requirements (minimum 8 characters).'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {passwordStep === 'request' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    A verification code will be sent to <strong>{supabaseUser?.email}</strong>
                  </p>
                  <Button
                    onClick={handleRequestPasswordChange}
                    disabled={passwordLoading}
                    className="w-full"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Verification Code
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {passwordStep === 'verify' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="text-center text-2xl font-mono tracking-widest"
                      style={{ letterSpacing: '0.5em' }}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Enter the 6-digit code from your email. The code expires in 15 minutes.
                    </p>
                  </div>
                  <Button
                    onClick={handleVerifyCode}
                    disabled={passwordLoading || !emailCode || emailCode.length !== 6}
                    className="w-full"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPasswordStep('request');
                      setEmailCode("");
                      setCodeSent(false);
                    }}
                    className="w-full text-sm"
                  >
                    Resend Code
                  </Button>
                </div>
              )}
              
              {passwordStep === 'change' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    className="w-full"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPasswordStep('request');
                  setEmailCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setCodeSent(false);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

