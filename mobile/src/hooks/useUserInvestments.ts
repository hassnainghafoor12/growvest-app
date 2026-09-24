import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { realtimeSync } from '../lib/realtimeSync';
import { Investment } from '../types/database.types';

export function useUserInvestments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Investment[]>({
    queryKey: ['user-investments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('investments')
        .select(`
          *,
          investment_plans (
            id,
            title,
            category,
            expected_return_rate,
            return_period,
            duration_days,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Investment[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-user-investments-${user.id}`;

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload) return;

          // Directly update the React Query Cache for investments
          queryClient.setQueryData<Investment[]>(['user-investments', user.id], (old = []) => {
            if (payload.eventType === 'INSERT') {
              const newInv = payload.new as Investment;
              return [newInv, ...old.filter((i) => i.id !== newInv.id)];
            }

            if (payload.eventType === 'UPDATE') {
              const updatedInv = payload.new as Investment;
              return old.map((i) => (i.id === updatedInv.id ? { ...i, ...updatedInv } : i));
            }

            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as { id: string })?.id;
              return old.filter((i) => i.id !== deletedId);
            }

            return old;
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
