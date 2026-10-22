# Elderly Care Hub — Privacy Policy & Regulatory Compliance

> [!CAUTION]
> **[NEEDS-LEGAL-REVIEW] — DO NOT ASSERT COMPLIANCE**  
> This document is an engineering and operational privacy draft. It has NOT been reviewed or ratified by licensed legal counsel. Do not represent, market, or assert legal compliance (GDPR, CCPA, HIPAA, etc.) until qualified healthcare and privacy attorneys have reviewed and executed this policy.

---

## 1. Overview & Core Philosophy

Elderly Care Hub ("we", "us", or "our") provides a dignified, mobile-first coordination platform for family caregivers and elderly loved ones. We operate on three inviolable principles:
1. **Dignity-First Privacy**: We never sell, monetize, or broker personal care data.
2. **Zero-PII Measurement Layer**: All analytics used to evaluate our business model (retention, conversion, unit economics) are strictly segregated and stripped of all personal and health identifiers.
3. **No Third-Party Tracking**: We do not embed advertising pixels, tracking cookies, cross-app tracking SDKs, or device fingerprinting tools.

---

## 2. Information We Collect

### A. Direct User & Care Information
* **Account Credentials**: Caregiver email and name (used exclusively for authentication and care circle administration).
* **Elder Profile**: Elder first name or preferred moniker and 4-digit PIN hash (stored as a one-way cryptographic hash in Supabase, never plaintext).
* **Care Coordination Records**: Medication names, reminder schedules, daily check-in confirmations ("I'm OK"), shift handoff logs, and emergency alert timestamps.
* **Notification Routing**: Primary caregiver telephone number (used strictly for Twilio SMS emergency escalation when daily check-in deadlines are missed).

### B. Operational Telemetry & Analytics Disclosure
To ensure the sustainable operation of our business model, we measure platform conversion, retention, and carrier infrastructure costs. 

**What our analytics measures:**
* Aggregated event counts (e.g. circles formed, first check-in activation completed, caregiver invitations shared).
* Subscription plan events (e.g. free-tier to Family plan conversion, cancellations, failed payment retries).
* Carrier SMS dispatch volume (to ensure Twilio carrier fees remain within economic safety budgets).

**Our Zero-PII Architecture Guarantee:**
* All analytics events are scrubbed by an automated sanitizer prior to storage.
* Analytics event properties **never** contain names, emails, phone numbers, home addresses, medication regimens, medical conditions, or caregiver notes.
* Analytics are stored in internal, service-role-only database tables and views.

---

## 3. How We Use Information

We use collected information solely to:
* Transmit medication reminders and emergency alerts to care circle members.
* Synchronize shift handoff notes and daily check-in statuses between authorized caregivers.
* Evaluate aggregated business viability metrics (Free-to-paid conversion rate, churn rates, ARPU, and carrier costs).
* Comply with applicable legal, tax, and accounting mandates.

---

## 4. Third-Party Services & No-Tracking Guarantees

* **Authentication & Database**: Hosted on Supabase (PostgreSQL with Row Level Security enforcing server-side tenant isolation).
* **SMS Gateway**: Twilio Inc. (dispatches urgent missed check-in alerts and emergency notifications to caregiver mobile numbers; numbers are never utilized for marketing).
* **NO Advertising Pixels**: We do not use Meta/Facebook Pixel, Google Analytics, AppsFlyer, Branch, Adjust, TikTok SDK, or any tracking network.
* **NO Cross-App Tracking**: We do not track users across third-party applications or websites. We do not collect Apple Identifier for Advertisers (IDFA) or Google Advertising ID (GAID).
* **NO Device Fingerprinting**: We do not perform canvas, WebGL, or hardware fingerprinting.

---

## 5. Data Retention & Erasure Policy

| Category | Retention Schedule | Deletion Handling |
| :--- | :--- | :--- |
| **Active Care Circle Data** | Retained while care circle remains active. | Purged within 24 hours of circle deletion. |
| **Raw Analytics Events (`analytics_events`)** | **90 Days** (Recommended) | Auto-purged via rolling database maintenance job. |
| **Aggregate Business Views (`v_mrr`, `v_churn`, etc.)** | **24 Months** (Recommended) | Completely anonymized; contains zero personal records. |
| **Carrier Delivery Logs (`twilio_usage`)** | **180 Days** | Retained for billing audit reconciliation with carrier. |

### User Deletion Requests (Right to Be Forgotten)
Users may request complete deletion of their account and care circle data at any time via in-app account settings or by contacting privacy@elderlycarehub.example.com.

---

## 6. Interaction Between Deletion Requests and Billing Records

> [!WARNING]
> **[NEEDS-LEGAL-REVIEW] — TENSION BETWEEN ERASURE AND STATUTORY RETENTION**  
> While data protection laws (GDPR, CCPA) grant data subjects the right to delete personal information, tax and corporate accounting regulations (such as IRS Section 6001, state sales tax guidelines, and international accounting standards) mandate preserving financial transactions, payment receipts, and subscription invoices for **5 to 7 years**.

**Draft Policy Approach**:
1. When a deletion request is executed, all care coordination data (medications, timeline events, check-ins, profiles) is **permanently destroyed**.
2. Financial invoice records stored in `public.subscriptions` are **sequestered into an encrypted, restricted-access compliance vault** for the legally mandated tax retention period.
3. User foreign keys in analytics records are unlinked (`user_id = null`), severing any relationship to the individual.
4. *Legal counsel must review and confirm exact statutory retention requirements before production rollout.*

---

## 7. Healthcare Disclaimers

Elderly Care Hub is a care coordination and communication utility designed to assist families and caregivers. It is **not** a certified medical device, medical diagnostic system, or hospital patient management system. In the event of a medical emergency, caregivers and elders must always contact local emergency services (e.g. 911).
