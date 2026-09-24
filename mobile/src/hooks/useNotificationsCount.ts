import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { realtimeSync } from '../lib/realtimeSync';

export function useNotificationsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<number>({
    queryKey: ['notifications-unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-notifications-count-${user.id}`;

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (!payload) return;

          // Directly update the React Query Cache for notification count
          queryClient.setQueryData<number>(['notifications-unread-count', user.id], (oldCount = 0) => {
            if (payload.eventType === 'INSERT') {
              const item = payload.new as any;
              if ((item.user_id === user.id || item.user_id === null) && !item.is_read) {
                return oldCount + 1;
              }
            }

            if (payload.eventType === 'UPDATE') {
              const item = payload.new as any;
              if (item.is_read) {
                return Math.max(0, oldCount - 1);
              }
            }

            return oldCount;
          });
        }
      );
    });

    return () => {
      realtimeSync.releaseChannel(channelName);
    };
  }, [user?.id, queryClient]);

  return query;
}
