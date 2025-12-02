import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

interface UseRealtimeNotificationsOptions {
  userId?: string; // Filter by user ID
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on notifications table
 * Provides instant notification updates
 */
export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const {
    userId,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  
  // Update callbacks ref when they change (without triggering re-subscription)
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `notifications_${userId}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'notifications',
      filter: `recipient_user_id=eq.${userId}`,
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] notification change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to notifications');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId]); // Removed callbacks from dependencies
}

