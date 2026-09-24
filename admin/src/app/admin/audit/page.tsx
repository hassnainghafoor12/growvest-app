'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  Loader2,
  Calendar,
  Eye,
  X,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_data: any;
  new_data: any;
  ip_address: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:actor_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data || []) as any[]);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('admin-realtime-audit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter((l) => {
    const term = search.toLowerCase();
    const action = l.action.toLowerCase();
    const entity = l.entity_type.toLowerCase();
    const email = l.profiles?.email?.toLowerCase() || '';
    return action.includes(term) || entity.includes(term) || email.includes(term);
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
          }}>
            SECURITY & COMPLIANCE
          </span>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Append-Only Ledger Protected by PostgreSQL RLS</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
          Audit Trail & Activity Log
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>
          Immutable record of administrative reviews, transaction approvals, and role updates.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: '10px',
          padding: '0 14px',
          width: '360px',
          height: '42px',
        }}>
          <Search size={16} color="#64748B" style={{ marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Search action, entity, or admin email..."
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
            <div>Loading security audit records...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <History size={40} color="#334155" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600' }}>No audit events logged yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0B1120' }}>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Entity</th>
                <th style={thStyle}>Actor</th>
                <th style={thStyle}>Timestamp</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Payload Diff</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={tdStyle}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#CBD5E1', textTransform: 'uppercase' }}>
                      {log.entity_type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#F8FAFC' }}>
                        {log.profiles?.full_name || 'System / Admin'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{log.profiles?.email || 'automated'}</div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedLog(log)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: '#1E293B',
                        color: '#E2E8F0',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      <Eye size={13} />
                      Inspect Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inspect Diff Modal */}
      {selectedLog && (
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
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                  {selectedLog.action}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Target ID: {selectedLog.entity_id || 'N/A'} • {new Date(selectedLog.created_at).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedLog.previous_data && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#EF4444', marginBottom: '4px' }}>
                    PREVIOUS STATE
                  </div>
                  <pre style={codeBlockStyle}>
                    {JSON.stringify(selectedLog.previous_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>
                    NEW STATE
                  </div>
                  <pre style={codeBlockStyle}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
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

const codeBlockStyle: React.CSSProperties = {
  backgroundColor: '#131B2E',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  padding: '12px',
  color: '#F8FAFC',
  fontSize: '12px',
  overflowX: 'auto',
  margin: 0,
};
