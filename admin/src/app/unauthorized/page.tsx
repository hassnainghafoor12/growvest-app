'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { signOutAdmin } = useAdminAuth();

  const handleReturn = async () => {
    await signOutAdmin();
    router.replace('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#070B14',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '36px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#EF4444',
          marginBottom: '20px',
        }}>
          <ShieldAlert size={36} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
          Access Denied
        </h1>

        <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '22px', marginBottom: '24px' }}>
          Your current account is authenticated as a standard user role. The administrative portal requires explicit <strong>admin</strong> or <strong>super_admin</strong> authorization enforced by PostgreSQL Row Level Security.
        </p>

        <button
          onClick={handleReturn}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '46px',
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <ArrowLeft size={16} />
          Sign Out & Return to Login
        </button>
      </div>
    </div>
  );
}
