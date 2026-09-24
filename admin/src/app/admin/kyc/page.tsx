'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  AlertTriangle,
  Loader2,
  User,
  Filter,
} from 'lucide-react';

interface KycSubmission {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
}

export default function AdminKycPage() {
  const { user: adminUser } = useAdminAuth();

  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalKyc, setRejectModalKyc] = useState<KycSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchKycList = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('kyc_verifications')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubmissions((data || []) as any[]);
    } catch (err) {
      console.error('Failed to load KYC applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKycList();

    // Realtime listener for incoming KYC submissions from mobile app
    const channel = supabase
      .channel('admin-realtime-kyc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kyc_verifications' },
        () => {
          fetchKycList();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  // Handle Approve
  const handleApprove = async (submission: KycSubmission) => {
    setProcessingId(submission.id);
    try {
      // 1. Update kyc_verifications
      const { error: kycErr } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'verified',
          reviewed_by: adminUser?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (kycErr) throw kycErr;

      // 2. Update user profile kyc_status
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ kyc_status: 'verified' })
        .eq('id', submission.user_id);

      if (profErr) throw profErr;

      // 3. Send Notification to mobile app
      await supabase.from('notifications').insert({
        user_id: submission.user_id,
        title: 'KYC Verification Approved!',
        body: 'Your identity documents have been approved. All investment & withdrawal limits are unlocked.',
        type: 'kyc_alert',
        data: { kyc_id: submission.id, status: 'verified' },
      });

      // Update local state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submission.id ? { ...s, status: 'verified' } : s))
      );
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async () => {
    if (!rejectModalKyc) return;
    setProcessingId(rejectModalKyc.id);

    try {
      // 1. Update kyc_verifications
      const { error: kycErr } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          admin_notes: rejectReason.trim() || 'Document image unclear or invalid.',
          reviewed_by: adminUser?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectModalKyc.id);

      if (kycErr) throw kycErr;

      // 2. Update user profile
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ kyc_status: 'rejected' })
        .eq('id', rejectModalKyc.user_id);

      if (profErr) throw profErr;

      // 3. Send Notification to mobile app
      await supabase.from('notifications').insert({
        user_id: rejectModalKyc.user_id,
        title: 'KYC Document Rejected',
        body: `Your identity verification was rejected: ${rejectReason || 'Document invalid'}. Please resubmit.`,
        type: 'kyc_alert',
        data: { kyc_id: rejectModalKyc.id, status: 'rejected', reason: rejectReason },
      });

      setRejectModalKyc(null);
      setRejectReason('');
      fetchKycList();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    const term = search.toLowerCase();
    const email = s.profiles?.email?.toLowerCase() || '';
    const name = s.profiles?.full_name?.toLowerCase() || '';
    const docNo = s.document_number?.toLowerCase() || '';
    return email.includes(term) || name.includes(term) || docNo.includes(term);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '2px 8px',
            borderRadius: '6px',
            letterSpacing: '0.5px',
          }}>
            COMPLIANCE CONTROL
          </span>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Supabase Realtime Sync Enabled</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
          KYC Identity Verifications
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>
          Review government documents submitted by Android users. Approvals and rejections propagate live to the mobile client.
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
            placeholder="Search email, name, or doc ID..."
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

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['pending', 'verified', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid',
                borderColor: filter === tab ? '#10B981' : '#1E293B',
                backgroundColor: filter === tab ? '#10B981' : '#0F172A',
                color: filter === tab ? '#070B14' : '#94A3B8',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
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
            <div>Loading verification records...</div>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <FileCheck2 size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No KYC submissions found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Submissions from the Android app appear here in real time.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Document Type</th>
                <th style={thStyle}>Document Number</th>
                <th style={thStyle}>Submitted</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #1E293B' }}>
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
                        fontWeight: '700',
                        fontSize: '13px',
                      }}>
                        {sub.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                          {sub.profiles?.full_name || 'Anonymous Investor'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{sub.profiles?.email}</div>
                      </div>
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
                      {sub.document_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'monospace' }}>
                      {sub.document_number}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
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
                      backgroundColor:
                        sub.status === 'verified'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : sub.status === 'pending'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                      color:
                        sub.status === 'verified'
                          ? '#10B981'
                          : sub.status === 'pending'
                          ? '#F59E0B'
                          : '#EF4444',
                      textTransform: 'uppercase',
                    }}>
                      {sub.status === 'verified' && <CheckCircle2 size={12} />}
                      {sub.status === 'pending' && <Clock size={12} />}
                      {sub.status === 'rejected' && <XCircle size={12} />}
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {sub.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(sub)}
                            disabled={processingId === sub.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10B981',
                              color: '#070B14',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModalKyc(sub)}
                            disabled={processingId === sub.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Decision Recorded</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalKyc && (
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
              Reject Verification
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '18px' }}>
              State the rejection reason so the investor can resubmit proper documentation.
            </p>

            <textarea
              placeholder="e.g. Document photo is blurry or ID expired. Please upload a clear photo."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
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
                onClick={() => setRejectModalKyc(null)}
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
                disabled={processingId === rejectModalKyc.id}
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
                Confirm Rejection
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
