import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
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
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  useEffect(() => {
    const channel = supabase
      .channel('realtime-plans')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investment_plans' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['featured-plans'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
