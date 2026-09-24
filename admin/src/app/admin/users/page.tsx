'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { dispatchAdminPushNotification } from '../../../lib/pushDispatcher';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  X,
  Wallet,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'pending_verification';
  kyc_status: 'not_submitted' | 'pending' | 'verified' | 'rejected';
  referral_code: string;
  created_at: string;
  wallets?: {
    available_balance: number;
    invested_balance: number;
    total_profit: number;
  }[];
}

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAdminAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [newStatus, setNewStatus] = useState<'active' | 'suspended' | 'pending_verification'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          wallets (
            available_balance,
            invested_balance,
            total_profit
          )
        `)
        .order('created_at', { ascending: false });

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers((data || []) as any[]);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('admin-realtime-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roleFilter, statusFilter]);

  const handleEditClick = (u: UserProfile) => {
    setEditingUser(u);
    setNewRole(u.role);
    setNewStatus(u.status);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        actor_id: currentAdmin?.id,
        action: 'USER_ROLE_OR_STATUS_UPDATE',
        entity_type: 'profiles',
        entity_id: editingUser.id,
        previous_data: { role: editingUser.role, status: editingUser.status },
        new_data: { role: newRole, status: newStatus },
      });

      // Dispatch Android Push Notification: Admin -> Supabase -> Edge Function -> Push Service -> Android Device
      if (editingUser.status !== newStatus) {
        await dispatchAdminPushNotification({
          userId: editingUser.id,
          title: 'Growvest Status Update',
          body: `Your Growvest status has changed. Your account status is now ${newStatus.replace('_', ' ')}.`,
          notificationType: 'account_status',
          data: { screen: 'profile', status: newStatus },
        });
      } else if (editingUser.role !== newRole) {
        await dispatchAdminPushNotification({
          userId: editingUser.id,
          title: 'Growvest Account Update',
          body: `Your Growvest role has been updated to ${newRole.replace('_', ' ')}.`,
          notificationType: 'account_status',
          data: { screen: 'profile', role: newRole },
        });
      }

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(`Error updating user: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    const email = u.email?.toLowerCase() || '';
    const name = u.full_name?.toLowerCase() || '';
    const code = u.referral_code?.toLowerCase() || '';
    return email.includes(term) || name.includes(term) || code.includes(term);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
          User & Investor Management
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>
          Realtime directory of registered mobile users, KYC verification tiers, roles, and account statuses.
        </p>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search email, name, or referral..."
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
        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={selectFilterStyle}
          >
            <option value="all">All Roles</option>
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={selectFilterStyle}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} color="#10B981" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading users directory...</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <Users size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No users match criteria</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Investor Details</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>KYC Status</th>
                <th style={thStyle}>Referral Code</th>
                <th style={thStyle}>Wallet Balance</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const wallet = u.wallets?.[0];
                const availBal = Number(wallet?.available_balance || 0);

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '17px',
                          backgroundColor: '#1E293B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#10B981',
                          fontWeight: '800',
                          fontSize: '13px',
                        }}>
                          {u.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                            {u.full_name || 'Anonymous Investor'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: u.role === 'admin' ? 'rgba(16, 185, 129, 0.1)' : '#131B2E',
                        color: u.role === 'admin' ? '#10B981' : '#94A3B8',
                        textTransform: 'uppercase',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: u.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: u.status === 'active' ? '#10B981' : '#EF4444',
                        textTransform: 'uppercase',
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color:
                          u.kyc_status === 'verified'
                            ? '#10B981'
                            : u.kyc_status === 'pending'
                            ? '#F59E0B'
                            : '#64748B',
                        textTransform: 'uppercase',
                      }}>
                        {u.kyc_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#10B981' }}>
                        {u.referral_code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                        ${availBal.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => handleEditClick(u)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          backgroundColor: '#1E293B',
                          color: '#E2E8F0',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                Edit User Account
              </h3>
              <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>USER EMAIL</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{editingUser.email}</div>
            </div>

            {/* Role selector */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '8px' }}>
                ROLE PERMISSIONS
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                style={modalSelectStyle}
              >
                <option value="user">Standard User (Investor)</option>
                <option value="admin">Administrator (Full Dashboard Access)</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>

            {/* Status selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '8px' }}>
                ACCOUNT STATUS
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                style={modalSelectStyle}
              >
                <option value="active">Active (Permitted)</option>
                <option value="suspended">Suspended (Blocked from investing)</option>
                <option value="pending_verification">Pending Verification</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setEditingUser(null)}
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
                onClick={handleSaveUser}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10B981',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#070B14',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
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

const selectFilterStyle: React.CSSProperties = {
  backgroundColor: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  color: '#CBD5E1',
  fontSize: '13px',
  padding: '0 12px',
  height: '42px',
  outline: 'none',
  cursor: 'pointer',
};

const modalSelectStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#131B2E',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  color: '#F8FAFC',
  fontSize: '13px',
  padding: '10px 12px',
  outline: 'none',
};
