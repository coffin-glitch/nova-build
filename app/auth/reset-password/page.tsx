"use client";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccentColor } from "@/hooks/useAccentColor";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Reset Password Page
 * 
 * Handles password reset when user clicks the link from their email.
 * The link comes from the forgot password flow or profile password change.
 */
export default function ResetPasswordPage() {
  const [mounted, setMounted] = useState(false);
  const { supabase, loading: supabaseLoading } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    if (!supabase) return;
    
    // Check for tokens in URL (from password reset link)
    const handlePasswordReset = async () => {
      try {
        // Check URL hash for tokens (Supabase puts them in hash fragment)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Also check query params (in case callback route passes them)
        const tokenParam = searchParams.get('token');
        const typeParam = searchParams.get('type');
        
        // If we have tokens in hash, set the session
        if (accessToken && refreshToken && type === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            setError('Failed to establish session. Please try the reset link again.');
            setCheckingSession(false);
            return;
          }
          
          // Clear the hash from URL
          window.history.replaceState({}, '', window.location.pathname);
          setSessionReady(true);
          setCheckingSession(false);
          return;
        }
        
        // If we have a token in query params (from callback route), verify it
        if (tokenParam && typeParam === 'recovery') {
          // Verify the recovery token to establish session
          const { error: verifyError, data } = await supabase.auth.verifyOtp({
            token_hash: tokenParam,
            type: 'recovery'
          });
          
          if (verifyError) {
            setError('Invalid or expired reset link. Please request a new one.');
            setCheckingSession(false);
            return;
          }
          
          // Session is established after verification
          if (data?.session) {
            setSessionReady(true);
            setCheckingSession(false);
            // Clear token from URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
        }
        
        // Check for error parameter from callback
        const errorParam = searchParams.get('error');
        if (errorParam === 'invalid_token') {
          setError('Invalid or expired reset link. Please request a new one.');
          setCheckingSession(false);
          return;
        }
        
        // Listen for PASSWORD_RECOVERY event (when user clicks reset link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            // User clicked password reset link, session is now established
            setSessionReady(true);
            setCheckingSession(false);
          } else if (event === 'SIGNED_IN' && session) {
            // User is signed in, ready to reset password
            setSessionReady(true);
            setCheckingSession(false);
          }
        });
        
        // Check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
          setCheckingSession(false);
        } else {
          setCheckingSession(false);
        }
        
        return () => subscription.unsubscribe();
      } catch (err: any) {
        console.error('Password reset setup error:', err);
        setError('Failed to initialize password reset. Please try again.');
        setCheckingSession(false);
      }
    };
    
    handlePasswordReset();
  }, [supabase, searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error("Supabase client not available");
      
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) throw updateError;
      
      setSuccess(true);
      toast.success("Password reset successfully!");
      
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push('/sign-in');
      }, 2000);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || supabaseLoading || checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Setting up password reset...</p>
        </div>
      </div>
    );
  }
  
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md">
          <Card className="border-2 shadow-2xl bg-card/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>
                    {error || "No valid password reset session found. Please use the link from your email or request a new password reset."}
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => router.push('/auth/forgot-password')}
                  className="w-full"
                  style={{ 
                    backgroundColor: accentColor, 
                    color: getTextColor(accentColor, theme) 
                  }}
                >
                  Request New Reset Link
                </Button>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md">
          <Card className="border-2 shadow-2xl bg-card/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-500/10 p-4">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold">Password Reset Successful!</h2>
                <p className="text-muted-foreground">
                  Your password has been reset. Redirecting to sign in...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Reset Password
          </h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Create New Password
            </CardTitle>
            <CardDescription>
              Your password must be at least 8 characters long
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full"
                style={{ 
                  backgroundColor: accentColor, 
                  color: getTextColor(accentColor, theme) 
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>

            {/* Back to Sign In */}
            <div className="pt-4 border-t border-border/50">
              <Link
                href="/sign-in"
                className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

