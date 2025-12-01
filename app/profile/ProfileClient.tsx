"use client";

import FavoritesConsole from "@/components/carrier/FavoritesConsole";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useUnifiedUser } from "@/hooks/useUnifiedUser";
import {
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Shield,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface NotificationPreferences {
  emailNotifications: boolean;
  similarLoadNotifications: boolean;
  toastNotifications?: boolean;
  textNotifications?: boolean;
  urgentContactPreference?: string;
  urgentContactEmail?: boolean;
  urgentContactPhone?: boolean;
  [key: string]: any;
}

export default function ProfileClient() {
  const { user, supabase, loading: supabaseLoading } = useSupabase();
  const { user: unifiedUser, isLoading: userLoading } = useUnifiedUser();
  const { accentColor, accentColorStyle } = useAccentColor();
  
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
  
  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    emailNotifications: true,
    similarLoadNotifications: true,
    toastNotifications: true,
    textNotifications: false,
    urgentContactPreference: 'email',
    urgentContactEmail: true,
    urgentContactPhone: false
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showFavoritesConsole, setShowFavoritesConsole] = useState(false);
  
  // Fetch carrier profile data
  const { data: profileData, mutate: mutateProfile } = useSWR(
    '/api/carrier/profile',
    fetcher,
    { revalidateOnFocus: false }
  );
  
  // Fetch notification preferences
  const { data: notifData, mutate: mutateNotif } = useSWR(
    '/api/carrier/notification-preferences',
    fetcher,
    { revalidateOnFocus: false }
  );
  
  useEffect(() => {
    if (notifData?.data) {
      const urgentPref = notifData.data.urgentContactPreference ?? 'email';
      setNotificationPrefs(prev => ({
        ...prev,
        ...notifData.data,
        toastNotifications: notifData.data.toastNotifications ?? true,
        textNotifications: notifData.data.textNotifications ?? false,
        urgentContactPreference: urgentPref,
        urgentContactEmail: notifData.data.urgentContactEmail ?? (urgentPref === 'email' || urgentPref === 'both'),
        urgentContactPhone: notifData.data.urgentContactPhone ?? (urgentPref === 'phone' || urgentPref === 'both')
      }));
    }
  }, [notifData]);
  
  // Check if user signed in with Google OAuth
  const isGoogleUser = user?.app_metadata?.provider === 'google' || 
                       user?.identities?.some((id: any) => id.provider === 'google');
  
  // Check if user has email/password auth (Supabase native)
  const hasPasswordAuth = user?.app_metadata?.provider === 'email' || 
                          user?.identities?.some((id: any) => id.provider === 'email');
  
  const handleRequestPasswordChange = async () => {
    if (!user?.email) {
      toast.error("Email address not found");
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      // Send OTP code to email for verification
      // Using signInWithOtp with shouldCreateUser: false works for logged-in users too
      // This ensures consistent behavior and proper email template usage
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
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
    if (!user?.email || !emailCode) {
      toast.error("Please enter the verification code");
      return;
    }
    
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      // Verify the OTP code
      // Using type 'email' since we're using signInWithOtp (not reauthenticate)
      // This ensures the code verification works correctly
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user.email!,
        token: emailCode,
        type: 'email'
      });
      
      if (verifyError) throw verifyError;
      
      // After successful verification, send password reset link
      // This will send an email with a link to change the password
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin || 'https://novabuild.io';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email!, {
        redirectTo: `${baseUrl}/profile?passwordReset=true`
      });
      
      if (resetError) throw resetError;
      
      // Close dialog and show success message
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
      
      // Update password (this is called when user returns from password reset link)
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
  
  // Listen for password recovery event (when user clicks reset link)
  useEffect(() => {
    if (!supabase) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked password reset link, show password change dialog
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
        // User returned from password reset link
        setShowPasswordDialog(true);
        setPasswordStep('change');
        // Clean up URL
        window.history.replaceState({}, '', '/profile');
      }
    }
  }, []);
  
  const handleSaveNotificationPrefs = async () => {
    setSavingPrefs(true);
    try {
      const response = await fetch('/api/carrier/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPrefs)
      });
      
      const result = await response.json();
      
      if (result.ok) {
        toast.success("Notification preferences saved!");
        mutateNotif();
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };
  
  const carrierProfile = profileData?.data;
  
  if (userLoading || supabaseLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" style={accentColorStyle} />
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
          Profile Settings
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your account information and preferences
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>
                  <User className="w-5 h-5" style={accentColorStyle} />
                </div>
                <div>
                  <CardTitle className="text-2xl">Personal Information</CardTitle>
                  <CardDescription>Your personal details and contact information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                  <p className="text-base font-medium">
                    {unifiedUser?.fullName || 
                     (unifiedUser?.firstName && unifiedUser?.lastName 
                       ? `${unifiedUser.firstName} ${unifiedUser.lastName}`.trim()
                       : unifiedUser?.firstName || 
                         carrierProfile?.contact_name || 
                         'Not set')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                  <p className="text-base font-medium">{user?.email || 'Not set'}</p>
                </div>
                {carrierProfile && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                      <p className="text-base font-medium">{carrierProfile.phone || 'Not set'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">MC Number</Label>
                      <p className="text-base font-medium">{carrierProfile.mc_number || 'Not set'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">USDOT Number</Label>
                      <p className="text-base font-medium">{carrierProfile.dot_number || 'Not set'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                      <p className="text-base font-medium">
                        {carrierProfile.created_at 
                          ? new Date(carrierProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          : 'Not set'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Company Information */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>
                  <Building2 className="w-5 h-5" style={accentColorStyle} />
                </div>
                <div>
                  <CardTitle className="text-2xl">Company Information</CardTitle>
                  <CardDescription>Your company details and business information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {carrierProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Company Name</Label>
                    <p className="text-base font-medium">{carrierProfile.company_name || carrierProfile.legal_name || 'Not set'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p className="text-base font-medium">
                      {carrierProfile.address_line1 || 'Not set'}
                      {carrierProfile.address_line2 && <><br/>{carrierProfile.address_line2}</>}
                      {carrierProfile.city && carrierProfile.state && (
                        <><br/>{carrierProfile.city}, {carrierProfile.state} {carrierProfile.zip_code || ''}</>
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Contact Name</Label>
                    <p className="text-base font-medium">{carrierProfile.contact_name || 'Not set'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-base font-medium">{carrierProfile.email || user?.email || 'Not set'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No company information available</p>
              )}
            </CardContent>
          </Card>
          
          {/* Notification Preferences */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>
                    <Bell className="w-5 h-5" style={accentColorStyle} />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Notification Preferences</CardTitle>
                    <CardDescription>Control how and when you receive notifications</CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handleSaveNotificationPrefs}
                  disabled={savingPrefs}
                  style={{ backgroundColor: accentColor }}
                  className="text-white"
                >
                  {savingPrefs ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm">
                  <div className="space-y-1">
                    <Label htmlFor="toast-notifications" className="text-base font-medium">Toast Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show in-app toast notifications
                    </p>
                  </div>
                  <Switch
                    id="toast-notifications"
                    checked={notificationPrefs.toastNotifications ?? true}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, toastNotifications: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm">
                  <div className="space-y-1">
                    <Label htmlFor="email-notifications" className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notificationPrefs.emailNotifications ?? true}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm">
                  <div className="space-y-1">
                    <Label htmlFor="text-notifications" className="text-base font-medium">Text Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via SMS (coming soon)
                    </p>
                  </div>
                  <Switch
                    id="text-notifications"
                    checked={false}
                    disabled
                    onCheckedChange={() => {}}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <Label className="text-base font-medium">Urgent Contact Preference</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    How should we contact you for urgent matters?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant={notificationPrefs.urgentContactEmail ? 'default' : 'outline'}
                      onClick={() => setNotificationPrefs(prev => ({ 
                        ...prev, 
                        urgentContactEmail: !prev.urgentContactEmail,
                        urgentContactPreference: !prev.urgentContactEmail ? 'email' : (prev.urgentContactPhone ? 'phone' : 'email')
                      }))}
                      className={`relative transition-all duration-200 ${
                        notificationPrefs.urgentContactEmail 
                          ? 'shadow-lg shadow-blue-500/50 ring-2 ring-blue-400 ring-opacity-75' 
                          : ''
                      }`}
                      style={notificationPrefs.urgentContactEmail ? { 
                        backgroundColor: accentColor, 
                        color: 'white',
                        boxShadow: `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20`
                      } : {}}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant={notificationPrefs.urgentContactPhone ? 'default' : 'outline'}
                      onClick={() => setNotificationPrefs(prev => ({ 
                        ...prev, 
                        urgentContactPhone: !prev.urgentContactPhone,
                        urgentContactPreference: !prev.urgentContactPhone ? 'phone' : (prev.urgentContactEmail ? 'email' : 'phone')
                      }))}
                      className={`relative transition-all duration-200 ${
                        notificationPrefs.urgentContactPhone 
                          ? 'shadow-lg shadow-blue-500/50 ring-2 ring-blue-400 ring-opacity-75' 
                          : ''
                      }`}
                      style={notificationPrefs.urgentContactPhone ? { 
                        backgroundColor: accentColor, 
                        color: 'white',
                        boxShadow: `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20`
                      } : {}}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Phone
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Payment Methods */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>
                  <CreditCard className="w-5 h-5" style={accentColorStyle} />
                </div>
                <div>
                  <CardTitle className="text-2xl">Payment Methods</CardTitle>
                  <CardDescription>Manage your payment information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Payment methods coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Security Card */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}>
                  <Shield className="w-5 h-5" style={accentColorStyle} />
                </div>
                <CardTitle>Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasPasswordAuth && !isGoogleUser ? (
                <Button
                  onClick={() => setShowPasswordDialog(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Password changes are not available for Google sign-in accounts.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Quick Links */}
          <Card className="border border-white/20 shadow-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowFavoritesConsole(true)}
              >
                <Bell className="w-4 h-4 mr-2" />
                Notification Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Change Password Dialog */}
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
                  A verification code will be sent to <strong>{user?.email}</strong>
                </p>
                <Button
                  onClick={handleRequestPasswordChange}
                  disabled={passwordLoading}
                  className="w-full"
                  style={{ backgroundColor: accentColor, color: 'white' }}
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
                  style={{ backgroundColor: accentColor, color: 'white' }}
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
                  style={{ backgroundColor: accentColor, color: 'white' }}
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

      {/* Favorites Console */}
      <FavoritesConsole isOpen={showFavoritesConsole} onClose={() => setShowFavoritesConsole(false)} />
    </div>
  );
}
