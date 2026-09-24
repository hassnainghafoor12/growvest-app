import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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
    staleTime: 1000 * 30, // 30 seconds
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`realtime-tx-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['recent-transactions', user.id] });
          queryClient.invalidateQueries({ queryKey: ['wallet', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}
