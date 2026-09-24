import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { realtimeSync } from '../lib/realtimeSync';
import { InvestmentPlan } from '../types/database.types';

export function useFeaturedPlans(limit: number = 5) {
  const queryClient = useQueryClient();

  const query = useQuery<InvestmentPlan[]>({
    queryKey: ['featured-plans', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_plans')
        .select('*')
        .in('status', ['open', 'upcoming', 'funded'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as InvestmentPlan[];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Dedicated Realtime Subscription with Direct React Query Cache Updates
  useEffect(() => {
    const channelName = 'realtime-investment-plans';

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investment_plans' },
        (payload) => {
          if (!payload) return;

          // Mutate React Query Cache directly without full screen refetch
          queryClient.setQueryData<InvestmentPlan[]>(['featured-plans', limit], (old = []) => {
            if (payload.eventType === 'INSERT') {
              const newPlan = payload.new as InvestmentPlan;
              if (['open', 'upcoming', 'funded'].includes(newPlan.status)) {
                return [newPlan, ...old.filter((p) => p.id !== newPlan.id)].slice(0, limit);
              }
              return old;
            }

            if (payload.eventType === 'UPDATE') {
              const updatedPlan = payload.new as InvestmentPlan;
              if (!['open', 'upcoming', 'funded'].includes(updatedPlan.status)) {
                // Plan is no longer open/funded, remove from active feed
                return old.filter((p) => p.id !== updatedPlan.id);
              }
              // Replace in-place
              const exists = old.some((p) => p.id === updatedPlan.id);
              if (exists) {
                return old.map((p) => (p.id === updatedPlan.id ? updatedPlan : p));
              } else {
                return [updatedPlan, ...old].slice(0, limit);
              }
            }

            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as { id: string })?.id;
              return old.filter((p) => p.id !== deletedId);
            }

            return old;
          });
        }
      );
    });

    return () => {
      realtimeSync.releaseChannel(channelName);
    };
  }, [queryClient, limit]);

  return query;
}
