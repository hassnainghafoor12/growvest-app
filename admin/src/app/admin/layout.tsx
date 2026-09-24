'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  CreditCard,
  FileCheck2,
  Bell,
  Sliders,
  LogOut,
  Shield,
  Layers,
  Image as ImageIcon,
  History,
  Loader2,
} from 'lucide-react';

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, isAdmin, isLoading, signOutAdmin } = useAdminAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        router.replace('/login');
      } else if (!isAdmin) {
        router.replace('/unauthorized');
      }
    }
  }, [session, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#070B14',
        color: '#94A3B8',
        gap: '16px',
      }}>
        <Loader2 size={36} color="#10B981" className="animate-spin" />
        <span style={{ fontSize: '14px' }}>Verifying administrative permissions...</span>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  const handleSignOut = async () => {
    await signOutAdmin();
    router.replace('/login');
  };

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'User Management', icon: Users },
    { href: '/admin/plans', label: 'Investment Plans', icon: TrendingUp },
    { href: '/admin/transactions', label: 'Transactions', icon: CreditCard },
    { href: '/admin/kyc', label: 'KYC Verifications', icon: FileCheck2 },
    { href: '/admin/banners', label: 'Banners & Content', icon: ImageIcon },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    { href: '/admin/settings', label: 'System Settings', icon: Sliders },
    { href: '/admin/audit', label: 'Audit Logs', icon: History },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070B14' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: '#0B1120',
        borderRight: '1px solid #1E293B',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px', marginBottom: '32px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#070B14',
            fontWeight: '800',
          }}>
            G
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>Growvest</div>
            <div style={{ fontSize: '11px', color: '#10B981', fontWeight: '600', letterSpacing: '0.5px' }}>ADMIN CONSOLE</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  color: isActive ? '#070B14' : '#94A3B8',
                  backgroundColor: isActive ? '#10B981' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer & Logout */}
        <div style={{
          borderTop: '1px solid #1E293B',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: '#1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34D399',
            }}>
              <Shield size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.full_name || 'Admin'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize' }}>
                {profile?.role || 'admin'}
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#EF4444',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {children}
      </main>
    </div>
  );
}
