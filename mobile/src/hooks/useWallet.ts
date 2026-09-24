import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { realtimeSync } from '../lib/realtimeSync';
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
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Wallet;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  // Supabase Realtime subscription for live wallet balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-wallet-${user.id}`;

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload?.new) {
            // Direct React Query Cache update: only the wallet values re-render
            queryClient.setQueryData(['wallet', user.id], payload.new);
          }
        }
      );
    });

    return () => {
      realtimeSync.releaseChannel(channelName);
    };
  }, [user?.id, queryClient]);

  return query;
}
