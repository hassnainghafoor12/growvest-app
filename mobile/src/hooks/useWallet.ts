import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Wallet } from '../types/database.types';

export function useWallet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Wallet | null>({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If wallet doesn't exist yet, return null
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Wallet;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Supabase Realtime subscription for live wallet balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-wallet-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            queryClient.setQueryData(['wallet', user.id], payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}
