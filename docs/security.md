# GROWVEST — SECURITY & AUTHORIZATION MODEL

This document specifies the complete security, Row Level Security (RLS), role-based access control (RBAC), and storage policies for the **Growvest** platform.

---

## 1. Principles of Security

1. **Defense in Depth**: Authorization is enforced at the database level using PostgreSQL Row Level Security (RLS). Hiding UI elements is purely cosmetic and never considered a security boundary.
2. **Zero Trust Client**: The Android application is treated as an untrusted public client. It holds only the Supabase `anon` public API key. It cannot manipulate balances, execute privileged state transitions, or modify administrative data.
3. **No Secret Leaks**: The `service_role` key is never bundled in the Android app. Server-side operations, bulk calculations, and automated payouts run via authenticated Supabase Edge Functions.
4. **Least Privilege**: Users may only read and write data that belongs to their verified `auth.uid()`. Wallets are protected such that balances cannot be updated via direct client SQL queries.

---

## 2. Role-Based Access Control (RBAC)

Growvest defines three roles in `public.profiles.role`:
- `user`: Standard mobile client investor. Can invest, deposit, request withdrawals, update their profile, and submit KYC.
- `admin`: Operational administrator. Can approve/reject KYC, manage investment plans, approve transactions, send notifications, and edit system settings.
- `super_admin`: Full administrative access, including granting admin roles and viewing sensitive audit logs.

### Database Authorization Function
```sql
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
```

---

## 3. Row Level Security (RLS) Policies

RLS is enabled on **all** tables in the `public` schema.

### 3.1 `profiles`
- **SELECT**:
  - User can view their own profile (`id = auth.uid()`).
  - Admins can view all profiles (`is_admin() = true`).
- **INSERT**:
  - Handled exclusively by database trigger on `auth.users` creation. Direct client insertion is denied.
- **UPDATE**:
  - User can update non-privileged fields (`full_name`, `phone`, `avatar_url`) for their own record.
  - Users CANNOT alter `role`, `status`, `kyc_status`, `referral_code`, or `referred_by`.
  - Admins can update `role`, `status`, and `kyc_status`.
- **DELETE**:
  - Only `super_admin` can delete profiles.

### 3.2 `wallets`
- **SELECT**:
  - User can view only their own wallet (`user_id = auth.uid()`).
  - Admins can view all wallets (`is_admin() = true`).
- **INSERT**:
  - Disallowed from client. Initialized automatically by the user creation trigger.
- **UPDATE**:
  - **DENIED** for regular users (`auth.uid()`). No client can directly `UPDATE wallets SET available_balance = ...`.
  - Balance modifications occur ONLY through PostgreSQL stored procedures (with strict transactional row locks) or privileged Edge Functions.
  - Admins can trigger balance adjustments through audited administrative functions.
- **DELETE**:
  - Denied.

### 3.3 `investment_plans`
- **SELECT**:
  - Public / authenticated users can view plans where `status IN ('open', 'upcoming', 'funded', 'active', 'completed')`.
  - Admins can view all plans, including `draft` and `cancelled`.
- **INSERT / UPDATE / DELETE**:
  - Only authorized admins (`is_admin() = true`).

### 3.4 `investments`
- **SELECT**:
  - User can view only their own investments (`user_id = auth.uid()`).
  - Admins can view all investments.
- **INSERT**:
  - Users can create investments for themselves (`user_id = auth.uid()`), provided their wallet has sufficient liquid funds (enforced by a database check function).
- **UPDATE / DELETE**:
  - Status transitions (e.g. `matured`, `liquidated`) are managed by backend payout routines and admins.

### 3.5 `transactions`
- **SELECT**:
  - User can view only their own transactions (`user_id = auth.uid()`).
  - Admins can view all transactions.
- **INSERT**:
  - User can create `deposit` or `withdrawal` requests for themselves (`user_id = auth.uid()`, `status = 'pending'`).
  - Users CANNOT insert with status `approved` or `completed`.
- **UPDATE**:
  - Users can cancel their own `pending` withdrawal request.
  - Only admins (`is_admin() = true`) can approve, reject, or mark transactions completed.
- **DELETE**:
  - Denied for all users (immutable financial ledger).

### 3.6 `withdrawal_accounts`
- **SELECT / INSERT / UPDATE / DELETE**:
  - User can manage only their own payout accounts (`user_id = auth.uid()`).
  - Admins can view accounts linked to withdrawal requests for verification.

### 3.7 `kyc_verifications`
- **SELECT**:
  - User can view only their own KYC records (`user_id = auth.uid()`).
  - Admins can view all KYC records.
- **INSERT**:
  - User can submit KYC documents for their own profile (`user_id = auth.uid()`).
- **UPDATE**:
  - User can update only if status is `rejected` (resubmission).
  - Admins can update `status`, `admin_notes`, and `reviewed_by`.
- **DELETE**:
  - Denied.

### 3.8 `notifications`
- **SELECT**:
  - User can view alerts addressed to them (`user_id = auth.uid()`) or global broadcasts (`user_id IS NULL`).
  - Admins can view all notifications.
- **INSERT**:
  - Only admins can create notifications manually, or generated via backend triggers.
- **UPDATE**:
  - User can update only `is_read` and `read_at` on their own notifications.
- **DELETE**:
  - User can delete their own notifications.

### 3.9 `push_device_tokens`
- **SELECT / INSERT / UPDATE / DELETE**:
  - User can manage their own device tokens (`user_id = auth.uid()`).

### 3.10 `system_settings`
- **SELECT**:
  - Public/authenticated users can view settings where `is_public = true`.
  - Admins can view all settings.
- **INSERT / UPDATE / DELETE**:
  - Only authorized admins (`is_admin() = true`).

### 3.11 `banners`
- **SELECT**:
  - Public/authenticated users can view active banners (`is_active = true`).
  - Admins can view all banners.
- **INSERT / UPDATE / DELETE**:
  - Only authorized admins (`is_admin() = true`).

### 3.12 `audit_logs`
- **SELECT**:
  - Only admins (`is_admin() = true`).
- **INSERT / UPDATE / DELETE**:
  - Insertions are performed exclusively by database triggers or security definer procedures. No direct modification or deletion is permitted.

---

## 4. Supabase Storage Buckets & Policies

| Bucket Name | Access Level | Allowed File Types | File Size Limit | Upload Policy | Read Policy |
|---|---|---|---|---|---|
| `avatars` | Public Read | `image/png, image/jpeg, image/webp` | 2 MB | Authenticated user (`owner = auth.uid()`) | Public |
| `plan-images` | Public Read | `image/png, image/jpeg, image/webp` | 5 MB | Admins only | Public |
| `banners` | Public Read | `image/png, image/jpeg, image/webp` | 5 MB | Admins only | Public |
| `kyc-documents` | Private | `image/png, image/jpeg, application/pdf` | 10 MB | Authenticated user (`owner = auth.uid()`) | Owner or Admin (`is_admin()`) |
| `payment-receipts` | Private | `image/png, image/jpeg, application/pdf` | 10 MB | Authenticated user (`owner = auth.uid()`) | Owner or Admin (`is_admin()`) |

---

## 5. Edge Functions Architecture

1. **`process-profit-payouts`**:
   - Secure serverless function invoked periodically (via Supabase cron / pg_net) or triggered by an admin.
   - Computes daily/monthly ROI based on active investments.
   - Credits user wallets inside an atomic PostgreSQL transaction.
   - Logs audit trail and inserts notification records.

2. **`approve-transaction`**:
   - Server-side handler for admin approvals of deposits and withdrawals.
   - Validates that sufficient funds exist before disbursing.
   - Executes lock on wallet row (`SELECT FOR UPDATE`), updates balances, writes transaction state, and dispatches push notifications.

3. **`send-push-notification`**:
   - Sends batch notifications through the Expo Push Notification service (`https://exp.host/--/api/v2/push/send`).
   - Verifies Expo ticket delivery and handles invalid/unregistered device tokens.
