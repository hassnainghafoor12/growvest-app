export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'pending_verification';
export type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type KycDocumentType = 'national_id' | 'passport' | 'drivers_license';

export type PlanCategory = 'agriculture' | 'livestock' | 'real_estate' | 'fixed_income' | 'green_energy' | 'technology';
export type PlanRiskLevel = 'low' | 'moderate' | 'high';
export type PlanStatus = 'draft' | 'upcoming' | 'open' | 'funded' | 'active' | 'completed' | 'cancelled';
export type ReturnPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'at_maturity';

export type InvestmentStatus = 'active' | 'matured' | 'cancelled' | 'liquidated';
export type TransactionType = 'deposit' | 'withdrawal' | 'investment_debit' | 'profit_payout' | 'principal_return' | 'referral_bonus' | 'admin_adjustment';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
export type PaymentGateway = 'bank_transfer' | 'crypto' | 'card' | 'manual_deposit' | 'wallet_transfer';
export type WithdrawalAccountType = 'bank_account' | 'crypto_wallet' | 'paypal' | 'mobile_money';
export type NotificationType = 'investment_update' | 'transaction_status' | 'kyc_alert' | 'system_announcement' | 'security_alert';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  kyc_status: KycStatus;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  invested_balance: number;
  total_profit: number;
  total_withdrawn: number;
  locked_balance: number;
  created_at: string;
  updated_at: string;
}

export interface InvestmentPlan {
  id: string;
  title: string;
  slug: string;
  category: PlanCategory;
  description: string;
  image_url: string;
  min_investment: number;
  max_investment: number;
  expected_return_rate: number;
  return_period: ReturnPeriod;
  duration_days: number;
  risk_level: PlanRiskLevel;
  funding_goal: number;
  total_funded: number;
  status: PlanStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  invested_amount: number;
  expected_return_amount: number;
  accumulated_profit: number;
  status: InvestmentStatus;
  start_date: string;
  maturity_date: string;
  last_payout_at: string | null;
  auto_reinvest: boolean;
  created_at: string;
  updated_at: string;
  investment_plans?: InvestmentPlan;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  status: TransactionStatus;
  payment_method: PaymentGateway;
  reference_id: string;
  proof_of_payment_url: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
