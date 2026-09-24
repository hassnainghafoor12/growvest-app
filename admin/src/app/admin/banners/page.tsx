'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface BannerItem {
  id: string;
  title: string;
  image_url: string;
  target_screen: string | null;
  action_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetScreen, setTargetScreen] = useState('/(app)/(tabs)/investments');
  const [actionUrl, setActionUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBanners((data || []) as BannerItem[]);
    } catch (err) {
      console.error('Failed to load banners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();

    const channel = supabase
      .channel('admin-realtime-banners')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => {
        fetchBanners();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle('');
    setImageUrl('https://images.unsplash.com/photo-1592417817098-8f3d6910985c?auto=format&fit=crop&w=800&q=80');
    setTargetScreen('/(app)/(tabs)/investments');
    setActionUrl('');
    setDisplayOrder((banners.length + 1).toString());
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (b: BannerItem) => {
    setEditingBanner(b);
    setTitle(b.title);
    setImageUrl(b.image_url);
    setTargetScreen(b.target_screen || '');
    setActionUrl(b.action_url || '');
    setDisplayOrder(b.display_order.toString());
    setIsActive(b.is_active);
    setModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      alert('Please provide banner title and image URL.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('banners')
          .update({
            title: title.trim(),
            image_url: imageUrl.trim(),
            target_screen: targetScreen.trim() || null,
            action_url: actionUrl.trim() || null,
            display_order: parseInt(displayOrder) || 0,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('banners')
          .insert({
            title: title.trim(),
            image_url: imageUrl.trim(),
            target_screen: targetScreen.trim() || null,
            action_url: actionUrl.trim() || null,
            display_order: parseInt(displayOrder) || 0,
            is_active: isActive,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      fetchBanners();
    } catch (err: any) {
      alert(`Error saving banner: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBanner = async (b: BannerItem) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;

    try {
      const { error } = await supabase.from('banners').delete().eq('id', b.id);
      if (error) throw error;
      fetchBanners();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleToggleStatus = async (b: BannerItem) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !b.is_active, updated_at: new Date().toISOString() })
        .eq('id', b.id);

      if (error) throw error;
      fetchBanners();
    } catch (err: any) {
      alert(`Toggle error: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
            Mobile Banners & Promotional Content
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>
            Manage the visual carousel shown at the top of the Android home screen. Toggles reflect in real time.
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
          Add Promotional Banner
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
            <div>Loading banners...</div>
          </div>
        ) : banners.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <ImageIcon size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No banners created yet</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Click "Add Promotional Banner" to publish to mobile.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Banner Title</th>
                <th style={thStyle}>Target In-App Route</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '14px',
                      backgroundColor: '#131B2E',
                      color: '#10B981',
                      fontWeight: '800',
                      fontSize: '12px',
                    }}>
                      #{b.display_order}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{b.title}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.image_url}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#CBD5E1', fontFamily: 'monospace' }}>
                      {b.target_screen || 'Default'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleToggleStatus(b)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: b.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: b.is_active ? '#10B981' : '#EF4444',
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {b.is_active ? 'Active (Live)' : 'Disabled'}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(b)}
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
                        onClick={() => handleDeleteBanner(b)}
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
            maxWidth: '520px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                {editingBanner ? 'Edit Banner' : 'Create Mobile Banner'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Banner Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Agricultural Harvest Yields Available"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Image Asset URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Target In-App Screen</label>
                  <input
                    type="text"
                    placeholder="/(app)/(tabs)/investments"
                    value={targetScreen}
                    onChange={(e) => setTargetScreen(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                />
                <label htmlFor="activeCheck" style={{ fontSize: '13px', color: '#F8FAFC', cursor: 'pointer' }}>
                  Publish immediately (Active on Android app)
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
                  {isSaving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Publish Banner'}
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
