import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeAssignmentsOptions {
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  userId?: string; // Filter by carrier user ID
  loadId?: string; // Filter by specific load ID
  assignmentId?: string; // Filter by specific assignment ID
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time changes on assignments table
 * Provides instant updates for load assignments and status changes
 */
export function useRealtimeAssignments(options: UseRealtimeAssignmentsOptions = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    userId,
    loadId,
    assignmentId,
    enabled = true,
  } = options;

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowser>['channel'] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseBrowser();
    
    const channelName = `assignments_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Build filter based on provided options
    let filter: string | undefined;
    if (userId && loadId) {
      filter = `carrier_user_id=eq.${userId}&load_id=eq.${loadId}`;
    } else if (userId && assignmentId) {
      filter = `carrier_user_id=eq.${userId}&id=eq.${assignmentId}`;
    } else if (userId) {
      filter = `carrier_user_id=eq.${userId}`;
    } else if (loadId) {
      filter = `load_id=eq.${loadId}`;
    } else if (assignmentId) {
      filter = `id=eq.${assignmentId}`;
    }

    const postgresChanges = {
      event: '*' as const,
      schema: 'public',
      table: 'assignments',
      ...(filter && { filter }),
    };

    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        console.log('[Realtime] assignments change:', payload.eventType, payload);
        
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
          console.log('[Realtime] Subscribed to assignments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error subscribing to assignments');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, loadId, assignmentId, onInsert, onUpdate, onDelete]);
}

