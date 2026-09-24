import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

    const channel = supabase
      .channel(`realtime-notifications-count-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}
