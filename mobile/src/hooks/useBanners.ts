import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { realtimeSync } from '../lib/realtimeSync';

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
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const channelName = 'realtime-banners-channel';

    realtimeSync.getOrCreateChannel(channelName, (channel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banners' },
        (payload) => {
          if (!payload) return;

          // Directly update the React Query Cache for banners
          queryClient.setQueryData<Banner[]>(['banners'], (old = []) => {
            if (payload.eventType === 'INSERT') {
              const newBanner = payload.new as Banner;
              if (newBanner.is_active) {
                return [...old.filter((b) => b.id !== newBanner.id), newBanner].sort(
                  (a, b) => a.display_order - b.display_order
                );
              }
              return old;
            }

            if (payload.eventType === 'UPDATE') {
              const updatedBanner = payload.new as Banner;
              if (!updatedBanner.is_active) {
                return old.filter((b) => b.id !== updatedBanner.id);
              }
              const exists = old.some((b) => b.id === updatedBanner.id);
              if (exists) {
                return old
                  .map((b) => (b.id === updatedBanner.id ? updatedBanner : b))
                  .sort((a, b) => a.display_order - b.display_order);
              } else {
                return [...old, updatedBanner].sort((a, b) => a.display_order - b.display_order);
              }
            }

            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as { id: string })?.id;
              return old.filter((b) => b.id !== deletedId);
            }

            return old;
          });
        }
      );
    });

    return () => {
      realtimeSync.releaseChannel(channelName);
    };
  }, [queryClient]);

  return query;
}
