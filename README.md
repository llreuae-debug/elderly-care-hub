# Elderly Care Hub — Phase 1 & 2

An accessible, dignity-first coordination hub for families and caregivers of elders.

Phase 1 established the core multi-caregiver coordination foundation: **magic-link authentication, care circle management via 6-character invite codes, and a shared reverse-chronological timeline feed with realtime updates.**

Phase 2 introduces **medication reminders with interactive notifications, a daily check-in ("I'm OK") workflow, automated missed check-in escalation (caregiver push alerts + Twilio SMS fallback), and the "Today" schedule view.**

---

## 📱 Features Implemented

### Phase 2 Additions
1. **Medication Model & Schedules**:
   - `medications` table: Name, dosage, schedule (`["08:00", "20:00"]`), assigned caregiver, instructions.
   - `medication_logs` table: Daily dose tracking (`taken`, `skipped`, `pending`).
   - Default Phase 2 Meds for Eleanor Vance:
     - 💊 `Lisinopril 10mg` at 08:00 AM (Assigned: Sarah Vance)
     - 💊 `Metoprolol Tartrate 25mg` at 08:00 AM & 08:00 PM (Assigned: Nurse Marcus)
     - 💊 `Vitamin D3 & Calcium 1000 IU` at 12:00 PM (Assigned: Sarah Vance)

2. **Medication Reminders & Interactive Notifications**:
   - Powered by `expo-notifications` (Expo SDK 58 compatible).
   - Configured interactive category `MEDICATION_REMINDER` with action buttons:
     - `✓ Taken`: Updates log status to Taken and logs to the circle timeline.
     - `✕ Skipped`: Updates log status to Skipped and logs note to the circle timeline.
   - 2-Minute Quick Reminder button (`🔔 2m Reminder`) on every medication card for instant testing and device verification.

3. **Daily Check-in Workflow (Elder Dignity First)**:
   - High-contrast, large touch-target check-in card.
   - Elder or caregiver on their behalf taps **"☀️ Tap: I'm OK"** once per day.
   - Configurable circle deadline (default: **10:00 AM**, stored in `care_circles.check_in_deadline_time`).
   - Instantly posts a confirmation event to the timeline: `☀️ Daily Check-in: Eleanor is OK`.

4. **Missed Check-in Escalation**:
   - **Stage 1 (Deadline passed, e.g. 10:00 AM)**:
     - Push notification alert sent to all circle caregivers:
       `"⚠️ Alert: Missed Daily Check-in: Eleanor Vance Care Circle has not checked in by 10:00. Please verify your loved one is safe."`
     - Logs warning event to the timeline feed.
   - **Stage 2 (30 minutes after deadline, e.g. 10:30 AM)**:
     - Twilio SMS dispatched to primary caregiver phone (`care_circles.primary_caregiver_phone`):
       `"URGENT [Elderly Care Hub]: Eleanor Vance Care Circle missed daily check-in (deadline 10:00). 30-min escalation window expired without confirmation. Please call or visit immediately."`
     - Logs emergency escalation event to the timeline feed.
   - **Supabase Edge Function**: [supabase/functions/check-in-escalation/index.ts](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/functions/check-in-escalation/index.ts) executes the Twilio REST API request and updates check-in escalation state.

5. **"Today" View Screen**:
   - Prominent Daily Check-in card with status badge (`CONFIRMED`, `PENDING BY 10:00`, or `OVERDUE`).
   - Summary of today's doses (e.g. `2 of 4 Taken`).
   - Individual medication cards with quick Taken, Skip, and 2m Reminder triggers.
   - Tab switcher between **☀️ Today** and **📜 Timeline**.

---

## 🛠️ Tech Stack & Constraints

- **Frontend**: React Native with Expo SDK 58 (managed workflow) for iOS, Android, and Web.
- **Backend**: Supabase (Postgres Database, Auth, Row Level Security, Realtime, Edge Functions).
- **Notifications**: `expo-notifications` for interactive local push alerts.
- **SMS Fallback**: Twilio REST API via Supabase Edge Functions.
- **Language**: TypeScript strict mode (`noImplicitAny`, strict null checks, zero `any`).
- **Tests**: Jest integration test suite (20 tests covering Phase 1 and Phase 2).

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase Migrations
Apply migrations in order using Supabase CLI or the SQL Editor in Supabase Dashboard:
1. [supabase/migrations/20261023000001_initial_schema.sql](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/migrations/20261023000001_initial_schema.sql) (Phase 1)
2. [supabase/migrations/20261023000002_phase2_meds_and_checkins.sql](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/migrations/20261023000002_phase2_meds_and_checkins.sql) (Phase 2)
3. [supabase/seed.sql](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/seed.sql)

### 3. Deploy Supabase Edge Function (Twilio Missed Check-in Escalation)
Deploy the Edge Function to your Supabase project:
```bash
npx supabase functions deploy check-in-escalation
```
Set secrets in Supabase Dashboard (or via CLI):
```bash
npx supabase secrets set \
  TWILIO_ACCOUNT_SID=your-account-sid \
  TWILIO_AUTH_TOKEN=your-auth-token \
  TWILIO_PHONE_NUMBER=+1234567890 \
  FALLBACK_CAREGIVER_PHONE=+15551234567
```

---

## 🧪 Running Integration Tests

Run the full integration test suite:
```bash
npm test
```

20 tests verify:
- Caregiver magic-link auth validation and persona loading.
- Care circle creation, invite code generation, and member roles (`admin`/`viewer`).
- Timeline feed reverse-chronological ordering, filtering, note creation, and realtime event propagation.
- Medication models, dosages, multiple daily schedules, and caregiver assignment.
- Scheduling local notifications 2 minutes out.
- Marking medication Taken and Skipped with automatic timeline logging.
- Daily check-in ("I'm OK") recording and timeline reflection.
- Missed check-in escalation: Stage 1 push notification broadcast and Stage 2 Twilio SMS dispatch.

Run strict TypeScript typecheck:
```bash
npx tsc --noEmit
```

---

## 📱 Running the App

### Web Preview (Immediate Browser Testing)
```bash
npm run web
```
Opens at `http://localhost:8081`.

### Physical Device (Recommended for Push Notifications)
Because iOS and Android simulators do not support native background APNs/FCM local trigger behavior reliably, run on a physical device:
```bash
npm start
```
Scan the QR code with your iPhone Camera (iOS) or the **Expo Go** app (Android).

### iOS Simulator
```bash
npm run ios
```

---

## 🔬 How to Verify Phase 2 Deliverables

1. **Test Medication Reminder (2 minutes out)**:
   - Log in as Sarah or Marcus.
   - On the **Today** tab, locate any medication (e.g. *Lisinopril 10mg*).
   - Tap **"🔔 2m Reminder"**.
   - A notification is scheduled for 120 seconds out with interactive "✓ Taken" and "✕ Skipped" action buttons.
2. **Test Daily Check-in**:
   - In the **Daily Check-in** card, tap **"☀️ Tap: I'm OK"**.
   - Notice the card updates to `"✓ Eleanor is OK Today"`.
   - Tap the **"📜 Timeline"** tab to see `☀️ Daily Check-in: Eleanor is OK` logged with the current timestamp.
3. **Test Missed Check-in Escalation (Push then SMS)**:
   - In the **Daily Check-in** card, tap **"🔔 Test Escalation: Trigger Missed Alert (Push + Twilio SMS)"**.
   - An alert confirms:
     1. Stage 1: Push notification dispatched to all circle caregivers.
     2. Stage 2: Twilio SMS alert sent to the primary caregiver (`+15551234567`).
   - Switch to **"📜 Timeline"** to verify that `🚨 Emergency Escalation: SMS Dispatched to Primary Caregiver` is recorded.
