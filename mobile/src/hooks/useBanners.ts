import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  target_screen: string | null;
  action_url: string | null;
  is_active: boolean;
  display_order: number;
}

export function useBanners() {
  const queryClient = useQueryClient();

  const query = useQuery<Banner[]>({
    queryKey: ['banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return (data || []) as Banner[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    const channel = supabase
      .channel('realtime-banners')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banners' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['banners'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
