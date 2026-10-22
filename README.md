# Elderly Care Hub — Phase 1, 2 & 3

An accessible, dignity-first coordination hub for families and caregivers of elders.

- **Phase 1**: Caregiver magic-link authentication, care circle management via 6-character invite codes, and a shared reverse-chronological timeline feed with realtime updates.
- **Phase 2**: Medication reminders with interactive notifications, daily check-in ("I'm OK") workflow, automated missed check-in escalation (caregiver push alerts + Twilio SMS fallback), and the "Today" schedule view.
- **Phase 3**: Simplified Elder Mode (3 large high-contrast buttons, minimum 24pt font, zero clutter), 4-digit PIN authentication (stored securely as SHA-256 hash in Supabase, no email required), and server-side Caregiver permissions enforcement (Admin vs Viewer Row Level Security policies).

---

## 📱 Features Implemented

### Phase 3 Additions
1. **Simplified Elder Mode (Dignity & Accessibility First)**:
   - Dedicated, uncluttered home screen designed specifically for elders with low tech literacy or visual impairments.
   - **Font size: 24pt minimum** (32px) throughout the elder interface.
   - **ONLY three large high-contrast touch buttons**:
     - 🟩 **"I'm OK"** (Huge green button, min-height 120px): Tap once per day to log daily check-in.
     - 🟥 **"Call for help"** (Huge red button, min-height 120px): Creates high-priority timeline event and immediately triggers push notifications + Twilio SMS to all circle admins.
     - 🟦 **"My meds today"** (Huge blue button, min-height 120px): Opens a simplified read-only list showing today's medications with clear taken (✓) / pending (⏳) checkmarks.
   - **Strict isolation**: Zero timeline feeds, zero settings, zero account management, zero navigation drawer clutter.
   - Reversible "← Exit Elder Mode" footer option to return to caregiver login.

2. **Elder 4-Digit PIN Authentication**:
   - Elders log in using only a **4-digit PIN** and circle code (e.g. `CARE01` + PIN `1234`).
   - **No email address or passwords required for the elder**.
   - **Cryptographic Security**: Stored as a **SHA-256 hash** (`elder_pin_hash`) in Supabase Postgres, never in plaintext.
   - Authenticated server-side via Supabase RPC function `verify_elder_pin(p_invite_code, p_pin_hash)`.

3. **Server-Side Caregiver Permissions Enforcement (Row Level Security)**:
   - Enforced at the **database layer (PostgreSQL RLS)**, not just client-side UI hiding:
     - 👑 **Admin (e.g., Sarah Vance - Primary Caregiver)**:
       - Can invite and remove circle members.
       - Can add, edit, and delete medications.
       - Can change circle settings (check-in deadline time, primary caregiver phone).
     - 👁️ **Viewer (e.g., Dr. Marcus Brody - Home Nurse)**:
       - Can view timeline events, medications list, and check-in status.
       - **Strictly blocked** from creating/editing medications, modifying settings, or removing members. Direct API attempts receive a permission denied RLS error.

4. **"Call for help" High-Priority Escalation**:
   - Tapping "Call for help" in Elder Mode:
     1. Creates a high-priority timeline event (`🚨 EMERGENCY: Eleanor called for help!`).
     2. Dispatches an immediate high-priority push alert to all circle members.
     3. Invokes the Supabase Edge Function to send an immediate Twilio SMS to all circle admins (`+15551234567`).

---

## 🛠️ Tech Stack & Constraints

- **Frontend**: React Native with Expo SDK 58 (managed workflow) for iOS, Android, and Web.
- **Backend**: Supabase (Postgres Database, Auth, Row Level Security, Realtime, Edge Functions).
- **Cryptography**: `expo-crypto` for SHA-256 PIN hashing.
- **Notifications**: `expo-notifications` for interactive local push alerts.
- **SMS Fallback**: Twilio REST API via Supabase Edge Functions.
- **Language**: TypeScript strict mode (`noImplicitAny`, strict null checks, zero `any`).
- **Tests**: Jest integration test suite (5 suites, 37 passing integration tests).

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase Migrations
Apply migrations in order in the Supabase SQL Editor or CLI:
1. `supabase/migrations/20261023000001_initial_schema.sql` (Phase 1)
2. `supabase/migrations/20261023000002_phase2_meds_and_checkins.sql` (Phase 2)
3. `supabase/migrations/20261023000003_phase3_elder_pin_and_permissions.sql` (Phase 3)
4. `supabase/seed.sql`

Seed Elder Credentials:
- **Care Circle Code**: `CARE01`
- **Elder PIN**: `1234` (Stored hash: `03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4`)

---

## 🧪 Running Integration Tests

Run the full integration test suite:
```bash
npm test
```

**37 passing integration tests across 5 test suites**:
- `auth.integration.test.ts`: Caregiver magic-link auth and persona handling.
- `careCircle.integration.test.ts`: Care circle creation, invite codes, and memberships.
- `timeline.integration.test.ts`: Reverse-chronological feed, filtering, notes, and realtime events.
- `medicationAndCheckin.integration.test.ts`: Medication schedules, 2m reminders, daily check-in, push and SMS escalation.
- `elderModeAndPermissions.integration.test.ts`:
  - 4-digit PIN SHA-256 hashing and login validation.
  - Elder Mode 3 buttons ("I'm OK", "Call for help", "My meds today").
  - Server-side RLS permission checks: Admin permitted to mutate meds/settings/members; Viewer denied on all mutations.

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

### iOS / Android Device (via Expo Go)
```bash
npm start
```
Scan the QR code with your iPhone Camera or Android Expo Go app.

---

## 🔬 How to Verify Phase 3 Deliverables

### 1. Test Elder Mode & 4-Digit PIN Auth
1. Launch the app (`http://localhost:8081`).
2. On the login screen, click **"👵 Switch to Elder Mode (4-Digit PIN)"**.
3. Use the large keypad to enter PIN **`1234`** and click **"👵 Log In to Elder Mode"**.
4. **Confirm Elder Mode Screen**:
   - Exactly **three large buttons** appear:
     - 🟩 **"I'm OK"**
     - 🟥 **"Call for help"**
     - 🟦 **"My meds today"**
   - Font size is 24pt minimum (32px).
   - No timeline, no settings, no account management.
5. Tap **"I'm OK"** → verifies check-in is recorded.
6. Tap **"My meds today"** → displays read-only list with doses and taken checkmarks.
7. Tap **"🚨 Call for help"** → triggers emergency confirmation banner simulating immediate Push + Twilio SMS to admins.

### 2. Verify Caregiver Permissions Enforcement (Admin vs Viewer)
1. Tap **"← Exit Elder Mode"** to return to caregiver mode.
2. Click **"Dr. Marcus Brody (Viewer)"** quick demo login.
3. Observe that Dr. Marcus is in Read-Only Viewer mode:
   - Can read timeline and check-in status.
   - Medication editing and circle settings modifications are disabled in UI and rejected server-side by Supabase RLS.
4. Run `npm test` to verify the automated RLS policy test suite:
   ```bash
   npm test __tests__/elderModeAndPermissions.integration.test.ts
   ```
