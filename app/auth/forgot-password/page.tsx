"use client";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccentColor } from "@/hooks/useAccentColor";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Forgot Password Page
 * 
 * Implements the same reauthentication flow as the profile page:
 * 1. User enters email
 * 2. Verify email exists in system
 * 3. Send reauthentication OTP code (6-digit)
 * 4. User enters code
 * 5. Send password reset link
 * 6. User clicks link and changes password
 */
export default function ForgotPasswordPage() {
  const [mounted, setMounted] = useState(false);
  const { supabase, loading: supabaseLoading } = useSupabase();
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<'email' | 'verify' | 'success'>('email');
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Verify email exists and send OTP code
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) throw new Error("Supabase client not available");

      // Send OTP code to verify email exists
      // Using signInWithOtp with shouldCreateUser: false
      // This will send a code if email exists, or error if it doesn't
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false
        }
      });

      // Check if error indicates user doesn't exist
      if (otpError) {
        // Supabase returns different error messages for non-existent users
        const errorMsg = otpError.message.toLowerCase();
        if (errorMsg.includes("user not found") || 
            errorMsg.includes("does not exist") ||
            errorMsg.includes("email not confirmed") ||
            errorMsg.includes("invalid login credentials")) {
          setError("This email address is not registered. Please check your email or sign up.");
          return;
        }
        throw otpError;
      }

      // Success - OTP code sent
      setMessage("Verification code sent! Check your email for the 6-digit code.");
      setStep('verify');
    } catch (err: any) {
      console.error("Forgot password error:", err);
      // Check if it's a user not found error
      const errorMsg = err.message?.toLowerCase() || '';
      if (errorMsg.includes("user not found") || 
          errorMsg.includes("does not exist") ||
          errorMsg.includes("invalid login")) {
        setError("This email address is not registered. Please check your email or sign up.");
      } else {
        setError(err.message || "Failed to send verification code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify the code and redirect to reset password page
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailCode || emailCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) throw new Error("Supabase client not available");

      // Verify the OTP code
      // For forgot password flow, we use type 'email' since user is not logged in
      // This creates a temporary session that allows password reset
      const { error: verifyError, data } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: emailCode,
        type: 'email'
      });

      if (verifyError) {
        // Check if it's an expiration error
        if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
          throw new Error("The verification code has expired or is invalid. Please request a new code.");
        }
        throw verifyError;
      }

      // After successful verification, a session is created
      // We can now redirect directly to the reset password page
      // The session from verifyOtp is sufficient to allow password reset
      
      // Verify we have a session before redirecting
      if (!data?.session) {
        // If no session, try to get it
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          throw new Error("Session not established. Please try again.");
        }
      }

      // Redirect to reset password page - session is already established
      router.push('/auth/reset-password');
    } catch (err: any) {
      console.error("Verify code error:", err);
      // Provide more helpful error messages
      if (err.message?.includes('expired') || err.message?.includes('invalid')) {
        setError("The verification code has expired or is invalid. Please request a new code.");
      } else {
        setError(err.message || "Invalid verification code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || supabaseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
            {step === 'email' && "Enter your email to receive a verification code"}
            {step === 'verify' && "Enter the 6-digit code sent to your email"}
            {step === 'success' && "Password reset link sent!"}
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {step === 'email' && 'Verify Your Email'}
              {step === 'verify' && 'Enter Verification Code'}
              {step === 'success' && 'Check Your Email'}
            </CardTitle>
            <CardDescription>
              {step === 'email' && "We'll send a verification code to confirm your identity"}
              {step === 'verify' && "After verification, you'll receive a password change link"}
              {step === 'success' && "Click the link in your email to reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {step === 'email' && (
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full"
                  style={{ 
                    backgroundColor: accentColor, 
                    color: getTextColor(accentColor, theme) 
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
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
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your email. The code expires in 15 minutes.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || emailCode.length !== 6}
                  className="w-full"
                  style={{ 
                    backgroundColor: accentColor, 
                    color: getTextColor(accentColor, theme) 
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep('email');
                      setEmailCode("");
                      setError(null);
                      setMessage(null);
                    }}
                    className="w-full"
                    disabled={loading}
                  >
                    Back to Email
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      setEmailCode("");
                      setError(null);
                      setMessage(null);
                      setLoading(true);
                      try {
                        if (!supabase) throw new Error("Supabase client not available");
                        const { error: otpError } = await supabase.auth.signInWithOtp({
                          email: email.trim(),
                          options: {
                            shouldCreateUser: false
                          }
                        });
                        if (otpError) throw otpError;
                        setMessage("New verification code sent! Check your email.");
                      } catch (err: any) {
                        setError(err.message || "Failed to resend code. Please try again.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full"
                    disabled={loading}
                  >
                    Resend Code
                  </Button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-500/10 p-4">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the link in your email to reset your password. The link will expire in 1 hour.
                </p>
                <Button
                  onClick={() => router.push('/sign-in')}
                  className="w-full"
                  style={{ 
                    backgroundColor: accentColor, 
                    color: getTextColor(accentColor, theme) 
                  }}
                >
                  Back to Sign In
                </Button>
              </div>
            )}

            {/* Back to Sign In */}
            {step !== 'success' && (
              <div className="pt-4 border-t border-border/50">
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

