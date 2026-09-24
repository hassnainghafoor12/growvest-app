import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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
    staleTime: 1000 * 60, // 1 minute
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`realtime-user-investments-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investments',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-investments', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}
