# GROWVEST — DATABASE SCHEMA SPECIFICATION

This document outlines the complete PostgreSQL database architecture for the **Growvest** Android mobile application and Admin Dashboard, built on Supabase.

---

## 1. System Architecture Overview

```
                      +-------------------+
                      |   auth.users      |
                      +---------+---------+
                                | 1:1
                                v
                      +-------------------+
                      |     profiles      |
                      +---------+---------+
                                |
        +-----------+-----------+-----------+-----------+
        | 1:1       | 1:N       | 1:N       | 1:N       | 1:N
        v           v           v           v           v
   +----+---+  +----+----+  +---+----+  +---+----+  +---+----+
   |wallets |  |invest-  |  | trans- |  |  kyc_  |  |notifi- |
   |        |  |  ments  |  | actions|  | verif. |  | cations|
   +----+---+  +----+----+  +--------+  +--------+  +--------+
        ^           | N:1
        |           v
        |      +----+----+
        +------| invest. | (returns & funding)
               |  plans  |
               +---------+
```

---

## 2. Enums (Custom Data Types)

```sql
-- User Roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- User & Account Status
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification');

-- KYC Status
CREATE TYPE kyc_status_type AS ENUM ('not_submitted', 'pending', 'verified', 'rejected');
CREATE TYPE kyc_document_type AS ENUM ('national_id', 'passport', 'drivers_license');

-- Investment Plan Categories & Status
CREATE TYPE plan_category AS ENUM (
  'agriculture', 
  'livestock', 
  'real_estate', 
  'fixed_income', 
  'green_energy', 
  'technology'
);

CREATE TYPE plan_risk_level AS ENUM ('low', 'moderate', 'high');
CREATE TYPE plan_status AS ENUM ('draft', 'upcoming', 'open', 'funded', 'active', 'completed', 'cancelled');
CREATE TYPE return_period_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'at_maturity');

-- User Investment Status
CREATE TYPE investment_status AS ENUM ('active', 'matured', 'cancelled', 'liquidated');

-- Transaction Types, Payment Methods, and Status
CREATE TYPE transaction_type AS ENUM (
  'deposit', 
  'withdrawal', 
  'investment_debit', 
  'profit_payout', 
  'principal_return', 
  'referral_bonus', 
  'admin_adjustment'
);

CREATE TYPE transaction_status AS ENUM (
  'pending', 
  'approved', 
  'rejected', 
  'processing', 
  'completed', 
  'cancelled'
);

CREATE TYPE payment_gateway AS ENUM (
  'bank_transfer', 
  'crypto', 
  'card', 
  'manual_deposit', 
  'wallet_transfer'
);

CREATE TYPE withdrawal_account_type AS ENUM ('bank_account', 'crypto_wallet', 'paypal', 'mobile_money');

-- Notification Types
CREATE TYPE notification_type AS ENUM (
  'investment_update', 
  'transaction_status', 
  'kyc_alert', 
  'system_announcement', 
  'security_alert'
);
```

---

## 3. Tables & Schema Definitions

### 3.1 `profiles`
Extends Supabase `auth.users` with user roles, KYC status, and referral tracking.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, REFERENCES `auth.users(id)` ON DELETE CASCADE | Matches auth user UID |
| `email` | TEXT | NOT NULL, UNIQUE | User primary email |
| `full_name` | TEXT | NULLABLE | Full legal name |
| `phone` | TEXT | NULLABLE | Contact telephone |
| `avatar_url` | TEXT | NULLABLE | Stored in `avatars` bucket |
| `role` | `user_role` | NOT NULL, DEFAULT 'user' | Access control level |
| `status` | `user_status` | NOT NULL, DEFAULT 'active' | Account active/suspended |
| `kyc_status` | `kyc_status_type` | NOT NULL, DEFAULT 'not_submitted' | KYC verification level |
| `referral_code` | TEXT | NOT NULL, UNIQUE | Auto-generated referral code |
| `referred_by` | UUID | NULLABLE, REFERENCES `profiles(id)` | Sponsor referral ID |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp updated |

---

### 3.2 `wallets`
Stores financial balances for each user. Each user has exactly one primary wallet.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique wallet ID |
| `user_id` | UUID | NOT NULL, UNIQUE, REFERENCES `profiles(id)` ON DELETE CASCADE | Wallet owner |
| `currency` | VARCHAR(10) | NOT NULL, DEFAULT 'USD' | Wallet base currency |
| `available_balance` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`available_balance >= 0`) | Liquid balance available for investment/withdrawal |
| `invested_balance` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`invested_balance >= 0`) | Capital currently locked in active investments |
| `total_profit` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`total_profit >= 0`) | Lifetime returns credited to user |
| `total_withdrawn` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`total_withdrawn >= 0`) | Lifetime funds withdrawn |
| `locked_balance` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`locked_balance >= 0`) | Pending withdrawal holds |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.3 `investment_plans`
Admin-created opportunities displayed in the Android mobile catalog.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique plan ID |
| `title` | TEXT | NOT NULL | Project/plan title |
| `slug` | TEXT | NOT NULL, UNIQUE | SEO/URL safe slug |
| `category` | `plan_category` | NOT NULL | Agricultural, real estate, etc. |
| `description` | TEXT | NOT NULL | Comprehensive overview |
| `image_url` | TEXT | NOT NULL | Project image URL |
| `min_investment` | NUMERIC(14,2) | NOT NULL, CHECK (`min_investment > 0`) | Minimum entry amount |
| `max_investment` | NUMERIC(14,2) | NOT NULL, CHECK (`max_investment >= min_investment`) | Cap per individual |
| `expected_return_rate`| NUMERIC(6,2) | NOT NULL, CHECK (`expected_return_rate >= 0`) | Percentage ROI |
| `return_period` | `return_period_type` | NOT NULL | Payout frequency |
| `duration_days` | INTEGER | NOT NULL, CHECK (`duration_days > 0`) | Holding cycle |
| `risk_level` | `plan_risk_level` | NOT NULL, DEFAULT 'low' | Risk indicator |
| `funding_goal` | NUMERIC(14,2) | NOT NULL, CHECK (`funding_goal > 0`) | Total capital target |
| `total_funded` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`total_funded >= 0`) | Real-time raised amount |
| `status` | `plan_status` | NOT NULL, DEFAULT 'open' | Plan availability |
| `start_date` | TIMESTAMPTZ | NULLABLE | Investment window opens |
| `end_date` | TIMESTAMPTZ | NULLABLE | Investment window closes |
| `created_by` | UUID | NULLABLE, REFERENCES `profiles(id)` | Admin creator |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.4 `investments`
Individual user commitments into an investment plan.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique investment contract ID |
| `user_id` | UUID | NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE | Investor |
| `plan_id` | UUID | NOT NULL, REFERENCES `investment_plans(id)` ON DELETE RESTRICT | Target plan |
| `invested_amount` | NUMERIC(14,2) | NOT NULL, CHECK (`invested_amount > 0`) | Principal invested |
| `expected_return_amount`| NUMERIC(14,2)| NOT NULL | Calculated anticipated payout |
| `accumulated_profit`| NUMERIC(14,2) | NOT NULL, DEFAULT 0.00 | Total profit received to date |
| `status` | `investment_status` | NOT NULL, DEFAULT 'active' | Active, matured, liquidated |
| `start_date` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Commenced at |
| `maturity_date` | TIMESTAMPTZ | NOT NULL | Calculated end of cycle |
| `last_payout_at` | TIMESTAMPTZ | NULLABLE | Previous payout run |
| `auto_reinvest` | BOOLEAN | NOT NULL, DEFAULT FALSE | Roll over at maturity |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.5 `transactions`
Double-entry ledger for every balance movement.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Transaction ID |
| `user_id` | UUID | NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE | Account owner |
| `wallet_id` | UUID | NOT NULL, REFERENCES `wallets(id)` ON DELETE CASCADE | Affected wallet |
| `type` | `transaction_type` | NOT NULL | Deposit, withdrawal, debit, profit |
| `amount` | NUMERIC(14,2) | NOT NULL, CHECK (`amount > 0`) | Gross amount |
| `fee` | NUMERIC(14,2) | NOT NULL, DEFAULT 0.00, CHECK (`fee >= 0`) | Processing fee |
| `net_amount` | NUMERIC(14,2) | NOT NULL | Amount post-fee |
| `currency` | VARCHAR(10) | NOT NULL, DEFAULT 'USD' | Currency |
| `status` | `transaction_status`| NOT NULL, DEFAULT 'pending' | Status flow |
| `payment_method` | `payment_gateway` | NOT NULL | Method used |
| `reference_id` | TEXT | NOT NULL, UNIQUE | Unique tracking reference |
| `proof_of_payment_url`| TEXT | NULLABLE | Uploaded receipt in storage |
| `admin_notes` | TEXT | NULLABLE | Reviewer comments |
| `reviewed_by` | UUID | NULLABLE, REFERENCES `profiles(id)` | Admin reviewer |
| `reviewed_at` | TIMESTAMPTZ | NULLABLE | Timestamp of approval/rejection |
| `metadata` | JSONB | NOT NULL, DEFAULT '{}'::jsonb | Extra gateway details |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp submitted |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp updated |

---

### 3.6 `withdrawal_accounts`
Bank accounts and crypto addresses saved by users for payouts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique account ID |
| `user_id` | UUID | NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE | Account owner |
| `account_type` | `withdrawal_account_type` | NOT NULL | Bank, crypto, paypal |
| `account_name` | TEXT | NOT NULL | Account holder name |
| `account_number_or_address` | TEXT | NOT NULL | IBAN, account #, or wallet address |
| `bank_name` | TEXT | NULLABLE | Institution name |
| `routing_or_swift` | TEXT | NULLABLE | Routing/SWIFT/IFSC code |
| `is_default` | BOOLEAN | NOT NULL, DEFAULT FALSE | Default payout destination |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp added |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp updated |

---

### 3.7 `kyc_verifications`
Regulatory verification submissions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | KYC record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE | Submitting user |
| `document_type` | `kyc_document_type` | NOT NULL | ID, passport, driver's license |
| `document_number` | TEXT | NOT NULL | Identification number |
| `document_front_url` | TEXT | NOT NULL | File in private bucket `kyc-documents` |
| `document_back_url` | TEXT | NULLABLE | File in private bucket `kyc-documents` |
| `selfie_url` | TEXT | NOT NULL | Live facial photo |
| `status` | `kyc_status_type` | NOT NULL, DEFAULT 'pending' | Current review status |
| `admin_notes` | TEXT | NULLABLE | Rejection reason or approval notes |
| `reviewed_by` | UUID | NULLABLE, REFERENCES `profiles(id)` | Admin reviewer |
| `reviewed_at` | TIMESTAMPTZ | NULLABLE | Verification timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Submitted timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.8 `notifications`
Real-time user alerts and broadcasts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Notification ID |
| `user_id` | UUID | NULLABLE, REFERENCES `profiles(id)` ON DELETE CASCADE | Recipient (NULL = Broadcast to all) |
| `title` | TEXT | NOT NULL | Alert title |
| `body` | TEXT | NOT NULL | Alert message content |
| `type` | `notification_type` | NOT NULL | Category |
| `data` | JSONB | NOT NULL, DEFAULT '{}'::jsonb | Deep link payload (route, id) |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE | Read indicator |
| `read_at` | TIMESTAMPTZ | NULLABLE | Timestamp opened |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp created |

---

### 3.9 `push_device_tokens`
Expo push notification tokens for Android devices.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique record ID |
| `user_id` | UUID | NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE | Device owner |
| `expo_push_token` | TEXT | NOT NULL, UNIQUE | Expo token (`ExponentPushToken[...]`) |
| `device_brand` | TEXT | NULLABLE | e.g. Samsung, Xiaomi |
| `device_model` | TEXT | NULLABLE | e.g. Galaxy S23 |
| `os_version` | TEXT | NULLABLE | Android version |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active toggle |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Registered timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.10 `system_settings`
Global application configuration managed via Admin Dashboard.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Setting ID |
| `key` | TEXT | NOT NULL, UNIQUE | Configuration key name |
| `value` | JSONB | NOT NULL | Configuration value payload |
| `description` | TEXT | NULLABLE | Documentation of setting |
| `is_public` | BOOLEAN | NOT NULL, DEFAULT TRUE | Accessible by mobile client |
| `updated_by` | UUID | NULLABLE, REFERENCES `profiles(id)` | Admin who updated |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp updated |

---

### 3.11 `banners`
Home screen promotional banners for Android app.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Banner ID |
| `title` | TEXT | NOT NULL | Title / promotion name |
| `image_url` | TEXT | NOT NULL | Banner asset URL |
| `target_screen` | TEXT | NULLABLE | In-app route to open on tap |
| `action_url` | TEXT | NULLABLE | External web URL |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Sorting order |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Updated timestamp |

---

### 3.12 `audit_logs`
Immutable security and administrative audit trail.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Audit log ID |
| `actor_id` | UUID | NULLABLE, REFERENCES `profiles(id)` | Action performer |
| `action` | TEXT | NOT NULL | e.g. `TRANSACTION_APPROVED` |
| `entity_type` | TEXT | NOT NULL | e.g. `transactions`, `profiles` |
| `entity_id` | UUID | NULLABLE | Affected record ID |
| `previous_data` | JSONB | NULLABLE | State before update |
| `new_data` | JSONB | NULLABLE | State after update |
| `ip_address` | TEXT | NULLABLE | Client IP |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Timestamp recorded |

---

## 4. Database Indexes for High Performance

```sql
-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);

-- Wallets
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Investment Plans
CREATE INDEX idx_investment_plans_status ON investment_plans(status);
CREATE INDEX idx_investment_plans_category ON investment_plans(category);

-- Investments
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_plan_id ON investments(plan_id);
CREATE INDEX idx_investments_status ON investments(status);

-- Transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Push tokens
CREATE INDEX idx_push_device_tokens_user_id ON push_device_tokens(user_id);
```

---

## 5. Triggers & Stored Functions

1. **`handle_new_user()`**:
   - Executes after `INSERT` on `auth.users`.
   - Creates a corresponding `profiles` row with a random unique referral code.
   - Automatically initializes a default `wallets` row with `$0.00` balance.
2. **`update_updated_at_column()`**:
   - Triggers before `UPDATE` on every table with an `updated_at` column, ensuring accurate timestamps.
3. **`sync_kyc_status()`**:
   - Executes after `UPDATE` on `kyc_verifications`.
   - Synchronizes `profiles.kyc_status` with the approved/rejected decision.
4. **`is_admin()`**:
   - Security Definer function checking if `auth.uid()` has `role IN ('admin', 'super_admin')` to bypass RLS safely.

---

## 6. Realtime-Enabled Tables

The following tables are added to `supabase_realtime` publication:
1. `notifications` — Instantly delivers notifications and badge counters to Android devices.
2. `transactions` — Live updates when admin approves deposits or processes withdrawals.
3. `wallets` — Live wallet balance synchronization.
4. `investments` — Live portfolio balance and returns updates.
5. `system_settings` — Propagation of app maintenance or feature flag updates without app restart.
6. `banners` — Immediate sync of marketing and promotional updates.
