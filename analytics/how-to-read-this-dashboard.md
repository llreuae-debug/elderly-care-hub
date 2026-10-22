# How to Read This Dashboard — Operational Guide

**Purpose**: Executive guide explaining what each metric measures, its known undercount/margin of error, and the operational decision it should drive.

---

### 1. Free → Paid Conversion
* **What it means**: Percentage and count of registered care circles that convert to a paid Family plan ($19.99/mo or $199.99/yr), grouped by signup cohort month.
* **Known undercount**: Users who complete payment externally but close their browser/app before returning will drop client events. Reconciled server-side from `public.subscriptions`. Circles created late at night near month boundaries may fall into the next calendar month.
* **Decision it should drive**:
  * If conversion < 8%: Free tier is too generous or paywall value proposition is weak; investigate feature gating.
  * If conversion > 15%: Strong product-market fit; scale caregiver acquisition channels.

---

### 2. Churn (Voluntary Cancellations vs. Involuntary Payment Failures)
* **What it means**: The rate of subscribers leaving the service each month, split into **voluntary** (caregiver manually cancelled) vs. **involuntary** (card expired, bank declined, dunning retries failed).
* **Known undercount**: Multi-day dunning retries that span across month boundaries shift the recorded failure into the following month.
* **Decision it should drive**:
  * If involuntary churn > voluntary churn: Payment friction issue. Implement automated pre-expiration card reminder emails, in-app billing update banners, and Stripe smart retries.
  * If voluntary churn is high: Product dissatisfaction or elder situation changed (e.g. moved to nursing home). Trigger exit surveys.

---

### 3. ARPU (Average Revenue Per User)
* **What it means**: Net monthly subscription revenue divided by the number of active paying care circles.
* **Known undercount**: Annual plans ($199.99) are amortized to $16.67/mo in SQL. Refunds executed directly in Stripe dashboard require manual sync.
* **Decision it should drive**:
  * Drives pricing and packaging decisions. If ARPU trends below $18.50, annual discounts may be too steep or promotional codes are overused.

---

### 4. SMS Cost Per User Per Month
* **What it means**: Total carrier fees incurred from Twilio SMS emergency escalation divided by active Family subscribers in that month.
* **Known undercount**: Assumes standard $0.0079 per message segment. Messages >160 characters split into 2 billed segments ($0.0158). Landline delivery attempts are billed by Twilio regardless of delivery status.
* **Decision it should drive**:
  * Unit economic margin safety check: Carrier cost must remain strictly **under 5% of ARPU** (<$1.00/mo). If SMS cost per user exceeds $0.50/mo, reduce check-in escalation frequency or shorten message templates.

---

### 5. Activation (First Check-In Completed & Time-to-Activate)
* **What it means**: The proportion of care circles where an elder or caregiver taps "I'm OK" for the very first time, and the elapsed hours between circle creation and that first check-in.
* **Known undercount**: Check-ins queued offline preserve initial tap timestamps; circles created late in the evening naturally wait until 10:00 AM the following morning (12h+ elapsed).
* **Decision it should drive**:
  * If activation rate < 60%: High drop-off during onboarding. Simplify elder PIN setup and send proactive day-1 push reminders to caregivers.
  * If median TTA > 24 hours: First check-in deadline is too far in the future; guide user to do an immediate test check-in during setup.

---

### 6. Caregiver Invites Sent & Acceptance Rate
* **What it means**: Multi-caregiver network expansion: the average number of caregiver invites dispatched per circle, and the percentage of those invites accepted.
* **Known undercount**: Rapid repeated taps on "Copy Code" are debounced. Verbal code sharing over the phone bypasses sent tracking, which can lead to acceptance rates exceeding 100%.
* **Decision it should drive**:
  * If invites per circle < 1.5: The app is being used as a solo tool rather than a care circle. Prompt the creator to add secondary caregivers, siblings, or nurses.
  * If accept rate < 50%: The invite link/code landing flow is confusing. Optimize the join-by-code screen.
