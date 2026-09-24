-- ==============================================================================
-- GROWVEST DATABASE SCHEMA MIGRATION
-- Migration: 20260925000000_growvest_schema.sql
-- Description: Complete production schema, RLS, functions, triggers, and storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status_type AS ENUM ('not_submitted', 'pending', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_document_type AS ENUM ('national_id', 'passport', 'drivers_license');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_category AS ENUM (
    'agriculture', 
    'livestock', 
    'real_estate', 
    'fixed_income', 
    'green_energy', 
    'technology'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_risk_level AS ENUM ('low', 'moderate', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('draft', 'upcoming', 'open', 'funded', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE return_period_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'at_maturity');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE investment_status AS ENUM ('active', 'matured', 'cancelled', 'liquidated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'deposit', 
    'withdrawal', 
    'investment_debit', 
    'profit_payout', 
    'principal_return', 
    'referral_bonus', 
    'admin_adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM (
    'pending', 
    'approved', 
    'rejected', 
    'processing', 
    'completed', 
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_gateway AS ENUM (
    'bank_transfer', 
    'crypto', 
    'card', 
    'manual_deposit', 
    'wallet_transfer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE withdrawal_account_type AS ENUM ('bank_account', 'crypto_wallet', 'paypal', 'mobile_money');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'investment_update', 
    'transaction_status', 
    'kyc_alert', 
    'system_announcement', 
    'security_alert'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',
  kyc_status kyc_status_type NOT NULL DEFAULT 'not_submitted',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
  invested_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (invested_balance >= 0),
  total_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_profit >= 0),
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
  locked_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INVESTMENT PLANS TABLE
CREATE TABLE IF NOT EXISTS public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category plan_category NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  min_investment NUMERIC(14,2) NOT NULL CHECK (min_investment > 0),
  max_investment NUMERIC(14,2) NOT NULL CHECK (max_investment >= min_investment),
  expected_return_rate NUMERIC(6,2) NOT NULL CHECK (expected_return_rate >= 0),
  return_period return_period_type NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  risk_level plan_risk_level NOT NULL DEFAULT 'low',
  funding_goal NUMERIC(14,2) NOT NULL CHECK (funding_goal > 0),
  total_funded NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_funded >= 0),
  status plan_status NOT NULL DEFAULT 'open',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INVESTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.investment_plans(id) ON DELETE RESTRICT,
  invested_amount NUMERIC(14,2) NOT NULL CHECK (invested_amount > 0),
  expected_return_amount NUMERIC(14,2) NOT NULL CHECK (expected_return_amount >= invested_amount),
  accumulated_profit NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (accumulated_profit >= 0),
  status investment_status NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  maturity_date TIMESTAMPTZ NOT NULL,
  last_payout_at TIMESTAMPTZ,
  auto_reinvest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
  net_amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status transaction_status NOT NULL DEFAULT 'pending',
  payment_method payment_gateway NOT NULL,
  reference_id TEXT NOT NULL UNIQUE,
  proof_of_payment_url TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. WITHDRAWAL ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_type withdrawal_account_type NOT NULL,
  account_name TEXT NOT NULL,
  account_number_or_address TEXT NOT NULL,
  bank_name TEXT,
  routing_or_swift TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. KYC VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type kyc_document_type NOT NULL,
  document_number TEXT NOT NULL,
  document_front_url TEXT NOT NULL,
  document_back_url TEXT,
  selfie_url TEXT NOT NULL,
  status kyc_status_type NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type notification_type NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PUSH DEVICE TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_brand TEXT,
  device_model TEXT,
  os_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_screen TEXT,
  action_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  previous_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 15. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_investment_plans_status ON public.investment_plans(status);
CREATE INDEX IF NOT EXISTS idx_investment_plans_category ON public.investment_plans(category);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_plan_id ON public.investments(plan_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_maturity_date ON public.investments(maturity_date);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_accounts_user_id ON public.withdrawal_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON public.kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON public.kyc_verifications(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_id ON public.push_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_banners_order ON public.banners(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- ==============================================================================
-- 16. CORE FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to all mutable tables
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_investment_plans_updated_at ON public.investment_plans;
CREATE TRIGGER trg_investment_plans_updated_at BEFORE UPDATE ON public.investment_plans FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_investments_updated_at ON public.investments;
CREATE TRIGGER trg_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_withdrawal_accounts_updated_at ON public.withdrawal_accounts;
CREATE TRIGGER trg_withdrawal_accounts_updated_at BEFORE UPDATE ON public.withdrawal_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_kyc_verifications_updated_at ON public.kyc_verifications;
CREATE TRIGGER trg_kyc_verifications_updated_at BEFORE UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_push_device_tokens_updated_at ON public.push_device_tokens;
CREATE TRIGGER trg_push_device_tokens_updated_at BEFORE UPDATE ON public.push_device_tokens FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_banners_updated_at ON public.banners;
CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Security Definer Admin Check Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND status = 'active'
  );
$$;

-- Function to handle new user registration in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_referred_by UUID;
  v_referrer_code TEXT;
BEGIN
  -- Generate unique 8-character referral code
  v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.id::TEXT) FROM 1 FOR 8));
  
  -- Check if a referral code was passed via user_metadata
  v_referrer_code := NEW.raw_user_meta_data->>'referral_code';
  IF v_referrer_code IS NOT NULL THEN
    SELECT id INTO v_referred_by FROM public.profiles WHERE referral_code = UPPER(TRIM(v_referrer_code));
  END IF;

  -- Create profile record
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    status,
    kyc_status,
    referral_code,
    referred_by
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    'user',
    'active',
    'not_submitted',
    v_referral_code,
    v_referred_by
  );

  -- Automatically initialize default wallet
  INSERT INTO public.wallets (
    user_id,
    currency,
    available_balance,
    invested_balance,
    total_profit,
    total_withdrawn,
    locked_balance
  ) VALUES (
    NEW.id,
    'USD',
    0.00,
    0.00,
    0.00,
    0.00,
    0.00
  );

  -- Create welcome notification
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    data
  ) VALUES (
    NEW.id,
    'Welcome to Growvest!',
    'Your investment account and wallet have been set up successfully. Explore investment opportunities today.',
    'system_announcement',
    jsonb_build_object('screen', 'explore')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic Investment Procedure
CREATE OR REPLACE FUNCTION public.invest_in_plan(
  p_plan_id UUID,
  p_amount NUMERIC(14,2),
  p_auto_reinvest BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet wallets%ROWTYPE;
  v_plan investment_plans%ROWTYPE;
  v_expected_return NUMERIC(14,2);
  v_maturity_date TIMESTAMPTZ;
  v_investment_id UUID;
  v_reference_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock wallet row for update
  SELECT * INTO v_wallet 
  FROM public.wallets 
  WHERE user_id = v_user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Lock plan row for update
  SELECT * INTO v_plan 
  FROM public.investment_plans 
  WHERE id = p_plan_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment plan not found';
  END IF;

  IF v_plan.status <> 'open' THEN
    RAISE EXCEPTION 'Plan is not currently open for investments';
  END IF;

  IF p_amount < v_plan.min_investment THEN
    RAISE EXCEPTION 'Investment amount below minimum requirement of %', v_plan.min_investment;
  END IF;

  IF p_amount > v_plan.max_investment THEN
    RAISE EXCEPTION 'Investment amount exceeds maximum limit of %', v_plan.max_investment;
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available wallet balance';
  END IF;

  -- Calculate return & maturity
  v_expected_return := ROUND(p_amount + (p_amount * (v_plan.expected_return_rate / 100.0)), 2);
  v_maturity_date := NOW() + (v_plan.duration_days || ' days')::INTERVAL;
  v_reference_id := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6));

  -- Deduct wallet available balance, increase invested balance
  UPDATE public.wallets
  SET 
    available_balance = available_balance - p_amount,
    invested_balance = invested_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Create investment contract
  INSERT INTO public.investments (
    user_id,
    plan_id,
    invested_amount,
    expected_return_amount,
    accumulated_profit,
    status,
    start_date,
    maturity_date,
    auto_reinvest
  ) VALUES (
    v_user_id,
    v_plan.id,
    p_amount,
    v_expected_return,
    0.00,
    'active',
    NOW(),
    v_maturity_date,
    p_auto_reinvest
  ) RETURNING id INTO v_investment_id;

  -- Record transaction ledger entry
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    type,
    amount,
    fee,
    net_amount,
    currency,
    status,
    payment_method,
    reference_id,
    metadata
  ) VALUES (
    v_user_id,
    v_wallet.id,
    'investment_debit',
    p_amount,
    0.00,
    p_amount,
    v_wallet.currency,
    'completed',
    'wallet_transfer',
    v_reference_id,
    jsonb_build_object('investment_id', v_investment_id, 'plan_id', v_plan.id, 'plan_title', v_plan.title)
  );

  -- Update plan funded amount
  UPDATE public.investment_plans
  SET 
    total_funded = total_funded + p_amount,
    status = CASE WHEN total_funded + p_amount >= funding_goal THEN 'funded'::plan_status ELSE status END,
    updated_at = NOW()
  WHERE id = v_plan.id;

  -- Insert confirmation notification
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    data
  ) VALUES (
    v_user_id,
    'Investment Confirmed!',
    'You successfully invested ' || v_wallet.currency || ' ' || p_amount || ' in ' || v_plan.title || '.',
    'investment_update',
    jsonb_build_object('investment_id', v_investment_id, 'plan_id', v_plan.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'investment_id', v_investment_id,
    'invested_amount', p_amount,
    'expected_return', v_expected_return,
    'maturity_date', v_maturity_date
  );
END;
$$;

-- Admin Transaction Approval / Rejection Procedure
CREATE OR REPLACE FUNCTION public.process_transaction_review(
  p_transaction_id UUID,
  p_new_status transaction_status,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tx transactions%ROWTYPE;
  v_wallet wallets%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  SELECT * INTO v_tx 
  FROM public.transactions 
  WHERE id = p_transaction_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Transaction has already been reviewed (current status: %)', v_tx.status;
  END IF;

  SELECT * INTO v_wallet 
  FROM public.wallets 
  WHERE id = v_tx.wallet_id 
  FOR UPDATE;

  IF p_new_status = 'approved' OR p_new_status = 'completed' THEN
    IF v_tx.type = 'deposit' THEN
      -- Credit available balance
      UPDATE public.wallets
      SET 
        available_balance = available_balance + v_tx.net_amount,
        updated_at = NOW()
      WHERE id = v_wallet.id;

    ELSIF v_tx.type = 'withdrawal' THEN
      -- Move from locked balance to withdrawn total
      IF v_wallet.locked_balance < v_tx.amount THEN
        RAISE EXCEPTION 'Locked balance insufficient for withdrawal';
      END IF;

      UPDATE public.wallets
      SET 
        locked_balance = locked_balance - v_tx.amount,
        total_withdrawn = total_withdrawn + v_tx.net_amount,
        updated_at = NOW()
      WHERE id = v_wallet.id;
    END IF;

  ELSIF p_new_status = 'rejected' OR p_new_status = 'cancelled' THEN
    IF v_tx.type = 'withdrawal' THEN
      -- Release locked balance back to available balance
      UPDATE public.wallets
      SET 
        locked_balance = locked_balance - v_tx.amount,
        available_balance = available_balance + v_tx.amount,
        updated_at = NOW()
      WHERE id = v_wallet.id;
    END IF;
  END IF;

  -- Update transaction record
  UPDATE public.transactions
  SET 
    status = p_new_status,
    admin_notes = p_admin_notes,
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_tx.id;

  -- Audit Log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    new_data
  ) VALUES (
    v_admin_id,
    'TRANSACTION_' || UPPER(p_new_status::TEXT),
    'transactions',
    v_tx.id,
    jsonb_build_object('status', v_tx.status),
    jsonb_build_object('status', p_new_status, 'notes', p_admin_notes)
  );

  -- Send notification to user
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    data
  ) VALUES (
    v_tx.user_id,
    'Transaction ' || INITCAP(p_new_status::TEXT),
    'Your ' || v_tx.type::TEXT || ' request of ' || v_tx.currency || ' ' || v_tx.amount || ' was ' || p_new_status::TEXT || '.',
    'transaction_status',
    jsonb_build_object('transaction_id', v_tx.id, 'status', p_new_status)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

-- ==============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 17.1 PROFILES POLICIES
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile fields" 
  ON public.profiles FOR UPDATE 
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins full management of profiles" 
  ON public.profiles FOR ALL 
  USING (public.is_admin());

-- 17.2 WALLETS POLICIES
CREATE POLICY "Users can view own wallet" 
  ON public.wallets FOR SELECT 
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can view and manage wallets" 
  ON public.wallets FOR ALL 
  USING (public.is_admin());

-- 17.3 INVESTMENT PLANS POLICIES
CREATE POLICY "Public/Users can view active investment plans" 
  ON public.investment_plans FOR SELECT 
  USING (status IN ('open', 'upcoming', 'funded', 'active', 'completed') OR public.is_admin());

CREATE POLICY "Admins can insert and manage investment plans" 
  ON public.investment_plans FOR ALL 
  USING (public.is_admin());

-- 17.4 INVESTMENTS POLICIES
CREATE POLICY "Users can view own investments" 
  ON public.investments FOR SELECT 
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins full access to investments" 
  ON public.investments FOR ALL 
  USING (public.is_admin());

-- 17.5 TRANSACTIONS POLICIES
CREATE POLICY "Users can view own transactions" 
  ON public.transactions FOR SELECT 
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can request deposits or withdrawals" 
  ON public.transactions FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending' 
    AND type IN ('deposit', 'withdrawal')
  );

CREATE POLICY "Admins full access to transactions" 
  ON public.transactions FOR ALL 
  USING (public.is_admin());

-- 17.6 WITHDRAWAL ACCOUNTS POLICIES
CREATE POLICY "Users can view and manage own withdrawal accounts" 
  ON public.withdrawal_accounts FOR ALL 
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 17.7 KYC VERIFICATIONS POLICIES
CREATE POLICY "Users can view own KYC records" 
  ON public.kyc_verifications FOR SELECT 
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own KYC submission" 
  ON public.kyc_verifications FOR INSERT 
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins manage all KYC records" 
  ON public.kyc_verifications FOR ALL 
  USING (public.is_admin());

-- 17.8 NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own or broadcast notifications" 
  ON public.notifications FOR SELECT 
  USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());

CREATE POLICY "Users can update read status on their notifications" 
  ON public.notifications FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can create and manage notifications" 
  ON public.notifications FOR ALL 
  USING (public.is_admin());

-- 17.9 PUSH DEVICE TOKENS POLICIES
CREATE POLICY "Users can manage own push device tokens" 
  ON public.push_device_tokens FOR ALL 
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 17.10 SYSTEM SETTINGS POLICIES
CREATE POLICY "Public can view public settings" 
  ON public.system_settings FOR SELECT 
  USING (is_public = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage all system settings" 
  ON public.system_settings FOR ALL 
  USING (public.is_admin());

-- 17.11 BANNERS POLICIES
CREATE POLICY "Public can view active banners" 
  ON public.banners FOR SELECT 
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admins can manage all banners" 
  ON public.banners FOR ALL 
  USING (public.is_admin());

-- 17.12 AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs" 
  ON public.audit_logs FOR SELECT 
  USING (public.is_admin());

-- ==============================================================================
-- 18. SUPABASE STORAGE BUCKETS & POLICIES
-- ==============================================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('plan-images', 'plan-images', true),
  ('banners', 'banners', true),
  ('kyc-documents', 'kyc-documents', false),
  ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage RLS: Avatars
CREATE POLICY "Avatar Public Read" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

CREATE POLICY "Avatar User Upload" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Avatar User Update" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Storage RLS: Plan Images & Banners
CREATE POLICY "Plan Images & Banners Public Read" 
  ON storage.objects FOR SELECT 
  USING (bucket_id IN ('plan-images', 'banners'));

CREATE POLICY "Plan Images & Banners Admin Upload" 
  ON storage.objects FOR ALL 
  USING (bucket_id IN ('plan-images', 'banners') AND public.is_admin());

-- Storage RLS: KYC Documents (Private)
CREATE POLICY "KYC Documents Access" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "KYC Documents Upload" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: Payment Receipts (Private)
CREATE POLICY "Payment Receipts Access" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'payment-receipts' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Payment Receipts Upload" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'payment-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==============================================================================
-- 19. REALTIME PUBLICATION CONFIGURATION
-- ==============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_plans;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_verifications;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.banners;
EXCEPTION WHEN duplicate_object THEN null; END $$;
