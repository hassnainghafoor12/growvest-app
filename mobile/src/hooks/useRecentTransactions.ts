import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { realtimeSync } from '../lib/realtimeSync';
import { Transaction } from '../types/database.types';

export function useRecentTransactions(limit: number = 5) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Transaction[]>({
    queryKey: ['recent-transactions', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-tx-${user.id}`;

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload) return;

          // 1. Mutate Recent Transactions Cache Directly
          queryClient.setQueryData<Transaction[]>(
            ['recent-transactions', user.id, limit],
            (old = []) => {
              if (payload.eventType === 'INSERT') {
                const newTx = payload.new as Transaction;
                return [newTx, ...old.filter((t) => t.id !== newTx.id)].slice(0, limit);
              }

              if (payload.eventType === 'UPDATE') {
                const updatedTx = payload.new as Transaction;
                return old.map((t) => (t.id === updatedTx.id ? updatedTx : t));
              }

              if (payload.eventType === 'DELETE') {
                const deletedId = (payload.old as { id: string })?.id;
                return old.filter((t) => t.id !== deletedId);
              }

              return old;
            }
          );
        }
      );
    });

    return () => {
      realtimeSync.releaseChannel(channelName);
    };
  }, [user?.id, queryClient, limit]);

  return query;
}
