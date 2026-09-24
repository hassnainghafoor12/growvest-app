'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';

interface TransactionItem {
  id: string;
  user_id: string;
  wallet_id: string;
  type: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  payment_method: string;
  reference_id: string;
  proof_of_payment_url: string | null;
  admin_notes: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export default function AdminTransactionsPage() {
  const { user: currentAdmin } = useAdminAuth();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject modal
  const [rejectModalTx, setRejectModalTx] = useState<TransactionItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions((data || []) as any[]);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel('admin-realtime-tx')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, typeFilter]);

  // Handle Approve
  const handleApprove = async (tx: TransactionItem) => {
    setProcessingId(tx.id);
    try {
      // 1. Fetch wallet
      const { data: wallet, error: wErr } = await supabase
        .from('wallets')
        .select('id, available_balance, locked_balance, total_withdrawn')
        .eq('id', tx.wallet_id)
        .single();

      if (wErr) throw wErr;

      if (tx.type === 'deposit') {
        // Credit available balance
        await supabase
          .from('wallets')
          .update({
            available_balance: Number(wallet.available_balance) + Number(tx.net_amount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);
      } else if (tx.type === 'withdrawal') {
        // Confirm withdrawal: subtract from locked and add to total_withdrawn
        await supabase
          .from('wallets')
          .update({
            locked_balance: Math.max(0, Number(wallet.locked_balance) - Number(tx.amount)),
            total_withdrawn: Number(wallet.total_withdrawn) + Number(tx.net_amount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);
      }

      // 2. Update transaction status
      const { error: txErr } = await supabase
        .from('transactions')
        .update({
          status: 'approved',
          reviewed_by: currentAdmin?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (txErr) throw txErr;

      // 3. Notify User
      await supabase.from('notifications').insert({
        user_id: tx.user_id,
        title: 'Transaction Approved!',
        body: `Your ${tx.type} of ${tx.currency} ${Number(tx.amount).toFixed(2)} has been approved.`,
        type: 'transaction_status',
        data: { transaction_id: tx.id, status: 'approved' },
      });

      // 4. Audit Log
      await supabase.from('audit_logs').insert({
        actor_id: currentAdmin?.id,
        action: 'TRANSACTION_APPROVED',
        entity_type: 'transactions',
        entity_id: tx.id,
        previous_data: { status: tx.status },
        new_data: { status: 'approved' },
      });

      fetchTransactions();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async () => {
    if (!rejectModalTx) return;
    setProcessingId(rejectModalTx.id);

    try {
      // If withdrawal, refund locked balance back to available
      if (rejectModalTx.type === 'withdrawal') {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id, available_balance, locked_balance')
          .eq('id', rejectModalTx.wallet_id)
          .single();

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              locked_balance: Math.max(0, Number(wallet.locked_balance) - Number(rejectModalTx.amount)),
              available_balance: Number(wallet.available_balance) + Number(rejectModalTx.amount),
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        }
      }

      // Update transaction status
      const { error: txErr } = await supabase
        .from('transactions')
        .update({
          status: 'rejected',
          admin_notes: rejectNotes.trim() || 'Payment proof invalid or bank details incorrect.',
          reviewed_by: currentAdmin?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectModalTx.id);

      if (txErr) throw txErr;

      // Notify User
      await supabase.from('notifications').insert({
        user_id: rejectModalTx.user_id,
        title: 'Transaction Declined',
        body: `Your ${rejectModalTx.type} request was declined: ${rejectNotes || 'Invalid payment verification'}.`,
        type: 'transaction_status',
        data: { transaction_id: rejectModalTx.id, status: 'rejected' },
      });

      setRejectModalTx(null);
      setRejectNotes('');
      fetchTransactions();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = transactions.filter((t) => {
    const term = search.toLowerCase();
    const email = t.profiles?.email?.toLowerCase() || '';
    const ref = t.reference_id?.toLowerCase() || '';
    return email.includes(term) || ref.includes(term);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
          Transactions & Financial Ledger
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>
          Review and reconcile deposits, withdrawals, and payouts. Approvals atomically credit or disburse user balances.
        </p>
      </div>

      {/* Control Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '10px',
          padding: '0 14px',
          width: '320px',
          height: '42px',
        }}>
          <Search size={16} color="#64748B" style={{ marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Search email or reference ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F8FAFC',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['pending', 'approved', 'rejected', 'completed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid',
                borderColor: statusFilter === tab ? '#10B981' : '#1E293B',
                backgroundColor: statusFilter === tab ? '#10B981' : '#0F172A',
                color: statusFilter === tab ? '#070B14' : '#94A3B8',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} color="#10B981" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading ledger records...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <CreditCard size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No transactions found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Deposits and withdrawal requests from Android app appear live.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Type & Reference</th>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#131B2E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeft size={16} color="#10B981" />
                        ) : tx.type === 'withdrawal' ? (
                          <ArrowUpRight size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#3B82F6" />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC', textTransform: 'uppercase' }}>
                          {tx.type.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                          {tx.reference_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#F8FAFC' }}>
                      {tx.profiles?.full_name || 'Investor'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{tx.profiles?.email}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#F8FAFC' }}>
                      {tx.currency} {Number(tx.amount).toFixed(2)}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      backgroundColor: '#131B2E',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#E2E8F0',
                      textTransform: 'uppercase',
                    }}>
                      {tx.payment_method.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor:
                        tx.status === 'approved' || tx.status === 'completed'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : tx.status === 'pending'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                      color:
                        tx.status === 'approved' || tx.status === 'completed'
                          ? '#10B981'
                          : tx.status === 'pending'
                          ? '#F59E0B'
                          : '#EF4444',
                      textTransform: 'uppercase',
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {tx.status === 'pending' ? (
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApprove(tx)}
                          disabled={processingId === tx.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10B981',
                            color: '#070B14',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModalTx(tx)}
                          disabled={processingId === tx.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#EF4444',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalTx && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '440px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
              Decline Transaction
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>
              Reason for declining this {rejectModalTx.type} of {rejectModalTx.currency} {Number(rejectModalTx.amount).toFixed(2)}:
            </p>

            <textarea
              placeholder="e.g. Deposit slip transaction hash does not match blockchain records."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                backgroundColor: '#131B2E',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '12px',
                color: '#F8FAFC',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                marginBottom: '18px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRejectModalTx(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1E293B',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#94A3B8',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={processingId === rejectModalTx.id}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#EF4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 18px',
  fontSize: '11px',
  fontWeight: '800',
  color: '#64748B',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '16px 18px',
  verticalAlign: 'middle',
};
