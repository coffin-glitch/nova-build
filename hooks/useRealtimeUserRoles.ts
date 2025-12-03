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
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;
    
    // Guard against SSR/build-time execution
    if (typeof window === 'undefined') return;

    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (error) {
      console.error('[useRealtimeUserRoles] Error getting Supabase client:', error);
      return;
    }
    
    const channelName = `user_roles_cache_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build postgres_changes config
    // FIXED: Remove filter from subscription to avoid "mismatch between server and client bindings" error
    // Filtering in the callback instead works better with RLS policies
    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'user_roles_cache',
      // Don't use filter here - it causes binding mismatch errors with RLS
      // We'll filter in the callback instead
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
        } else if (status === 'CHANNEL_ERROR') {
          // Log the actual error if available
          if (err) {
            console.error('[Realtime] Channel error details:', err);
          }
          // This error typically means:
          // 1. RLS policies are blocking the subscription (most common when Realtime is enabled)
          // 2. The filter syntax is incorrect
          // 3. The table doesn't exist or has incorrect schema
          console.warn('[Realtime] Channel error subscribing to user_roles_cache. Common causes:');
          console.warn('  1. RLS policies may be blocking the subscription (even if Realtime is enabled)');
          console.warn('  2. Check RLS policies for user_roles_cache table in Supabase Dashboard → Authentication → Policies');
          console.warn('  3. The filter might be causing issues - try removing userId filter if RLS is strict');
          console.warn('  4. The app will continue to work, but role updates may be delayed until page refresh');
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription to user_roles_cache timed out');
        } else if (status === 'CLOSED') {
          // This is normal during cleanup, but log if it happens unexpectedly
          console.debug('[Realtime] Subscription to user_roles_cache closed (this is normal during component unmount)');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.warn('[useRealtimeUserRoles] Error removing channel:', error);
        }
        channelRef.current = null;
      }
    };
  }, [enabled, userId]); // Removed callbacks from dependencies
}
