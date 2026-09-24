# GROWVEST — DUAL NOTIFICATION ARCHITECTURE
## Supabase Realtime vs Android Push Notifications

---

## 1. Executive Summary: Realtime ≠ Push Notifications

There is a fundamental architectural distinction between **Supabase Realtime** and **Android Push Notifications**:

| Dimension | Supabase Realtime | Android Push Notifications |
| :--- | :--- | :--- |
| **Transport** | Persistent WebSocket connection (`wss://...`) | Android OS Push Daemon (FCM / Expo Push Service) |
| **App State Required** | **Foreground only** (App must be open and active) | **Any state** (Foreground, Background, Screen Off, App Killed) |
| **User Alert Method** | In-app UI updates, React Query cache mutation, badges | OS notification tray, Heads-up popup, Vibration, Sound, LED |
| **Latency** | Sub-100 milliseconds (Ultra-low latency) | ~1 to 3 seconds depending on carrier/network |
| **Primary Purpose** | **Instant UI sync without refreshing** | **Engaging users & alerting them to critical account events** |
| **Target Example** | Realtime balance change ticker while viewing wallet | *"Your Growvest status has changed"* while phone is in pocket |

---

## 2. Architecture Pipelines

### Pipeline A: Android Push Notifications (Background & Offline Alerting)

Used when an event occurs that the investor must be immediately informed of, regardless of whether their phone is in use.

```
                  ┌──────────────────────┐
                  │ Admin / Admin Portal │
                  │  (Status / Review)   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Supabase Database    │
                  │   (PostgreSQL)       │
                  └──────────┬───────────┘
                             │
            Webhook / Direct │ Edge Function Call
                             ▼
                  ┌──────────────────────┐
                  │ Supabase Edge Func   │
                  │send-push-notification│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Expo Push / FCM      │
                  │   Notification API   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Android Device Tray  │
                  │ (growvest_default)   │
                  └──────────┬───────────┘
                             │ User taps notification
                             ▼
                  ┌──────────────────────┐
                  │ Mobile App Deep Link │
                  │ (Profile, Wallet...) │
                  └──────────────────────┘
```

#### Android High-Priority Channel Specification:
- **Channel ID**: `growvest_default`
- **Channel Name**: `Growvest Transactions & Alerts`
- **Importance**: `AndroidImportance.MAX` (High priority heads-up banner)
- **Vibration Pattern**: `[0, 250, 250, 250]`
- **Accent Color**: `#10B981` (Growvest Emerald)
- **Sound**: `default`

---

### Pipeline B: Supabase Realtime (Instant In-App UI Reactivity)

Used when the user has the Growvest application open and active. Eliminates polling, pull-to-refresh lag, and network re-fetches.

```
                  ┌──────────────────────┐
                  │ Admin modifies state │
                  │ (Status/Balance/Plan)│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Supabase DB Postgres │
                  │ (RLS Protected Row)  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Supabase Realtime    │
                  │ WebSocket Broadcast  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Open Android App     │
                  │  (realtimeSync.ts)   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ React Query Cache    │
                  │ (Direct Mutation)    │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Instant UI Render    │
                  │ (0ms lag, no reload) │
                  └──────────────────────┘
```

---

## 3. Real-World Event Matrix

| Event Trigger | Supabase Realtime Action (In-App) | Android Push Notification Action (Device Tray) | Deep Link Destination |
| :--- | :--- | :--- | :--- |
| **Admin changes user status** (e.g., Active -> Suspended) | `AuthContext` updates user state immediately; restricted actions lock in realtime | Push: *"Your Growvest status has changed. Your account status is now [status]."* | `/(app)/(tabs)/profile` |
| **Admin approves KYC document** | Profile KYC badge instantly turns Emerald (`Verified`); investment limit banners disappear | Push: *"KYC Verification Approved! All investment & withdrawal limits are unlocked."* | `/(app)/(tabs)/profile` |
| **Admin rejects KYC document** | Profile KYC badge turns Red (`Rejected`); rejection notes display instantly | Push: *"KYC Document Rejected. Reason: [Notes]. Please resubmit."* | `/(app)/(tabs)/profile` |
| **Admin approves Deposit** | Wallet balance instantly credits; transaction row turns Green (`approved`) | Push: *"Transaction Approved! Your deposit of USD [Amount] has been approved."* | `/(app)/(tabs)/wallet` |
| **Admin declines Withdrawal** | Locked balance reverts back to available balance; badge turns Red (`rejected`) | Push: *"Transaction Declined: Your withdrawal request was declined. [Notes]"* | `/(app)/(tabs)/wallet` |
| **Investment matures / Profit Payout** | Invested balance shifts to available balance; profit counter updates | Push: *"Investment Matured! USD [Amount] has been credited to your wallet."* | `/(app)/(tabs)/investments` |
| **Admin publishes Announcement** | Unread bell count badge increments on Home header | Broadcast Push: Delivered to all registered active Android devices | `/(app)/(tabs)/wallet` or Home |

---

## 4. Implementation Reference

### 1. Push Token Registration (`mobile/src/lib/pushNotifications.ts`)
- On authenticated session start in `mobile/app/(app)/_layout.tsx`, `registerForPushNotificationsAsync(userId)` is executed.
- Hardware checks confirm Android device, requests notification permissions, acquires the Expo Push Token (`ExponentPushToken[...]`), and upserts into `public.push_device_tokens`.
- On logout, tokens can be deactivated.

### 2. Edge Function Dispatcher (`supabase/functions/send-push-notification/index.ts`)
- Accepts direct JSON or Supabase Database Webhook payloads.
- Resolves all active `push_device_tokens` for the specified `user_id` (or all users for broadcasts).
- Posts batch payload to Expo Push API (`https://exp.host/--/api/v2/push/send`) with `channelId: 'growvest_default'` and `priority: 'high'`.
- Records notification record in `public.notifications`.

### 3. Admin Dispatch Helper (`admin/src/lib/pushDispatcher.ts`)
- Provides `dispatchAdminPushNotification({ userId, title, body, notificationType, data })`.
- Invokes `send-push-notification` Edge Function with automatic fallback to direct database insert for resilient operation.

### 4. Realtime Subscription Manager (`mobile/src/lib/realtimeSync.ts`)
- Manages single deduplicated WebSocket channel per table.
- Directly manipulates TanStack Query cache via `queryClient.setQueryData()` to eliminate redundant GET requests over the wire.
