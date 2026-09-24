'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users,
  CreditCard,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Clock,
  Layers,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface MetricCounts {
  usersCount: number;
  openPlansCount: number;
  pendingTxCount: number;
  pendingKycCount: number;
  totalFunded: number;
}

interface RecentActivity {
  id: string;
  type: 'kyc' | 'transaction' | 'plan';
  title: string;
  subtitle: string;
  time: string;
  status: string;
}

export default function AdminDashboardPage() {
  const { profile } = useAdminAuth();

  const [metrics, setMetrics] = useState<MetricCounts>({
    usersCount: 0,
    openPlansCount: 0,
    pendingTxCount: 0,
    pendingKycCount: 0,
    totalFunded: 0,
  });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user count
      const { count: uCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 2. Fetch open investment plans
      const { data: plansData, count: pCount } = await supabase
        .from('investment_plans')
        .select('total_funded', { count: 'exact' })
        .eq('status', 'open');

      const sumFunded = (plansData || []).reduce((acc, curr) => acc + Number(curr.total_funded || 0), 0);

      // 3. Fetch pending transactions
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 4. Fetch pending KYC
      const { count: kycCount } = await supabase
        .from('kyc_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setMetrics({
        usersCount: uCount || 0,
        openPlansCount: pCount || 0,
        pendingTxCount: txCount || 0,
        pendingKycCount: kycCount || 0,
        totalFunded: sumFunded,
      });

      // 5. Fetch recent transactions for live activity
      const { data: recentTx } = await supabase
        .from('transactions')
        .select('id, type, amount, currency, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const mappedActivities: RecentActivity[] = (recentTx || []).map((tx) => ({
        id: tx.id,
        type: 'transaction',
        title: `${tx.type.replace('_', ' ').toUpperCase()} of ${tx.currency} ${Number(tx.amount).toFixed(2)}`,
        subtitle: `Status: ${tx.status}`,
        time: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: tx.status,
      }));

      setActivities(mappedActivities);
    } catch (err) {
      console.error('Failed to load admin overview metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Supabase Realtime listeners for overview counters
    const channel = supabase
      .channel('admin-overview-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_verifications' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              color: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '2px 8px',
              borderRadius: '6px',
            }}>
              GROWVEST CORE v1.0
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>PostgreSQL RLS Active • Single Supabase Backend</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC' }}>
            Executive Overview
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>
            Welcome back, {profile?.full_name || 'Administrator'}. Realtime database synchronization is active.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            backgroundColor: '#131B2E',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            color: '#E2E8F0',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {/* Users */}
        <Link href="/admin/users" style={kpiLinkStyle}>
          <div style={kpiCardStyle}>
            <div style={kpiHeaderStyle}>
              <span style={kpiTitleStyle}>Total Registered Users</span>
              <Users size={20} color="#10B981" />
            </div>
            <div style={kpiValueStyle}>{isLoading ? '...' : metrics.usersCount}</div>
            <div style={kpiSubStyle}>Manage roles & accounts →</div>
          </div>
        </Link>

        {/* Open Plans */}
        <Link href="/admin/plans" style={kpiLinkStyle}>
          <div style={kpiCardStyle}>
            <div style={kpiHeaderStyle}>
              <span style={kpiTitleStyle}>Open Investment Plans</span>
              <TrendingUp size={20} color="#3B82F6" />
            </div>
            <div style={kpiValueStyle}>{isLoading ? '...' : metrics.openPlansCount}</div>
            <div style={kpiSubStyle}>Create or edit projects →</div>
          </div>
        </Link>

        {/* Pending Transactions */}
        <Link href="/admin/transactions" style={kpiLinkStyle}>
          <div style={{ ...kpiCardStyle, borderColor: metrics.pendingTxCount > 0 ? '#F59E0B' : '#1E293B' }}>
            <div style={kpiHeaderStyle}>
              <span style={kpiTitleStyle}>Pending Transactions</span>
              <CreditCard size={20} color="#F59E0B" />
            </div>
            <div style={{ ...kpiValueStyle, color: metrics.pendingTxCount > 0 ? '#F59E0B' : '#F8FAFC' }}>
              {isLoading ? '...' : metrics.pendingTxCount}
            </div>
            <div style={kpiSubStyle}>
              {metrics.pendingTxCount > 0 ? 'Action required: Review requests →' : 'All transactions reviewed'}
            </div>
          </div>
        </Link>

        {/* Pending KYC */}
        <Link href="/admin/kyc" style={kpiLinkStyle}>
          <div style={{ ...kpiCardStyle, borderColor: metrics.pendingKycCount > 0 ? '#EC4899' : '#1E293B' }}>
            <div style={kpiHeaderStyle}>
              <span style={kpiTitleStyle}>Pending KYC Reviews</span>
              <FileCheck size={20} color="#EC4899" />
            </div>
            <div style={{ ...kpiValueStyle, color: metrics.pendingKycCount > 0 ? '#EC4899' : '#F8FAFC' }}>
              {isLoading ? '...' : metrics.pendingKycCount}
            </div>
            <div style={kpiSubStyle}>
              {metrics.pendingKycCount > 0 ? 'Identity documents pending →' : 'All profiles compliant'}
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Action Dispatch Center */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }}>
        {/* Left: Quick Actions */}
        <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC', marginBottom: '16px' }}>
            Administrative Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link href="/admin/plans" style={actionBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={18} color="#10B981" />
                <span>Publish New Investment Plan</span>
              </div>
              <ArrowUpRight size={16} color="#64748B" />
            </Link>

            <Link href="/admin/transactions" style={actionBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={18} color="#F59E0B" />
                <span>Approve / Reject Deposits & Payouts</span>
              </div>
              <ArrowUpRight size={16} color="#64748B" />
            </Link>

            <Link href="/admin/kyc" style={actionBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCheck size={18} color="#EC4899" />
                <span>Verify Investor Identity Documents</span>
              </div>
              <ArrowUpRight size={16} color="#64748B" />
            </Link>

            <Link href="/admin/notifications" style={actionBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={18} color="#3B82F6" />
                <span>Broadcast Push Alert to Android Devices</span>
              </div>
              <ArrowUpRight size={16} color="#64748B" />
            </Link>
          </div>
        </div>

        {/* Right: Live Ledger & Event Feed */}
        <div style={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
              Live Ledger Feed
            </h2>
            <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700' }}>● REALTIME</span>
          </div>

          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B', fontSize: '13px' }}>
              No recent ledger events. Transactions placed on Android app appear here live.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    backgroundColor: '#131B2E',
                    border: '1px solid #1E293B',
                    borderRadius: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>{act.title}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{act.subtitle}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{act.time}</div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      color: act.status === 'approved' || act.status === 'completed' ? '#10B981' : '#F59E0B',
                      textTransform: 'uppercase',
                    }}>
                      {act.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const kpiLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  display: 'block',
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: '14px',
  padding: '20px',
  transition: 'border-color 0.2s',
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
  fontSize: '32px',
  fontWeight: '800',
  color: '#F8FAFC',
  marginBottom: '6px',
};

const kpiSubStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#10B981',
  fontWeight: '600',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: '#131B2E',
  border: '1px solid #1E293B',
  borderRadius: '10px',
  color: '#F8FAFC',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '600',
  transition: 'background 0.2s',
};
