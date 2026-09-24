'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Bell,
  Send,
  Plus,
  Trash2,
  Users,
  User,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface NotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  } | null;
}

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notificationType, setNotificationType] = useState('system_announcement');
  const [isSending, setIsSending] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data || []) as any[]);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserOptions = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, email, full_name').limit(100);
      setUserOptions((data || []) as UserOption[]);
    } catch (err) {
      console.error('Failed to fetch user list:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUserOptions();

    const channel = supabase
      .channel('admin-realtime-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert('Please fill out both title and body.');
      return;
    }

    if (!isBroadcast && !selectedUserId) {
      alert('Please select a recipient user or choose broadcast to all.');
      return;
    }

    setIsSending(true);
    try {
      const targetUserId = isBroadcast ? null : selectedUserId;

      const { error } = await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: title.trim(),
        body: body.trim(),
        type: notificationType as any,
        data: { broadcast: isBroadcast },
      });

      if (error) throw error;

      setModalOpen(false);
      setTitle('');
      setBody('');
      fetchNotifications();
    } catch (err: any) {
      alert(`Send error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
            Push & In-App Notifications
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>
            Broadcast alerts or message individual investors. Delivered instantly to Android devices via Supabase Realtime.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#10B981',
            color: '#070B14',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <Send size={16} />
          Send New Notification
        </button>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} color="#10B981" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading notifications log...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <Bell size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No notifications dispatched yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Recipient</th>
                <th style={thStyle}>Title & Message</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Sent Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={tdStyle}>
                    {n.user_id ? (
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                          {n.profiles?.full_name || 'Individual'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{n.profiles?.email}</div>
                      </div>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#064E3B',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        color: '#34D399',
                        fontSize: '11px',
                        fontWeight: '800',
                      }}>
                        <Users size={12} />
                        ALL INVESTORS
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', maxWidth: '400px' }}>
                      {n.body}
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
                      {n.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteNotification(n.id)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#EF4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Notification Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '520px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                Dispatch Notification
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Audience Mode */}
              <div>
                <label style={labelStyle}>Recipient Audience</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsBroadcast(true)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isBroadcast ? '#10B981' : '#1E293B',
                      backgroundColor: isBroadcast ? 'rgba(16, 185, 129, 0.1)' : '#131B2E',
                      color: isBroadcast ? '#10B981' : '#94A3B8',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Broadcast to All Users
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBroadcast(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: !isBroadcast ? '#10B981' : '#1E293B',
                      backgroundColor: !isBroadcast ? 'rgba(16, 185, 129, 0.1)' : '#131B2E',
                      color: !isBroadcast ? '#10B981' : '#94A3B8',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Specific User
                  </button>
                </div>
              </div>

              {!isBroadcast && (
                <div>
                  <label style={labelStyle}>Select Target User</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">-- Choose User --</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle}>Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dividend Distribution Completed"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Notification Message Body</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Write message details for the mobile alert..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Category Type</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="system_announcement">System Announcement</option>
                  <option value="investment_update">Investment Update</option>
                  <option value="security_alert">Security Alert</option>
                  <option value="transaction_status">Transaction Status</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1E293B',
                    color: '#94A3B8',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#10B981',
                    color: '#070B14',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSending ? 'Dispatching...' : 'Dispatch Notification'}
                </button>
              </div>
            </form>
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '700',
  color: '#CBD5E1',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#131B2E',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  color: '#F8FAFC',
  fontSize: '13px',
  padding: '10px 12px',
  outline: 'none',
};
