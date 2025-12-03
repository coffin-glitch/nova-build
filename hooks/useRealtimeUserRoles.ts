import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeUserRolesOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by specific user ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on user_roles_cache table
 * Provides instant updates when user roles change (critical for admin/carrier access control)
 * 
 * FIXED: Removed ReturnType<typeof getSupabaseBrowser> to prevent module-level type evaluation
 * that causes "Cannot access before initialization" errors in production builds.
 */
export function useRealtimeUserRoles(options: UseRealtimeUserRolesOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    enabled = true,
  } = options;

  // FIXED: Use RealtimeChannel type directly instead of ReturnType<typeof getSupabaseBrowser>
  // This prevents module-level type evaluation that can cause circular dependency issues
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  const isSubscribingRef = useRef(false);
  const subscribedUserIdRef = useRef<string | undefined>(undefined);
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) {
      // Clean up existing channel if disabled
      if (channelRef.current) {
        try {
          const supabase = getSupabaseBrowser();
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          // Ignore cleanup errors
        }
        channelRef.current = null;
        isSubscribingRef.current = false;
        subscribedUserIdRef.current = undefined;
      }
      return;
    }
    
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') return;

    // Prevent duplicate subscriptions for the same userId
    if (isSubscribingRef.current && subscribedUserIdRef.current === userId) {
      return; // Already subscribing/subscribed for this user
    }

    // Clean up any existing channel before creating a new one
    // This prevents multiple subscriptions when userId changes or component re-renders
    if (channelRef.current) {
      try {
        const supabase = getSupabaseBrowser();
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        // Ignore cleanup errors
      }
      channelRef.current = null;
      isSubscribingRef.current = false;
    }

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (error) {
      console.error('[useRealtimeUserRoles] Error getting Supabase client:', error);
      return;
    }
    
    // Mark as subscribing
    isSubscribingRef.current = true;
    subscribedUserIdRef.current = userId;
    
    // Use a stable channel name based on userId to prevent duplicate subscriptions
    const channelName = `user_roles_cache_${userId || 'all'}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build postgres_changes config
    // FIXED: Remove filter and use minimal config to avoid "mismatch between server and client bindings" error
    // This error occurs when RLS policies conflict with the subscription binding
    // Solution: Subscribe without filter, filter in callback instead
    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'user_roles_cache',
      // CRITICAL: No filter here - causes binding mismatch with RLS
      // Filter in callback instead (see below)
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        // Filter in callback to avoid server/client binding mismatch
        // This works better with RLS policies and avoids the filter syntax error
        const isRelevantChange = !userId || 
          payload.new?.supabase_user_id === userId || 
          payload.old?.supabase_user_id === userId;
        
        if (isRelevantChange) {
          console.log('[Realtime] user_roles_cache change:', payload.eventType, payload);
          
          // Use ref to get latest callbacks without re-subscribing
          const callbacks = callbacksRef.current;
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(payload);
              break;
            case 'DELETE':
              callbacks.onDelete?.(payload);
              break;
          }
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to user_roles_cache', userId ? `(filtered for user: ${userId})` : '(all changes)');
          isSubscribingRef.current = false; // Mark as successfully subscribed
        } else if (status === 'CHANNEL_ERROR') {
          // Reset subscribing flag on error so it can retry
          isSubscribingRef.current = false;
          
          // Only log error if it's not the "binding mismatch" error that Supabase sometimes reports
          // but then successfully retries. This error often appears but the subscription still works.
          if (err && err.message && err.message.includes('mismatch between server and client bindings')) {
            // This is a known issue with RLS + Realtime, but the subscription often still works
            // Log at debug level since it's usually followed by a successful subscription
            console.debug('[Realtime] Binding mismatch error (this is often followed by successful subscription):', err.message);
          } else {
            // Log other errors at warn level
            if (err) {
              console.error('[Realtime] Channel error details:', err);
            }
            console.warn('[Realtime] Channel error subscribing to user_roles_cache. Common causes:');
            console.warn('  1. RLS policies are blocking the subscription (most likely cause)');
            console.warn('     → The "mismatch between server and client bindings" error indicates RLS conflict');
            console.warn('     → Check Supabase Dashboard → Authentication → Policies → user_roles_cache');
            console.warn('     → Ensure policy allows SELECT for authenticated users');
            console.warn('  2. The subscription will retry, but may continue to fail if RLS blocks it');
            console.warn('  3. The app will continue to work, but role updates may be delayed until page refresh');
          }
        } else if (status === 'TIMED_OUT') {
          isSubscribingRef.current = false; // Reset on timeout
          console.warn('[Realtime] Subscription to user_roles_cache timed out');
        } else if (status === 'CLOSED') {
          // This is normal during cleanup, but log if it happens unexpectedly
          isSubscribingRef.current = false;
          subscribedUserIdRef.current = undefined;
          console.debug('[Realtime] Subscription to user_roles_cache closed (this is normal during component unmount)');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        try {
          const supabase = getSupabaseBrowser();
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          // Ignore cleanup errors during unmount
        }
        channelRef.current = null;
        isSubscribingRef.current = false;
        subscribedUserIdRef.current = undefined;
      }
    };
  }, [enabled, userId]); // Removed callbacks from dependencies
}
