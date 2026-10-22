# Elderly Care Hub — Business Metrics & Analytics Specification

**Version**: 1.0.0  
**Status**: Active  
**Compliance**: Strict Privacy (Zero PII). Measurement layer only.  

---

## 1. Product & Business Principles
- **No Vanity Metrics**: Every metric directly measures retention, conversion, unit economics, or core product value.
- **Strict Zero-PII Policy**: Analytics payloads MUST NEVER contain emails, phone numbers, recipient names, street addresses, or medication names. Only non-identifying IDs (UUIDs), enum values, cohort strings (`YYYY-MM`), numerical amounts, timestamps, and durations are permitted.
- **Instrumentation Only**: Do not alter paywall thresholds, feature gating, or pricing tiers during instrumentation.

---

## 2. The 6 Core Business Metrics

### Metric 1: Free → Paid Conversion
- **Definition**: The percentage and total count of registered caregiver accounts or care circles that convert from the free tier to a paid Family plan, grouped by acquisition cohort month.
- **Formula**:
  $$\text{Conversion Rate} = \frac{\text{Unique Paid Conversions in Cohort}}{\text{Total New Accounts / Circles in Cohort}} \times 100$$
- **Primary Events**:
  - `account_created` (properties: `cohort_month`: string)
  - `circle_created` (properties: `cohort_month`: string)
  - `subscription_started` (properties: `plan_id`: string, `price_usd`: number, `billing_cycle`: 'monthly' | 'annual', `cohort_month`: string)

---

### Metric 2: Churn (Voluntary vs. Involuntary)
- **Definition**: The rate at which active paying Family subscribers leave the service, separated cleanly into voluntary cancellations and involuntary churn from payment failures.
- **Formula**:
  $$\text{Voluntary Churn Rate} = \frac{\text{Voluntary Cancellations in Period}}{\text{Active Paying Subscribers at Start of Period}} \times 100$$
  $$\text{Involuntary Churn Rate} = \frac{\text{Failed Payment Terminations in Period}}{\text{Active Paying Subscribers at Start of Period}} \times 100$$
- **Primary Events**:
  - `subscription_cancelled` (properties: `plan_id`: string, `churn_type`: 'voluntary', `reason`: string, `lifetime_days`: number, `mrr_lost_usd`: number)
  - `payment_failed` (properties: `plan_id`: string, `churn_type`: 'involuntary', `attempt_number`: number, `is_terminal`: boolean, `mrr_lost_usd`: number)

---

### Metric 3: ARPU (Average Revenue Per User)
- **Definition**: Average subscription revenue generated per active paying user or care circle per month.
- **Formula**:
  $$\text{ARPU} = \frac{\text{Total Net Subscription Revenue in Month}}{\text{Total Active Paying Users in Month}}$$
- **Primary Events**:
  - `payment_succeeded` (properties: `amount_usd`: number, `plan_id`: string, `billing_cycle`: 'monthly' | 'annual', `currency`: 'USD')

---

### Metric 4: SMS Cost Per User Per Month
- **Definition**: Total Twilio SMS carrier expenditure divided by the number of active Family care circles in that month. Critical for monitoring unit economic viability of SMS escalation.
- **Formula**:
  $$\text{SMS Cost Per User} = \frac{\sum \text{Twilio Spend in Month}}{\text{Active Paying Family Circles in Month}}$$
- **Primary Events / Logs**:
  - `sms_dispatched` (properties: `cost_usd`: number [default 0.0079], `provider`: 'twilio', `segments`: number, `escalation_stage`: number)
  - `notification_audit_logs` table aggregation (`channel = 'sms'`, `status = 'delivered'`)

---

### Metric 5: Activation Rate & Time-to-Activate
- **Definition**: Activation occurs when an elder (or caregiver on their behalf) completes their very first daily check-in ("I'm OK"). Measured as the activation rate among new circles and the elapsed time between circle creation and first check-in.
- **Formula**:
  $$\text{Activation Rate} = \frac{\text{Circles with } \ge 1 \text{ Check-in}}{\text{Total Care Circles Created}} \times 100$$
  $$\text{Time to Activate (TTA)} = \text{timestamp}(\text{First Check-in}) - \text{timestamp}(\text{Circle Creation})$$
- **Primary Events**:
  - `circle_created` (records creation baseline)
  - `activation_completed` (properties: `time_to_activate_seconds`: number, `time_to_activate_hours`: number, `is_first_check_in`: true)

---

### Metric 6: Caregiver Invites Sent & Acceptance Rate
- **Definition**: Multi-caregiver network virality: the average number of caregiver invites generated per care circle, and the conversion rate from invite sent to invite accepted.
- **Formula**:
  $$\text{Invites Per Circle} = \frac{\text{Total Invites Sent / Shared}}{\text{Total Care Circles}}$$
  $$\text{Invite Acceptance Rate} = \frac{\text{Total Invites Accepted}}{\text{Total Invites Sent}} \times 100$$
- **Primary Events**:
  - `caregiver_invite_sent` (properties: `circle_id`: string, `invite_channel`: 'sms' | 'copy_link' | 'email')
  - `caregiver_invite_accepted` (properties: `circle_id`: string, `member_role`: 'viewer' | 'admin', `time_to_accept_seconds`: number)

---

## 3. Analytics Schema & Event Dictionary

| Event Name | Trigger Location | Required Properties (Zero PII) |
| :--- | :--- | :--- |
| `circle_created` | `careCircleService.createCareCircle` | `cohort_month`, `initial_member_role` |
| `first_check_in_completed` | `careCircleService.recordDailyCheckIn` | `time_to_activate_seconds`, `time_to_activate_hours` |
| `caregiver_invite_sent` | `TimelineScreen` (copy code / share) | `invite_channel`: 'copy_code' \| 'share_link' |
| `caregiver_invite_accepted` | `careCircleService.joinCareCircleByCode` | `role`: 'viewer' \| 'admin' |
| `subscription_started` | Billing / Mock Billing Service | `plan_id`, `price_usd`, `billing_cycle`, `cohort_month` |
| `subscription_cancelled` | Billing Service | `plan_id`, `churn_type`: 'voluntary', `reason`, `mrr_lost_usd` |
| `payment_failed` | Billing Service / Webhook | `plan_id`, `churn_type`: 'involuntary', `is_terminal`, `mrr_lost_usd` |
| `payment_succeeded` | Billing Service / Webhook | `plan_id`, `amount_usd`, `billing_cycle` |
| `sms_dispatched` | `careCircleService` / Twilio Edge function | `cost_usd`, `escalation_stage`, `provider`: 'twilio' |

---

## 4. Supabase Storage Architecture
1. **`analytics_events` Table**: Append-only log of raw analytics events with indexed `event_name`, `created_at`, `care_circle_id`, and JSONB `properties`.
2. **`analytics_subscriptions` Table**: Storage for subscription states (`active`, `cancelled`, `past_due`, `terminated`), plan pricing, and cohort month.
3. **`metrics_summary` View / Service**: Aggregation query calculating the 6 metrics in real time.
