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

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'user_roles_cache',
      ...(userId && { filter: `supabase_user_id=eq.${userId}` }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
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
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to user_roles_cache');
        } else if (status === 'CHANNEL_ERROR') {
          // This error typically means:
          // 1. Realtime is not enabled for user_roles_cache table in Supabase Dashboard
          // 2. RLS policies are blocking the subscription
          // 3. The table doesn't exist or has incorrect schema
          console.warn('[Realtime] Channel error subscribing to user_roles_cache. This is usually because:');
          console.warn('  1. Realtime is not enabled for user_roles_cache in Supabase Dashboard → Database → Replication');
          console.warn('  2. RLS policies may be blocking the subscription');
          console.warn('  3. The app will continue to work, but role updates may be delayed until page refresh');
          console.warn('  To fix: Enable Realtime for user_roles_cache table in Supabase Dashboard');
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription to user_roles_cache timed out');
        } else if (status === 'CLOSED') {
          console.warn('[Realtime] Subscription to user_roles_cache closed');
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
