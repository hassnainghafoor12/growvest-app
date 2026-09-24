import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { WithdrawalAccountType } from '../types/database.types';

export interface WithdrawalAccount {
  id: string;
  user_id: string;
  account_type: WithdrawalAccountType;
  account_name: string;
  account_number_or_address: string;
  bank_name: string | null;
  routing_or_swift: string | null;
  is_default: boolean;
  created_at: string;
}

export function useWithdrawalAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<WithdrawalAccount[]>({
    queryKey: ['withdrawal-accounts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('withdrawal_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WithdrawalAccount[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`realtime-accounts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawal_accounts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['withdrawal-accounts', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const addAccount = async ({
    accountType,
    accountName,
    accountNumber,
    bankName,
    routingOrSwift,
  }: {
    accountType: WithdrawalAccountType;
    accountName: string;
    accountNumber: string;
    bankName?: string;
    routingOrSwift?: string;
  }) => {
    if (!user?.id) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('withdrawal_accounts')
      .insert({
        user_id: user.id,
        account_type: accountType,
        account_name: accountName.trim(),
        account_number_or_address: accountNumber.trim(),
        bank_name: bankName?.trim() || null,
        routing_or_swift: routingOrSwift?.trim() || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['withdrawal-accounts', user.id] });
    return data;
  };

  const deleteAccount = async (accountId: string) => {
    const { error } = await supabase
      .from('withdrawal_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user?.id);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['withdrawal-accounts', user?.id] });
  };

  return {
    ...query,
    addAccount,
    deleteAccount,
  };
}
