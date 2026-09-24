'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  ShieldCheck,
  Lock,
  Globe,
} from 'lucide-react';

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const { user: currentAdmin } = useAdminAuth();

  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [key, setKey] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key', { ascending: true });

      if (error) throw error;
      setSettings((data || []) as SystemSetting[]);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel('admin-realtime-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openCreateModal = () => {
    setEditingSetting(null);
    setKey('');
    setValueStr('{"enabled": false}');
    setDescription('');
    setIsPublic(true);
    setModalOpen(true);
  };

  const openEditModal = (s: SystemSetting) => {
    setEditingSetting(s);
    setKey(s.key);
    setValueStr(typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value));
    setDescription(s.description || '');
    setIsPublic(s.is_public);
    setModalOpen(true);
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      alert('Key is required.');
      return;
    }

    let parsedValue: any = valueStr;
    try {
      parsedValue = JSON.parse(valueStr);
    } catch {
      parsedValue = valueStr;
    }

    setIsSaving(true);
    try {
      if (editingSetting) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: parsedValue,
            description: description.trim() || null,
            is_public: isPublic,
            updated_by: currentAdmin?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSetting.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key: key.trim().toLowerCase(),
            value: parsedValue,
            description: description.trim() || null,
            is_public: isPublic,
            updated_by: currentAdmin?.id,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      fetchSettings();
    } catch (err: any) {
      alert(`Error saving setting: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSetting = async (s: SystemSetting) => {
    if (!confirm(`Delete configuration "${s.key}"?`)) return;

    try {
      const { error } = await supabase.from('system_settings').delete().eq('id', s.id);
      if (error) throw error;
      fetchSettings();
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
            System Settings & Parameters
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>
            Control app runtime settings, financial thresholds, maintenance modes, and Android client flags.
          </p>
        </div>

        <button
          onClick={openCreateModal}
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
          <Plus size={16} />
          Add Configuration
        </button>
      </div>

      {/* Settings Table */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={32} color="#10B981" className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <div>Loading system parameters...</div>
          </div>
        ) : settings.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <Sliders size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No parameters configured</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Configuration Key</th>
                <th style={thStyle}>Config Value</th>
                <th style={thStyle}>Scope</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Last Updated</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: '#10B981' }}>
                      {s.key}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <pre style={{
                      backgroundColor: '#131B2E',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#E2E8F0',
                      maxWidth: '240px',
                      overflowX: 'auto',
                      margin: 0,
                    }}>
                      {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
                    </pre>
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
                      backgroundColor: s.is_public ? 'rgba(16, 185, 129, 0.1)' : '#131B2E',
                      color: s.is_public ? '#10B981' : '#94A3B8',
                    }}>
                      {s.is_public ? <Globe size={11} /> : <Lock size={11} />}
                      {s.is_public ? 'Public (App)' : 'Admin Only'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {s.description || '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {new Date(s.updated_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(s)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#1E293B',
                          color: '#E2E8F0',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteSetting(s)}
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
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
            maxWidth: '500px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                {editingSetting ? 'Edit Configuration' : 'Add Configuration'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSetting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Config Key</label>
                <input
                  type="text"
                  required
                  disabled={!!editingSetting}
                  placeholder="e.g. min_withdrawal_usd"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  style={{ ...inputStyle, opacity: editingSetting ? 0.6 : 1 }}
                />
              </div>

              <div>
                <label style={labelStyle}>Value (JSON or Scalar)</label>
                <textarea
                  required
                  rows={4}
                  placeholder='e.g. 50.00 or {"enabled": true}'
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <input
                  type="text"
                  placeholder="Purpose of this configuration..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="publicCheck"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                />
                <label htmlFor="publicCheck" style={{ fontSize: '13px', color: '#F8FAFC', cursor: 'pointer' }}>
                  Public (Readable by mobile client)
                </label>
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
                  disabled={isSaving}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#10B981',
                    color: '#070B14',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Saving...' : editingSetting ? 'Update Setting' : 'Save Setting'}
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
