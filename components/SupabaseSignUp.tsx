"use client";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccentColor } from "@/hooks/useAccentColor";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import { ArrowRight, CheckCircle, Lock, Mail, Sparkles, Truck } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Supabase Sign Up Component
 * 
 * Redesigned to match NOVA's sleek, modern UI with glass morphism,
 * gradients, and elevated design patterns.
 */
export default function SupabaseSignUp() {
  const [mounted, setMounted] = useState(false);
  const { supabase } = useSupabase();
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Check if supabase is initialized
    if (!supabase) {
      setError("Supabase client not initialized. Please refresh the page.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Supabase password requirements:
    // - At least 8 characters
    // - At least one lowercase letter
    // - At least one uppercase letter
    // - At least one number
    // - At least one special character
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }
    
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?`~]/.test(password);
    
    if (!hasLowercase || !hasUppercase || !hasNumber || !hasSpecialChar) {
      const missing = [];
      if (!hasLowercase) missing.push('lowercase letter');
      if (!hasUppercase) missing.push('uppercase letter');
      if (!hasNumber) missing.push('number');
      if (!hasSpecialChar) missing.push('special character');
      
      setError(`Password must contain at least one: ${missing.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      console.log('🐛 [SIGN-UP DEBUG] Attempting sign-up with:', { email, hasPassword: !!password });
      console.log('🐛 [SIGN-UP DEBUG] Supabase client:', supabase ? '✅ Initialized' : '❌ Not initialized');
      
      // Check what URL the client is using
      if (supabase) {
        // @ts-expect-error - accessing internal property for debugging
        const clientUrl = supabase.supabaseUrl || 'unknown';
        console.log('🐛 [SIGN-UP DEBUG] Client URL:', clientUrl);
      }
      
      // TypeScript guard: supabase is checked above but TypeScript needs explicit assertion
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: "carrier", // Default role
          },
        },
      });

      console.log('🐛 [SIGN-UP DEBUG] Sign-up response:', { 
        hasData: !!data, 
        hasUser: !!data?.user, 
        hasError: !!signUpError,
        errorMessage: signUpError?.message 
      });

      if (signUpError) {
        console.error('❌ [SIGN-UP DEBUG] Sign-up error:', signUpError);
        throw signUpError;
      }

      // Check if email confirmation is required
      if (data?.user && !data.session) {
        // Email confirmation required - redirect to verification page
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (data?.session) {
        // User is immediately signed in (email confirmation disabled)
        setMessage("Account created successfully!");
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } else {
        setMessage("Sign-up initiated. Please check your email.");
      }
    } catch (err: any) {
      console.error('❌ [SIGN-UP DEBUG] Exception:', err);
      
      let errorMessage = err.message || "An error occurred";
      
      // Handle network/fetch errors
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      }
      
      // Provide helpful messages for common errors
      if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('email rate limit')) {
        errorMessage = "Email rate limit exceeded. Please wait a few minutes and try again, or sign up with Google instead.";
      } else if (errorMessage.toLowerCase().includes('already registered') || errorMessage.toLowerCase().includes('already exists')) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (errorMessage.toLowerCase().includes('invalid email')) {
        errorMessage = "Please enter a valid email address.";
      } else if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('weak password')) {
        errorMessage = "Password must be at least 8 characters and include: uppercase letter, lowercase letter, number, and special character.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError("Supabase client not initialized");
      return;
    }

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (googleError) throw googleError;
      // User will be redirected to Google, then back to callback
    } catch (err: any) {
      setError(err.message || "Failed to sign up with Google");
      setGoogleLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-transparent to-surface-100 dark:from-surface-900 dark:via-transparent dark:to-surface-950">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Get button text color for accent color
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (password.length === 0) return { strength: 0, text: '' };
    if (password.length < 8) return { strength: 1, text: 'Too short' };
    if (password.length < 12 && !/[A-Z]/.test(password) && !/[0-9]/.test(password)) {
      return { strength: 2, text: 'Weak' };
    }
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { strength: 4, text: 'Strong' };
    }
    return { strength: 3, text: 'Good' };
  };

  const passwordStrength = getPasswordStrength();

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
            Create Your Account
          </h1>
          <p className="text-muted-foreground">
            Join thousands of carriers already using NOVA
          </p>
        </div>

        {/* Sign Up Card */}
        <Card className="border-white/10 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Get Started
            </CardTitle>
            <CardDescription>
              Enter your information to create a new account
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSignUp} className="space-y-4">
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
                  minLength={8}
                  className="transition-all duration-200"
                />
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Password strength:</span>
                      <span className={`font-medium ${
                        passwordStrength.strength >= 3 ? 'text-green-500' : 
                        passwordStrength.strength >= 2 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.strength >= 3 ? 'bg-green-500' : 
                          passwordStrength.strength >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="transition-all duration-200"
                />
                {confirmPassword.length > 0 && password === confirmPassword && (
                  <div className="flex items-center gap-2 text-xs text-green-500">
                    <CheckCircle className="h-3 w-3" />
                    Passwords match
                  </div>
                )}
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    Passwords do not match
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                  <AlertDescription className="text-sm">
                    {error}
                    {error.toLowerCase().includes('rate limit') && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        💡 Tip: Try signing up with Google instead, or wait a few minutes.
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {message && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <AlertDescription className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Sign Up Button */}
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
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
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

            {/* Google Sign Up */}
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
                  Sign up with Google
                </>
              )}
            </Button>

            {/* Sign In Link */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link 
                  href="/sign-in" 
                  className="font-medium text-primary hover:underline transition-colors"
                  style={{ color: accentColor }}
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to NOVA's Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
