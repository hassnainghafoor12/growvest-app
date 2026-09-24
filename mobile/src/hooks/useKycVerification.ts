import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { KycDocumentType, KycStatus } from '../types/database.types';

export interface KycRecord {
  id: string;
  user_id: string;
  document_type: KycDocumentType;
  document_number: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  status: KycStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useKycVerification() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<KycRecord | null>({
    queryKey: ['kyc-verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as KycRecord | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  // Supabase Realtime subscription for instant KYC approval / rejection feedback
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-kyc-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_verifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          queryClient.setQueryData(['kyc-verification', user.id], payload.new);
          await refreshProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, refreshProfile]);

  const submitKyc = async ({
    documentType,
    documentNumber,
    frontImageBase64,
    selfieImageBase64,
  }: {
    documentType: KycDocumentType;
    documentNumber: string;
    frontImageBase64?: string;
    selfieImageBase64?: string;
  }) => {
    if (!user?.id) throw new Error('Authentication required');

    // Default or uploaded URLs
    const frontUrl = frontImageBase64 
      ? `https://storage.growvest.app/kyc/${user.id}-front.jpg`
      : `kyc-docs/${user.id}/id_front.jpg`;
    const selfieUrl = selfieImageBase64
      ? `https://storage.growvest.app/kyc/${user.id}-selfie.jpg`
      : `kyc-docs/${user.id}/selfie.jpg`;

    // Insert or update KYC record
    const { data, error } = await supabase
      .from('kyc_verifications')
      .upsert({
        user_id: user.id,
        document_type: documentType,
        document_number: documentNumber.trim(),
        document_front_url: frontUrl,
        selfie_url: selfieUrl,
        status: 'pending',
        admin_notes: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update profile kyc_status
    await supabase
      .from('profiles')
      .update({ kyc_status: 'pending' })
      .eq('id', user.id);

    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: ['kyc-verification', user.id] });

    return data;
  };

  return {
    ...query,
    submitKyc,
  };
}
