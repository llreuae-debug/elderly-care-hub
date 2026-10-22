# Elderly Care Hub — Event & Analytics Specification (Phase 0)

**Document**: `analytics/event-spec.md`  
**Purpose**: Rigorous instrumentation specification for the 6 core business metrics.  
**Zero-PII Compliance**: Strict Zero-PII policy. Analytics event properties MUST NEVER contain names, phone numbers, email addresses, street addresses, or medical text. Only non-identifying IDs (UUIDs), cohorts (`YYYY-MM`), enum strings, timestamps, and numeric amounts are permitted.

---

## Metric 1: Free → Paid Conversion (Rate + Count, by Cohort Month)

### 1. Event Names & Typed Properties
- **`circle_created`** (Cohort baseline event)
  ```typescript
  {
    cohort_month: string;          // Format "YYYY-MM" (e.g. "2026-10")
    initial_member_role: 'admin';  // Default role of creator
  }
  ```
- **`subscription_started`** (Conversion event)
  ```typescript
  {
    plan_id: 'family_monthly' | 'family_annual';
    price_usd: number;             // 19.99 or 199.99
    billing_cycle: 'monthly' | 'annual';
    cohort_month: string;          // Creation cohort of the subscribing circle ("YYYY-MM")
  }
  ```

### 2. Codebase Fire Locations
- `circle_created`: `src/services/careCircleService.ts` $\rightarrow$ `createCareCircle(name, userProfile)` (L183)
- `subscription_started`: `src/services/billingAnalyticsService.ts` $\rightarrow$ `recordSubscriptionStarted(circleId, userId, planId, priceUsd, billingCycle)` (L193) / Checkout success callback.

### 3. Server-Side Source of Truth
- **`public.care_circles`** (baseline count) and **`public.subscriptions`** (conversion record)
- *Rationale*: Client events can be blocked by ad blockers or network dropouts during payment redirect. Server webhook / DB row insert is the definitive truth.

### 4. Computation SQL Query
```sql
with cohort_circles as (
  select
    to_char(created_at, 'YYYY-MM') as cohort_month,
    count(distinct id) as total_circles_created
  from public.care_circles
  group by 1
),
cohort_conversions as (
  select
    s.cohort_month,
    count(distinct s.care_circle_id) as paid_conversions
  from public.subscriptions s
  where s.status in ('active', 'cancelled', 'failed') -- Any circle that completed conversion
  group by 1
)
select
  c.cohort_month,
  c.total_circles_created,
  coalesce(v.paid_conversions, 0) as paid_conversions,
  round(
    (coalesce(v.paid_conversions, 0)::numeric / nullif(c.total_circles_created, 0)::numeric) * 100,
    2
  ) as conversion_rate_pct
from cohort_circles c
left join cohort_conversions v on c.cohort_month = v.cohort_month
order by c.cohort_month desc;
```

### 5. Known Failure Modes
1. **Client drop during Stripe/App Store return**: User completes checkout externally but closes the browser before app redirect executes. Client event `subscription_started` is lost. **Mitigation**: Server-side webhook inserts into `public.subscriptions`; queries read directly from `public.subscriptions`.
2. **Circle created offline**: When created in offline mode, local sync timestamps might skew cohort month if device clock is wrong. **Mitigation**: Server enforces `created_at default now()`.

---

## Metric 2: Churn (Voluntary Cancellations vs. Involuntary Failed Payments)

### 1. Event Names & Typed Properties
- **`subscription_cancelled`** (Voluntary Churn)
  ```typescript
  {
    plan_id: 'family_monthly' | 'family_annual';
    churn_type: 'voluntary';
    reason: string;                // e.g. "loved_one_recovered", "too_expensive", "no_longer_needed", "other"
    lifetime_days?: number;
    mrr_lost_usd: number;          // e.g. 19.99
  }
  ```
- **`payment_failed`** (Involuntary Churn)
  ```typescript
  {
    plan_id: 'family_monthly' | 'family_annual';
    churn_type: 'involuntary';
    attempt_number: number;        // e.g. 1, 2, 3 (dunning stage)
    is_terminal: boolean;          // true if grace period expired & subscription cancelled
    mrr_lost_usd: number;          // e.g. 19.99
  }
  ```

### 2. Codebase Fire Locations
- `subscription_cancelled`: `src/services/billingAnalyticsService.ts` $\rightarrow$ `recordSubscriptionCancelled(circleId, userId, planId, reason, mrrLostUsd)` (L252)
- `payment_failed`: `src/services/billingAnalyticsService.ts` $\rightarrow$ `recordPaymentFailed(circleId, userId, planId, attemptNumber, isTerminal, mrrLostUsd)` (L298)

### 3. Server-Side Source of Truth
- **`public.subscriptions`** table (`status = 'cancelled'` with `cancelled_at` for voluntary, `status = 'failed'` for terminal involuntary).
- *Rationale*: Dunning retries and card expirations happen asynchronously via payment gateway webhooks with zero client app involvement.

### 4. Computation SQL Query
```sql
with period_base as (
  -- Active paying subscribers at start of current month
  select
    count(distinct care_circle_id) as active_subscribers_start
  from public.subscriptions
  where started_at < date_trunc('month', current_date)
    and (cancelled_at is null or cancelled_at >= date_trunc('month', current_date))
),
period_churn as (
  select
    count(distinct case when status = 'cancelled' then care_circle_id end) as voluntary_cancellations,
    count(distinct case when status = 'failed' then care_circle_id end) as involuntary_payment_failures
  from public.subscriptions
  where cancelled_at >= date_trunc('month', current_date)
    and cancelled_at < (date_trunc('month', current_date) + interval '1 month')
)
select
  b.active_subscribers_start,
  c.voluntary_cancellations,
  round(
    (c.voluntary_cancellations::numeric / nullif(b.active_subscribers_start, 0)::numeric) * 100,
    2
  ) as voluntary_churn_rate_pct,
  c.involuntary_payment_failures,
  round(
    (c.involuntary_payment_failures::numeric / nullif(b.active_subscribers_start, 0)::numeric) * 100,
    2
  ) as involuntary_churn_rate_pct,
  round(
    ((c.voluntary_cancellations + c.involuntary_payment_failures)::numeric / nullif(b.active_subscribers_start, 0)::numeric) * 100,
    2
  ) as total_churn_rate_pct
from period_base b
cross join period_churn c;
```

### 5. Known Failure Modes
1. **Dunning delay spanning month boundary**: Card failure occurs on Oct 29, but final retry fails on Nov 3. Count shifts to subsequent month.
2. **Immediate resubscription**: User card fails, subscription terminates, but user updates card within 2 hours. Without deduplication, this artificially inflates churn and new conversion. **Mitigation**: Measure net churn on distinct `care_circle_id`.

---

## Metric 3: ARPU (Average Revenue Per Paying User Per Month)

### 1. Event Names & Typed Properties
- **`payment_succeeded`**
  ```typescript
  {
    amount_usd: number;            // e.g. 19.99 or 199.99
    plan_id: 'family_monthly' | 'family_annual';
    billing_cycle: 'monthly' | 'annual';
    currency: 'USD';
  }
  ```

### 2. Codebase Fire Locations
- `payment_succeeded`: `src/services/billingAnalyticsService.ts` $\rightarrow$ `recordPaymentSucceeded(circleId, userId, planId, amountUsd, billingCycle)` (L333) / Webhook handler.

### 3. Server-Side Source of Truth
- **`public.subscriptions`** (normalized monthly MRR) + Payment gateway invoice log / webhook records in Supabase.
- *Rationale*: Client never sees recurring renewal transactions; recurring charges take place headless on server.

### 4. Computation SQL Query
```sql
with active_paying_circles as (
  select
    count(distinct care_circle_id) as paying_users_count,
    -- Annual plans normalized to monthly recurring revenue ($199.99 / 12 = $16.67)
    sum(
      case
        when billing_cycle = 'annual' then (price_usd / 12.0)
        else price_usd
      end
    ) as total_mrr_usd
  from public.subscriptions
  where status = 'active'
    and (cancelled_at is null or cancelled_at > now())
)
select
  paying_users_count,
  round(total_mrr_usd::numeric, 2) as total_monthly_revenue_usd,
  round(
    (total_mrr_usd::numeric / nullif(paying_users_count, 0)::numeric),
    2
  ) as arpu_usd
from active_paying_circles;
```

### 5. Known Failure Modes
1. **Annual plan upfront lump-sum distortion**: If annual revenue ($199.99) is recognized as $199.99 in Month 1 and $0 in Months 2–12, ARPU will swing wildly. **Mitigation**: SQL query amortizes annual subscriptions to $\frac{\text{price}}{12}$.
2. **Refunds/Chargebacks**: If user is refunded out-of-band via Stripe, ARPU overcounts unless refund webhook sets `status = 'cancelled'` or deductions are recorded.

---

## Metric 4: SMS Cost Per User Per Month (Twilio Spend / Active Family Users)

### 1. Event Names & Typed Properties
- **`sms_dispatched`**
  ```typescript
  {
    cost_usd: number;              // Standard Twilio segment cost: 0.0079
    provider: 'twilio';
    escalation_stage: 1 | 2;       // 1 = missed check-in push, 2 = missed check-in SMS / emergency
    segments?: number;             // Message segments (default 1)
  }
  ```

### 2. Codebase Fire Locations
- `sms_dispatched`: `src/services/careCircleService.ts` $\rightarrow$ `triggerMissedCheckInEscalation` (L1330) and `callForHelp` (L889).
- Supabase Edge Function `check-in-escalation` when dispatching Twilio REST API request.

### 3. Server-Side Source of Truth
- **`public.notification_audit_logs`** table (`channel = 'sms'`, `status in ('delivered', 'pending')`) + **`public.subscriptions`** (`status = 'active'`).
- *Rationale*: Client might never know if Twilio API successfully billed an SMS segment during automated cron escalation. The server log is absolute.

### 4. Computation SQL Query
```sql
with current_month_sms as (
  select
    -- Standard US Twilio SMS segment rate: $0.0079
    count(*) * 0.0079 as total_twilio_spend_usd,
    count(*) as total_sms_sent
  from public.notification_audit_logs
  where channel = 'sms'
    and created_at >= date_trunc('month', current_date)
    and status != 'failed'
),
current_active_subscribers as (
  select
    count(distinct care_circle_id) as active_family_subscribers
  from public.subscriptions
  where status = 'active'
    and (cancelled_at is null or cancelled_at > current_date)
)
select
  s.total_sms_sent,
  round(s.total_twilio_spend_usd::numeric, 4) as total_twilio_spend_usd,
  u.active_family_subscribers,
  round(
    (s.total_twilio_spend_usd::numeric / nullif(u.active_family_subscribers, 0)::numeric),
    4
  ) as sms_cost_per_user_usd,
  -- Health check: Carrier cost as percentage of standard $19.99 plan
  round(
    ((s.total_twilio_spend_usd::numeric / nullif(u.active_family_subscribers, 0)::numeric) / 19.99) * 100,
    2
  ) as carrier_cost_pct_of_arpu
from current_month_sms s
cross join current_active_subscribers u;
```

### 5. Known Failure Modes
1. **Multi-segment message spill**: SMS text with special characters or >160 GSM-7 characters splits into 2 segments, doubling carrier cost to $0.0158. **Mitigation**: Hardcode short alert templates under 140 chars.
2. **Carrier filtering / invalid phone numbers**: Twilio charges for message attempts even if recipient number is landline or unallocated. **Mitigation**: Validate E.164 phone format at circle creation.

---

## Metric 5: Activation = First Check-In Completed (Rate + Time-to-Activate)

### 1. Event Names & Typed Properties
- **`first_check_in_completed`**
  ```typescript
  {
    time_to_activate_seconds: number; // Elapsed seconds between circle created_at and 1st check-in
    time_to_activate_hours: number;   // Elapsed hours rounded to 2 decimals
    is_first_check_in: true;
  }
  ```

### 2. Codebase Fire Locations
- `first_check_in_completed`: `src/services/careCircleService.ts` $\rightarrow$ `recordDailyCheckIn` (L615) when previous check-in count for circle is 0.

### 3. Server-Side Source of Truth
- **`public.daily_check_ins`** (`status = 'ok'`) joined with **`public.care_circles`** (`created_at`).
- *Rationale*: Client offline queue syncs check-in into `daily_check_ins`; database evaluates the exact earliest check-in timestamp per circle.

### 4. Computation SQL Query
```sql
with circle_activations as (
  select
    c.id as care_circle_id,
    c.created_at as circle_created_at,
    min(d.checked_in_at) as first_check_in_at,
    extract(epoch from (min(d.checked_in_at) - c.created_at)) / 3600.0 as time_to_activate_hours
  from public.care_circles c
  left join public.daily_check_ins d on c.id = d.care_circle_id and d.status = 'ok'
  group by c.id, c.created_at
)
select
  count(*) as total_circles_created,
  count(first_check_in_at) as activated_circles_count,
  round(
    (count(first_check_in_at)::numeric / nullif(count(*), 0)::numeric) * 100,
    2
  ) as activation_rate_pct,
  round(
    coalesce(avg(time_to_activate_hours), 0)::numeric,
    2
  ) as avg_time_to_activate_hours,
  round(
    coalesce(percentile_cont(0.5) within group (order by time_to_activate_hours), 0)::numeric,
    2
  ) as median_time_to_activate_hours
from circle_activations;
```

### 5. Known Failure Modes
1. **Elder checks in offline**: Elder taps "I'm OK" while offline; check-in queues in AsyncStorage and flushes to Supabase hours later. If `checked_in_at` used device clock instead of queue time, TTA would be artificially inflated. **Mitigation**: Code records initial tap timestamp into `checked_in_at`.
2. **Caregiver creates circle at night**: Circle created at 10:00 PM; deadline is 10:00 AM next morning. TTA naturally records 12 hours minimum. **Mitigation**: Report median TTA alongside average.

---

## Metric 6: Caregiver Invites Sent (Count per Circle, and Invite → Accept Rate)

### 1. Event Names & Typed Properties
- **`caregiver_invite_sent`**
  ```typescript
  {
    invite_channel: 'copy_code' | 'share_link';
  }
  ```
- **`caregiver_invite_accepted`**
  ```typescript
  {
    role: 'viewer' | 'admin';
  }
  ```

### 2. Codebase Fire Locations
- `caregiver_invite_sent`: `src/screens/TimelineScreen.tsx` $\rightarrow$ `handleCopyCode` (L94) and deep link share triggers.
- `caregiver_invite_accepted`: `src/services/careCircleService.ts` $\rightarrow$ `joinCareCircleByCode(inviteCode, userId, userProfile)` (L320).

### 3. Server-Side Source of Truth
- **`public.analytics_events`** (`event_name = 'caregiver_invite_sent'`) for sent attempts + **`public.care_circle_members`** (`joined_at > created_at`) for accepted joins.
- *Rationale*: "Invite sent" (copying code or opening system share sheet) does not alter the relational DB until the recipient joins. Sent events are stored in append-only `analytics_events`.

### 4. Computation SQL Query
```sql
with total_circles as (
  select count(*) as total_circles_count from public.care_circles
),
invites_sent as (
  select
    count(*) as total_invites_sent
  from public.analytics_events
  where event_name = 'caregiver_invite_sent'
),
invites_accepted as (
  -- Caregivers who joined a circle that was created by someone else
  select
    count(*) as total_invites_accepted
  from public.care_circle_members m
  join public.care_circles c on m.care_circle_id = c.id
  where m.user_id != c.created_by -- Exclude circle creator
)
select
  c.total_circles_count,
  coalesce(s.total_invites_sent, 0) as total_invites_sent,
  round(
    (coalesce(s.total_invites_sent, 0)::numeric / nullif(c.total_circles_count, 0)::numeric),
    2
  ) as invites_per_circle,
  coalesce(a.total_invites_accepted, 0) as total_invites_accepted,
  round(
    (coalesce(a.total_invites_accepted, 0)::numeric / nullif(s.total_invites_sent, 0)::numeric) * 100,
    2
  ) as invite_acceptance_rate_pct
from total_circles c
cross join invites_sent s
cross join invites_accepted a;
```

### 5. Known Failure Modes
1. **Repeated copy button presses**: User taps "Copy Code" 4 times in 10 seconds. If every tap fires an event, `total_invites_sent` is artificially inflated and `invite_acceptance_rate_pct` drops falsely. **Mitigation**: Debounce `recordCaregiverInviteSent` with a 60-second cooldown per circle session.
2. **Sharing via external unmonitored channels**: User verbally reads the 6-character code over the phone. `caregiver_invite_sent` is never fired, leading to `invites_accepted > invites_sent` (>100% acceptance). **Mitigation**: Cap rate at 100% or count unique invite codes joined.

---

## Metric Specification Summary Matrix

| Metric # | Metric Name | Event Names | Codebase Trigger Point | Server Source of Truth | Key Failure Mode & Mitigation |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Free → Paid Conversion** | `circle_created`<br>`subscription_started` | `careCircleService.createCareCircle`<br>`billingAnalyticsService.recordSubscriptionStarted` | `public.care_circles`<br>`public.subscriptions` | User drops before redirect $\rightarrow$ Read from DB webhook table, not client event |
| **2** | **Churn** (Voluntary vs Involuntary) | `subscription_cancelled`<br>`payment_failed` | `billingAnalyticsService.recordSubscriptionCancelled`<br>`billingAnalyticsService.recordPaymentFailed` | `public.subscriptions` (`status = 'cancelled' \| 'failed'`) | Month-boundary dunning delay $\rightarrow$ Aggregate on distinct `care_circle_id` |
| **3** | **ARPU** | `payment_succeeded` | `billingAnalyticsService.recordPaymentSucceeded` | `public.subscriptions` (`price_usd`, `billing_cycle`) | Annual lump-sum distortion $\rightarrow$ SQL query normalizes annual revenue to monthly MRR ($199.99 / 12) |
| **4** | **SMS Cost Per User** | `sms_dispatched` | `careCircleService.triggerMissedCheckInEscalation`<br>`careCircleService.callForHelp` | `public.notification_audit_logs`<br>`public.subscriptions` | Long message multi-segment billing $\rightarrow$ Lock templates under 140 GSM chars |
| **5** | **Activation** (TTA) | `first_check_in_completed` | `careCircleService.recordDailyCheckIn` | `public.daily_check_ins`<br>`public.care_circles` | Offline check-in sync delay $\rightarrow$ Use tap timestamp, not sync timestamp |
| **6** | **Caregiver Invites** | `caregiver_invite_sent`<br>`caregiver_invite_accepted` | `TimelineScreen.handleCopyCode`<br>`careCircleService.joinCareCircleByCode` | `public.analytics_events`<br>`public.care_circle_members` | Rapid copy button spamming $\rightarrow$ 60-second debounce on share action |
