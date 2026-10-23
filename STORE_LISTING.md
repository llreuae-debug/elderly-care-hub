# Elderly Care Hub — Store Listing & Metadata

## App Name
**Elderly Care Hub**

## Subtitle
Dignity-first multi-caregiver coordination & simplified elder wellness

## Category
Medical / Health & Fitness / Family Care

## Promotional Text (170 characters max)
Coordinate family care effortlessly. Medication reminders, daily check-ins, shift handoffs, and a simplified 3-button Elder Mode with 4-digit PIN login.

## Short Description (80 characters max)
Dignity-first elderly care coordination: meds, check-ins, shifts & elder mode.

---

## Full Description

Elderly Care Hub is an accessible, dignity-first coordination hub designed specifically for families and caregivers of aging loved ones. 

Unlike surveillance-style monitoring tools that strip elders of autonomy, Elderly Care Hub treats multi-caregiver coordination as the core differentiator while preserving elder dignity and independence.

### 🌟 Two Distinct Modes for Families

#### 👵 1. Simplified Elder Mode
- **Zero Passwords or Emails**: Log in securely using only a 4-digit numeric PIN.
- **Ultra-Accessible 3-Button Screen**: 24pt minimum high-contrast typography and oversized touch targets designed for low tech literacy or visual impairment:
  - 🟩 **"I'm OK"**: One-touch daily wellness check-in that gives family members instant peace of mind.
  - 🟥 **"Call for help"**: High-priority emergency trigger that instantly dispatches push notifications and Twilio SMS alerts to all circle caregivers.
  - 🟦 **"My meds today"**: Read-only dose checklist showing today's medications with clear checkmarks.
- **Zero Clutter**: No timeline feeds, settings, or confusing navigation menus.

#### 👥 2. Comprehensive Caregiver Mode
- **Shared Care Circle Timeline**: Reverse-chronological feed with realtime updates for medications, appointments, and daily wellness notes.
- **Medication Management & Reminders**: Schedule dosages, assign specific family members or nurses, and receive interactive push notifications with one-tap "Taken" and "Skipped" action buttons.
- **Daily Check-in & Escalation**: Configurable daily deadlines (e.g., 10:00 AM). If unconfirmed, the system automatically escalates—first alerting all care circle members via push, and subsequently dispatching Twilio SMS fallback alerts to the primary caregiver.
- **Shift Handoff & Coverage Tracking**: Track who is responsible right now and who is next. Create shift-specific task checklists ("change dressing", "refill pillbox") and submit handoff notes that notify incoming caregivers immediately.
- **Server-Side Permissions**: Enforced PostgreSQL Row Level Security (RLS) ensures only administrators can invite members or edit medications, while viewers have read-only access.
- **Offline Reliability**: Local queueing ensures "I'm OK" check-ins are saved if the device is offline and synced immediately once connectivity is restored.

---

## Keywords
elderly care, senior care, caregiver coordinator, medication reminder, shift handoff, daily check in, family health, elder dignity, home nursing, aging parents

## Support & Privacy
- **Support URL**: https://elderly-care-hub.vercel.app
- **Marketing URL**: https://elderly-care-hub.vercel.app
- **Privacy Policy URL**: https://elderly-care-hub.vercel.app
- **Privacy Policy Summary**: Elderly Care Hub collects only essential coordination data (caregiver emails, elder first names, and medication schedules). We never sell user data, track location without consent, or install surveillance trackers. All elder PINs are securely stored using irreversible SHA-256 cryptographic hashing.

## App Review Information (for App Store Connect Review Notes)
- **Sign-in Required**: Yes
- **Caregiver Account**: Tap "Explore with Sarah (Admin)" on the initial sign-in screen, or use email `sarah@example.com` (passwordless).
- **Elder Mode (3-Button Screen)**: Tap "Switch to Elder Mode" at the bottom of the sign-in screen, enter Circle Code `CARE01` and 4-digit PIN `1234`.
- **Review Notes**: Elderly Care Hub is a multi-caregiver coordination platform for families and home health aides. Account sign-in is required to secure medical schedules and private caregiver handoffs. Push notifications are used for time-sensitive medication reminders and missed check-in alerts.

## Version 1.0.0 Release Notes
Welcome to Elderly Care Hub!
- Multi-caregiver shared timeline with realtime updates.
- Interactive medication reminders and 2-minute test alarms.
- Daily check-in ("I'm OK") with automated 2-stage push and Twilio SMS escalation.
- Simplified Elder Mode featuring 3 oversized touch buttons and secure 4-digit PIN login.
- Caregiver shift coverage tracking, checklists, and handoff notes.
- Offline timeline caching and automatic check-in reconnection synchronization.
