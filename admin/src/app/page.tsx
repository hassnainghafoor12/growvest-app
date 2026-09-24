'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { session, isAdmin, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading) {
      if (session && isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/login');
      }
    }
  }, [session, isAdmin, isLoading, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#070B14',
    }}>
      <Loader2 size={32} color="#10B981" className="animate-spin" />
    </div>
  );
}
