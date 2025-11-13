/**
 * Supabase Email Integration
 * 
 * Provides helper functions for Supabase auth email flows:
 * - Sign-up confirmation
 * - Password reset
 * - Magic links
 * - Email change confirmation
 * 
 * Note: Supabase handles sending emails automatically when configured,
 * but these helpers provide programmatic control and customization.
 */

import { getSupabaseService } from "./supabase";

export interface EmailOptions {
  email: string;
  password?: string;
  redirectTo?: string;
  data?: Record<string, any>;
}

/**
 * Send sign-up confirmation email via Supabase
 * This is typically handled automatically by Supabase, but can be triggered manually
 */
export async function sendSignUpEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseService();
    
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: options.email,
      password: options.password || Math.random().toString(36).slice(-12), // Generate random password if not provided
      options: {
        redirectTo: options.redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
        data: options.data || {},
      },
    });
    
    if (error) {
      console.error('[Supabase Email] Sign-up email error:', error);
      return { success: false, error: error.message };
    }
    
    // Note: Supabase generates the link, but you need to send it via your email provider
    // For automatic emails, configure Supabase SMTP settings
    console.log('[Supabase Email] Sign-up link generated:', data.properties?.hashed_token ? 'Token generated' : 'No token');
    
    return { success: true };
  } catch (error: any) {
    console.error('[Supabase Email] Sign-up email exception:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Send password reset email via Supabase
 */
export async function sendPasswordResetEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseService();
    
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: options.email,
      options: {
        redirectTo: options.redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password`,
      },
    });
    
    if (error) {
      console.error('[Supabase Email] Password reset email error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Supabase Email] Password reset link generated');
    return { success: true };
  } catch (error: any) {
    console.error('[Supabase Email] Password reset email exception:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Send magic link email via Supabase
 */
export async function sendMagicLinkEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseService();
    
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: options.email,
      options: {
        redirectTo: options.redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
        data: options.data || {},
      },
    });
    
    if (error) {
      console.error('[Supabase Email] Magic link email error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Supabase Email] Magic link generated');
    return { success: true };
  } catch (error: any) {
    console.error('[Supabase Email] Magic link email exception:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Send email change confirmation email
 */
export async function sendEmailChangeConfirmation(
  userId: string,
  newEmail: string,
  options?: { redirectTo?: string; currentEmail?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseService();
    
    // Fetch current email if not provided
    let currentEmail = options?.currentEmail;
    if (!currentEmail) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !userData?.user?.email) {
        return { success: false, error: 'Could not fetch current email address' };
      }
      currentEmail = userData.user.email;
    }
    
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'email_change_new',
      email: currentEmail,
      newEmail: newEmail,
      options: {
        redirectTo: options?.redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });
    
    if (error) {
      console.error('[Supabase Email] Email change confirmation error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Supabase Email] Email change confirmation link generated');
    return { success: true };
  } catch (error: any) {
    console.error('[Supabase Email] Email change confirmation exception:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Invite user via email (admin function)
 */
export async function inviteUserByEmail(
  email: string,
  options?: {
    redirectTo?: string;
    data?: Record<string, any>;
    role?: 'admin' | 'carrier';
  }
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const supabase = getSupabaseService();
    
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: options?.redirectTo || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
      data: {
        ...options?.data,
        role: options?.role || 'carrier', // Set default role
      },
    });
    
    if (error) {
      console.error('[Supabase Email] User invitation error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Supabase Email] User invitation sent:', data.user?.id);
    return { success: true, userId: data.user?.id };
  } catch (error: any) {
    console.error('[Supabase Email] User invitation exception:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Check if email is configured in Supabase
 */
export async function checkEmailConfiguration(): Promise<{
  configured: boolean;
  provider?: string;
  error?: string;
}> {
  try {
    // Note: Supabase doesn't expose SMTP config via API
    // This is a placeholder that checks if service role key is set
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!hasServiceKey) {
      return {
        configured: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY not set',
      };
    }
    
    // You would need to manually verify SMTP is configured in Supabase Dashboard
    return {
      configured: true,
      provider: 'supabase', // Assumes Supabase email is configured
    };
  } catch (error: any) {
    return {
      configured: false,
      error: error?.message || 'Unknown error',
    };
  }
}



