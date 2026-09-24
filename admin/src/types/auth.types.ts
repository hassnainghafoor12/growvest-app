import { Session, User } from '@supabase/supabase-js';

export interface AdminProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'pending_verification';
  created_at: string;
}

export interface AdminAuthState {
  session: Session | null;
  user: User | null;
  profile: AdminProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInAdmin: (email: string, password: string) => Promise<{ error: Error | null; isNotAdmin?: boolean }>;
  signOutAdmin: () => Promise<void>;
}
