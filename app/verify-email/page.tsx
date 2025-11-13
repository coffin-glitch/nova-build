"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { Truck } from "lucide-react";
import { getButtonTextColor as getTextColor } from "@/lib/utils";

/**
 * Email Verification Pending Page
 * Shows after user signs up and needs to verify their email
 */
export default function VerifyEmailPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get email from URL params or session
    const emailParam = searchParams.get("email");
    setEmail(emailParam);

    // Check if user is already verified
    const checkVerificationStatus = async () => {
      if (!supabase) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if email is confirmed
          const isEmailConfirmed = session.user.email_confirmed_at !== null;
          setIsVerified(isEmailConfirmed);
          
          if (isEmailConfirmed) {
            // Email is verified, redirect to home
            setTimeout(() => {
              router.push("/");
            }, 2000);
          } else {
            // Still not verified, set email if we have session
            if (!email && session.user.email) {
              setEmail(session.user.email);
            }
          }
        }
      } catch (err: any) {
        console.error("Error checking verification status:", err);
        setError("Failed to check verification status");
      } finally {
        setCheckingStatus(false);
      }
    };

    checkVerificationStatus();

    // Set up interval to check verification status every 5 seconds
    const interval = setInterval(checkVerificationStatus, 5000);

    return () => clearInterval(interval);
  }, [supabase, router, searchParams]);

  const handleResendEmail = async () => {
    if (!email) return;
    
    try {
      if (!supabase) return;
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (resendError) throw resendError;

      alert("Verification email resent! Please check your inbox.");
    } catch (err: any) {
      console.error("Error resending email:", err);
      setError(err.message || "Failed to resend email");
    }
  };

  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background with gradient */}
      <div className="fixed inset-0 bg-background" />
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-indigo-500/10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.15),transparent_50%)]" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center space-x-3 mb-6 group">
            <div 
              className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-110"
              style={{ backgroundColor: accentColor }}
            >
              <Truck className="h-6 w-6" style={{ color: getButtonTextColor() }} />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              NOVA
            </span>
          </Link>
        </div>

        {/* Verification Card */}
        <Card className="border-white/10 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              {checkingStatus ? (
                <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : isVerified ? (
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {checkingStatus
                ? "Checking verification status..."
                : isVerified
                ? "Email Verified!"
                : "Verify Your Email"}
            </CardTitle>
            <CardDescription>
              {checkingStatus
                ? "Please wait while we check your email verification status"
                : isVerified
                ? "Your email has been verified. Redirecting you now..."
                : email
                ? `We've sent a verification email to ${email}. Please check your inbox and click the verification link.`
                : "Please check your email for a verification link."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!checkingStatus && !isVerified && (
              <>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Didn't receive the email?</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you entered the correct email address</li>
                    <li>Wait a few minutes for the email to arrive</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleResendEmail}
                    className="w-full"
                    variant="outline"
                    disabled={!email}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </Button>

                  <Button
                    onClick={() => router.push("/sign-in")}
                    variant="ghost"
                    className="w-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {checkingStatus && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  This page will automatically refresh when your email is verified.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Need help? <Link href="/contact" className="hover:underline">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}



