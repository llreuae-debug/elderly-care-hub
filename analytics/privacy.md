# Elderly Care Hub — Analytics Privacy & Retention Policy

**Document**: `analytics/privacy.md`  
**Status**: Active Internal Specification  
**Compliance Classification**: Strict Zero-PII Architecture  

---

## 1. What Is Collected

The measurement layer is designed exclusively to assess business viability, retention, conversion, and unit economics. All event payloads are scrubbed by an automated client-side and server-side sanitizer before storage.

### Data Permitted in Telemetry
* **Non-identifying IDs**: Anonymous system-generated UUIDs (`user_id`, `care_circle_id`, `event_id`).
* **Event Names**: Documented metric events (e.g., `subscription_started`, `first_check_in_completed`, `sms_dispatched`).
* **Cohort Attribution**: Cohort month strings formatted as `YYYY-MM` (e.g. `2026-10`).
* **Numeric Quantities**: Monetary pricing (`price_usd`), duration elapsed in seconds/hours (`time_to_activate_seconds`), carrier message segment counts, and escalation stages (`1` or `2`).
* **Environment Metadata**: Operating system platform (`'ios'`, `'android'`, or `'web'`) and semantic application version (`'1.0.0'`).
* **Timestamps**: UTC ISO-8601 timestamps (`created_at`).

### Data Strictly PROHIBITED from Analytics (Zero-PII Guarantee)
The following fields are **never collected, logged, or stored** in any analytics table, event payload, or SQL view:
* ❌ Real names (elder names, caregiver names, family member names).
* ❌ Email addresses.
* ❌ Telephone numbers and mobile numbers.
* ❌ Physical home or facility street addresses.
* ❌ Social Security Numbers or government IDs.
* ❌ Medication names, dosages, frequencies, and prescription notes.
* ❌ Caregiver shift handoff notes or daily check-in text notes.
* ❌ IP addresses or geolocation coordinates.

---

## 2. Why Data Is Collected

Data collection is restricted to five core operational purposes:
1. **Free → Paid Conversion**: Measuring whether family care circles derive sufficient value from the free tier to subscribe to the Family plan ($19.99/mo or $199.99/yr).
2. **Churn Prevention**: Isolating voluntary cancellations (service no longer needed) from involuntary churn (card expirations / dunning friction) to optimize payment retry flows.
3. **Unit Economic Viability**: Calculating Average Revenue Per User (ARPU) and tracking Twilio carrier costs per subscriber to ensure SMS escalation alerts do not exceed sustainable carrier cost thresholds (<5% of MRR).
4. **Product Activation**: Measuring time-to-activate (elapsed time between circle creation and first "I'm OK" check-in) to diagnose onboarding drop-offs.
5. **Care Circle Virality**: Tracking caregiver invite dispatch and acceptance rates to measure multi-caregiver circle formation.

---

## 3. Retention Periods

To balance historical cohort analysis with data minimization principles:

| Data Store | Retention Period | Rationale & Automated Policy |
| :--- | :--- | :--- |
| **Raw Events (`analytics_events`)** | **90 Days** (Recommended) | Individual raw events lose operational utility after 90 days. An automated Supabase pg_cron job drops raw event rows where `created_at < now() - interval '90 days'`. |
| **Aggregate Views & Cohort Tables (`v_mrr`, `v_conversion_cohorts`, etc.)** | **24 Months** (Recommended) | Cohort conversion and year-over-year churn comparisons require 24 months of monthly summary records. Aggregate views contain zero individual records or identifiers. |
| **Carrier Usage Logs (`twilio_usage`)** | **180 Days** | Reconciled monthly against Twilio carrier invoices for financial auditing, then archived. |

---

## 4. User Deletion Requests (Right to Be Forgotten)

When a caregiver or elder exercises their right to data deletion (via in-app account deletion or privacy request):
1. **Immediate PII Purge**: The user's row in `auth.users` and `public.profiles` is deleted.
2. **Relational Cascades**: Database foreign key cascades (`on delete cascade`) automatically purge care circle memberships, medication schedules, and daily check-in entries associated with their account.
3. **Analytics Anonymization**: The `analytics_events` table enforces `user_id uuid references auth.users(id) on delete set null`. Deleting the user automatically sets `user_id = null` on all historical events, unlinking the record entirely from any human entity.

---

## 5. Interaction Between Deletion Requests and Billing Records

> [!WARNING]
> **FLAGGED FOR LEGAL & FINANCIAL REVIEW**  
> **Tension**: Privacy regulations (GDPR Article 17, CCPA) grant users the right to erasure, BUT statutory commercial and tax regulations (IRS Section 6001, state sales tax laws, UK HMRC) legally mandate retaining accounting records, invoices, and transaction logs for **5 to 7 years**.

### Operational Policy
* **Do NOT delete financial transaction records**: Subscription invoices, payment gateway customer IDs, and tax amounts in `public.subscriptions` must be retained for the statutory 7-year retention window.
* **Separation of Concerns**: In response to a deletion request:
  * Care coordination data, profiles, and timeline events are **erased immediately**.
  * Billing records are **sequestered into a restricted, read-only financial compliance vault** with access restricted strictly to accounting personnel.
  * Analytics identifiers (`user_id`) in event logs are **anonymized (`NULL`)**.
* **Legal Counsel Mandate**: Final determination of the retention window for invoices vs. erasure requests must be confirmed by qualified legal counsel prior to public release.

---

## 6. Strict Tracking Guarantees

* **No Third-Party Advertising / Analytics Pixels**: The codebase contains **zero** third-party marketing SDKs (no Meta/Facebook Pixel, Google Tag Manager, AppsFlyer, Branch, Adjust, or TikTok SDKs).
* **No Cross-App Tracking**: The application does not request Apple App Tracking Transparency (ATT) permission because it does not participate in any advertising data brokerage or cross-app tracking networks.
* **No Device Fingerprinting**: The application does not collect IDFA, Google Advertising ID (GAID), hardware MAC addresses, or browser canvas fingerprints. Device metadata is strictly limited to generic platform family (`'ios'`, `'android'`, `'web'`).
