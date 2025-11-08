"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { Truck, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getButtonTextColor as getTextColor } from "@/lib/utils";

/**
 * Supabase Sign In Component
 * 
 * Redesigned to match NOVA's sleek, modern UI with glass morphism,
 * gradients, and elevated design patterns.
 */
export default function SupabaseSignIn() {
  const [mounted, setMounted] = useState(false);
  const { supabase, loading: supabaseLoading } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Read error from URL parameters on mount
  useEffect(() => {
    if (!mounted) return;
    
    const urlError = searchParams.get('error');
    const urlErrorDescription = searchParams.get('error_description');
    
    if (urlError) {
      let errorMessage = 'Authentication failed';
      
      if (urlErrorDescription) {
        try {
          // Decode and sanitize the error description
          const decoded = decodeURIComponent(urlErrorDescription);
          // Remove any non-printable characters that might cause issues
          errorMessage = decoded.replace(/[^\x20-\x7E]/g, '').substring(0, 200);
          
          // Map common error codes to user-friendly messages
          if (urlError === 'callback_exception') {
            if (errorMessage.includes('split')) {
              errorMessage = 'An error occurred during authentication. Please try signing in again.';
            }
          } else if (urlError === 'code_exchange_failed') {
            errorMessage = 'Failed to complete authentication. The session may have expired. Please try again.';
          } else if (urlError === 'no_session') {
            errorMessage = 'No session was created. Please try signing in again.';
          } else if (urlError === 'configuration_error') {
            errorMessage = 'Authentication service is not configured. Please contact support.';
          }
        } catch (e) {
          // If decoding fails, use a generic message
          errorMessage = 'An authentication error occurred. Please try again.';
        }
      }
      
      setError(errorMessage);
      
      // Clear the error from URL to prevent showing it again on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('error_description');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [mounted, searchParams]);

  useEffect(() => {
    setMounted(true);
    
    // Wait for Supabase to be initialized before checking session
    if (supabaseLoading || !supabase) {
      return;
    }
    
    // Check if user is already authenticated and redirect
    const checkSession = async () => {
      console.log('🐛 [SIGN-IN DEBUG] Checking for existing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('🐛 [SIGN-IN DEBUG] Session check result:');
      console.log('🐛 - Error:', error ? `❌ ${error.message}` : '✅ None');
      console.log('🐛 - Has session:', !!session);
      console.log('🐛 - Has user:', !!session?.user);
      console.log('🐛 - User email:', session?.user?.email || 'None');
      console.log('🐛 - Email confirmed:', !!session?.user?.email_confirmed_at);
      console.log('🐛 - Session expires:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'None');
      
      if (session?.user) {
        // Check if email is confirmed
        if (!session.user.email_confirmed_at) {
          console.log('⚠️ [SupabaseSignIn] Email not confirmed, redirecting to verification page');
          router.push(`/verify-email?email=${encodeURIComponent(session.user.email || '')}`);
          return;
        }
        
        console.log('✅ [SupabaseSignIn] User already authenticated, redirecting...');
        // Use replace instead of push to avoid redirect loops
        router.replace('/');
      } else {
        console.log('⚠️ [SupabaseSignIn] No session found, showing sign-in form');
      }
    };
    
    checkSession();
  }, [router, supabase, supabaseLoading]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't allow sign-in if Supabase isn't ready
    if (!supabase || supabaseLoading) {
      setError("Please wait while we initialize...");
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isMagicLink) {
        // Send magic link
        const { error: magicLinkError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (magicLinkError) throw magicLinkError;

        setMessage("Check your email for the magic link!");
      } else {
        // Email/password sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Don't allow sign-in if Supabase isn't ready
    if (!supabase || supabaseLoading) {
      setError("Please wait while we initialize...");
      return;
    }
    
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    console.log('🐛 [GOOGLE SIGN-IN DEBUG] Starting Google OAuth...');
    console.log('🐛 Redirect URL:', `${window.location.origin}/auth/callback`);

    try {
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      console.log('🐛 [GOOGLE SIGN-IN DEBUG] OAuth response:');
      console.log('🐛 - Error:', googleError ? `❌ ${googleError.message}` : '✅ None');
      console.log('🐛 - Has data:', !!data);
      console.log('🐛 - URL:', data?.url || 'None');
      console.log('🐛 - Provider:', data?.provider || 'None');

      if (googleError) throw googleError;
      
      // User will be redirected to Google, then back to callback
      console.log('✅ [GOOGLE SIGN-IN DEBUG] OAuth initiated, redirecting to Google...');
    } catch (err: any) {
      console.error('❌ [GOOGLE SIGN-IN DEBUG] Error:', err);
      setError(err.message || "Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  if (!mounted || supabaseLoading || !supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-transparent to-surface-100 dark:from-surface-900 dark:via-transparent dark:to-surface-950">
        <div className="animate-pulse text-muted-foreground">Initializing...</div>
      </div>
    );
  }

  // Get button text color for accent color
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
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-muted-foreground">
            Sign in to access your account
          </p>
        </div>

        {/* Sign In Card */}
        <Card className="border-white/10 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sign In
            </CardTitle>
            <CardDescription>
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="transition-all duration-200"
                />
              </div>

              {/* Password Field */}
              {!isMagicLink && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    className="transition-all duration-200"
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {message && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <AlertDescription className="text-sm">{message}</AlertDescription>
                </Alert>
              )}

              {/* Sign In Button */}
              <Button 
                type="submit" 
                disabled={loading || googleLoading} 
                className="w-full h-11 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 group"
                style={{ backgroundColor: accentColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <span style={{ color: getButtonTextColor() }}>
                  {loading ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin inline" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {isMagicLink ? "Sending..." : "Signing in..."}
                    </>
                  ) : (
                    <>
                      {isMagicLink ? "Send Magic Link" : "Sign In"}
                      <ArrowRight className="ml-2 h-4 w-4 inline group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </Button>
            </form>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full h-11 border-2 hover:bg-accent/50 transition-all duration-200 group"
            >
              {googleLoading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>

            {/* Magic Link Toggle */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsMagicLink(!isMagicLink)}
              disabled={loading || googleLoading}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {isMagicLink
                ? "Use password instead"
                : "Sign in with magic link"}
            </Button>

            {/* Sign Up Link */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link 
                  href="/sign-up" 
                  className="font-medium text-primary hover:underline transition-colors"
                  style={{ color: accentColor }}
                >
                  Sign up
                </Link>
              </p>
            </div>

            {/* Forgot Password Link */}
            <div className="text-center">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                style={{ color: accentColor }}
              >
                Forgot password?
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to NOVA's Terms of Service
        </p>
      </div>
    </div>
  );
}
