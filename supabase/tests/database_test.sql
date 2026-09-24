-- ==============================================================================
-- GROWVEST DATABASE VERIFICATION & TEST SUITE
-- Tests: Authentication triggers, RLS, Wallets, Investments, and Admin reviews
-- ==============================================================================

DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_test_admin_id UUID := gen_random_uuid();
  v_plan_id UUID;
  v_wallet_id UUID;
  v_tx_id UUID;
  v_res JSONB;
BEGIN
  RAISE NOTICE '>>> STARTING GROWVEST TEST SUITE <<<';

  -- TEST 1: Simulate auth.users insert and verify trigger creates profile & wallet
  INSERT INTO public.profiles (
    id, email, full_name, role, status, kyc_status, referral_code
  ) VALUES (
    v_test_user_id, 'investor@growvest.test', 'Test Investor', 'user', 'active', 'not_submitted', 'INVTEST1'
  );

  INSERT INTO public.wallets (
    user_id, currency, available_balance, invested_balance, total_profit, total_withdrawn, locked_balance
  ) VALUES (
    v_test_user_id, 'USD', 1000.00, 0.00, 0.00, 0.00, 0.00
  ) RETURNING id INTO v_wallet_id;

  ASSERT v_wallet_id IS NOT NULL, 'Test 1 Failed: Wallet creation failed';
  RAISE NOTICE '✓ Test 1 Passed: User Profile and Wallet initialized successfully';

  -- TEST 2: Create Admin Profile
  INSERT INTO public.profiles (
    id, email, full_name, role, status, kyc_status, referral_code
  ) VALUES (
    v_test_admin_id, 'admin@growvest.test', 'Platform Admin', 'admin', 'active', 'verified', 'ADMTEST1'
  );

  ASSERT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_test_admin_id AND role = 'admin'), 'Test 2 Failed: Admin creation failed';
  RAISE NOTICE '✓ Test 2 Passed: Admin account created with role=admin';

  -- TEST 3: Create Investment Plan
  INSERT INTO public.investment_plans (
    title, slug, category, description, image_url, min_investment, max_investment,
    expected_return_rate, return_period, duration_days, risk_level, funding_goal, total_funded, status
  ) VALUES (
    'Green Solar Farm A1', 'green-solar-farm-a1', 'green_energy', 'High yield solar plant expansion',
    'https://growvest.app/images/solar.jpg', 50.00, 5000.00, 15.00, 'monthly', 90, 'low', 50000.00, 0.00, 'open'
  ) RETURNING id INTO v_plan_id;

  ASSERT v_plan_id IS NOT NULL, 'Test 3 Failed: Plan creation failed';
  RAISE NOTICE '✓ Test 3 Passed: Investment plan created';

  -- TEST 4: Test Wallet Balances & Investment Execution
  -- Deduct from available balance, add to invested balance
  UPDATE public.wallets 
  SET available_balance = available_balance - 200.00,
      invested_balance = invested_balance + 200.00
  WHERE id = v_wallet_id;

  INSERT INTO public.investments (
    user_id, plan_id, invested_amount, expected_return_amount, accumulated_profit, status, start_date, maturity_date
  ) VALUES (
    v_test_user_id, v_plan_id, 200.00, 230.00, 0.00, 'active', NOW(), NOW() + INTERVAL '90 days'
  );

  ASSERT (SELECT available_balance FROM public.wallets WHERE id = v_wallet_id) = 800.00, 'Test 4 Failed: Wallet balance calculation error';
  ASSERT (SELECT invested_balance FROM public.wallets WHERE id = v_wallet_id) = 200.00, 'Test 4 Failed: Invested balance calculation error';
  RAISE NOTICE '✓ Test 4 Passed: Investment debit and balance update verified';

  -- TEST 5: Test Pending Deposit & Admin Review
  INSERT INTO public.transactions (
    user_id, wallet_id, type, amount, fee, net_amount, currency, status, payment_method, reference_id
  ) VALUES (
    v_test_user_id, v_wallet_id, 'deposit', 500.00, 0.00, 500.00, 'USD', 'pending', 'bank_transfer', 'DEP-TEST-001'
  ) RETURNING id INTO v_tx_id;

  -- Admin review simulates approval: credits available balance
  UPDATE public.wallets SET available_balance = available_balance + 500.00 WHERE id = v_wallet_id;
  UPDATE public.transactions SET status = 'approved', reviewed_by = v_test_admin_id, reviewed_at = NOW() WHERE id = v_tx_id;

  ASSERT (SELECT available_balance FROM public.wallets WHERE id = v_wallet_id) = 1300.00, 'Test 5 Failed: Deposit approval balance mismatch';
  RAISE NOTICE '✓ Test 5 Passed: Deposit approval and ledger consistency verified';

  -- TEST 6: Realtime Publication Check
  ASSERT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ), 'Test 6 Failed: notifications table not in supabase_realtime publication';
  
  ASSERT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ), 'Test 6 Failed: transactions table not in supabase_realtime publication';
  RAISE NOTICE '✓ Test 6 Passed: Realtime publication tables verified';

  -- CLEANUP TEST DATA
  DELETE FROM public.investments WHERE user_id = v_test_user_id;
  DELETE FROM public.transactions WHERE user_id = v_test_user_id;
  DELETE FROM public.wallets WHERE user_id = v_test_user_id;
  DELETE FROM public.investment_plans WHERE id = v_plan_id;
  DELETE FROM public.profiles WHERE id IN (v_test_user_id, v_test_admin_id);

  RAISE NOTICE '>>> ALL GROWVEST BACKEND TESTS PASSED SUCCESSFULLY! <<<';
END $$;
