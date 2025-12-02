import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeCarrierProfilesOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by carrier user ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on carrier_profiles table
 * Provides instant updates for profile status changes (approval, etc.)
 */
export function useRealtimeCarrierProfiles(options: UseRealtimeCarrierProfilesOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `carrier_profiles_${Date.now()}`;
    const channel = supabase.channel(channelName);

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'carrier_profiles',
      ...(userId && { filter: `supabase_user_id=eq.${userId}` }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] carrier_profiles change:', payload.eventType, payload);
        
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload);
            break;
          case 'UPDATE':
            onUpdate?.(payload);
            break;
          case 'DELETE':
            onDelete?.(payload);
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to carrier_profiles');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to carrier_profiles');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, onInsert, onUpdate, onDelete]);
}

