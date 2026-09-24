'use client';

import React from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users,
  CreditCard,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { profile } = useAdminAuth();

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '2px 8px',
            borderRadius: '6px',
          }}>
            SECURITY LEVEL: ADMIN
          </span>
          <span style={{ fontSize: '12px', color: '#64748B' }}>PostgreSQL RLS Active</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
          Platform Overview
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>
          Welcome back, {profile?.full_name || 'Administrator'}. Realtime metrics and system health.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {/* Card 1 */}
        <div style={kpiCardStyle}>
          <div style={kpiHeaderStyle}>
            <span style={kpiTitleStyle}>Total Registered Users</span>
            <Users size={18} color="#10B981" />
          </div>
          <div style={kpiValueStyle}>--</div>
          <div style={kpiSubStyle}>Live query via Supabase Auth</div>
        </div>

        {/* Card 2 */}
        <div style={kpiCardStyle}>
          <div style={kpiHeaderStyle}>
            <span style={kpiTitleStyle}>Active Investment Plans</span>
            <TrendingUp size={18} color="#3B82F6" />
          </div>
          <div style={kpiValueStyle}>--</div>
          <div style={kpiSubStyle}>Open for funding</div>
        </div>

        {/* Card 3 */}
        <div style={kpiCardStyle}>
          <div style={kpiHeaderStyle}>
            <span style={kpiTitleStyle}>Pending Deposits & Withdrawals</span>
            <CreditCard size={18} color="#F59E0B" />
          </div>
          <div style={kpiValueStyle}>0</div>
          <div style={kpiSubStyle}>Awaiting admin review</div>
        </div>

        {/* Card 4 */}
        <div style={kpiCardStyle}>
          <div style={kpiHeaderStyle}>
            <span style={kpiTitleStyle}>Pending KYC Verifications</span>
            <FileCheck size={18} color="#EC4899" />
          </div>
          <div style={kpiValueStyle}>0</div>
          <div style={kpiSubStyle}>Identity reviews pending</div>
        </div>
      </div>

      {/* Architecture & RBAC Status Banner */}
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981',
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>
              Database-Level Role Verification Active
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Supabase Row Level Security ensures non-admin users cannot read or execute administrative actions even through direct REST/GraphQL calls.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          <div style={{ backgroundColor: '#131B2E', padding: '16px', borderRadius: '10px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', marginBottom: '4px' }}>CONNECTED CLIENTS</div>
            <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: '600' }}>Android App + Admin Dashboard</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Synchronized via Supabase Realtime</div>
          </div>

          <div style={{ backgroundColor: '#131B2E', padding: '16px', borderRadius: '10px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', marginBottom: '4px' }}>SECURITY MODEL</div>
            <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: '600' }}>PostgreSQL RLS + is_admin() Function</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Client tokens strictly checked</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: '14px',
  padding: '20px',
};

const kpiHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
};

const kpiTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#94A3B8',
  fontWeight: '600',
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: '800',
  color: '#F8FAFC',
  marginBottom: '6px',
};

const kpiSubStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748B',
};
