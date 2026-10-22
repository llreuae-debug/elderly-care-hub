# Elderly Care Hub — Phase 1

An accessible, dignity-first coordination hub for families and caregivers of elders.

Phase 1 delivers the foundational workflow: **caregivers can log in with a magic link, create or join a Care Circle with an invite code, view a shared reverse-chronological timeline feed with pull-to-refresh & realtime updates, and add care updates (notes, medications, appointments).**

---

## 📱 Features Implemented (Phase 1)

1. **Authentication**:
   - Magic link email for caregivers (`supabase.auth.signInWithOtp`).
   - No passwords required (low tech literacy principle).
   - Quick testing personas for seed caregivers (Sarah & Dr. Marcus).
   - *Note: Elders will use a 4-digit PIN in Phase 3; elder auth is explicitly deferred per project rules.*

2. **Care Circle Management**:
   - Create a new Care Circle with automatic unique 6-character invite code (e.g. `CARE01`).
   - Assigns circle creator as `admin`.
   - Join existing circles using the invite code (assigns joining caregiver as `viewer`).
   - Tap-to-share invite code with fellow family members and nurses.

3. **Shared Timeline Feed**:
   - Reverse-chronological timeline feed (newest first).
   - Event categorization with distinct high-contrast badges:
     - 📝 **Care Note** (meals, walk, rest, mood)
     - 💊 **Medication** (dose given, vitals, reactions)
     - 🩺 **Appointment** (clinic visits, hospital checkups)
   - Author attribution & relative timestamping ("Just now", "45m ago", "Yesterday").
   - Filter bar with item counts (`All Updates`, `Care Notes`, `Medications`, `Appointments`).
   - Pull-to-refresh (`RefreshControl`).
   - Realtime subscription banner and live updates via Supabase Realtime channel.

4. **Add Note / Care Update**:
   - Accessible modal with 48px+ touch targets.
   - Type selector: Care Note, Medication, Appointment.
   - Title, notes/details, and timestamp.
   - Immediate insertion to timeline with realtime broadcast.

5. **Seed Data**:
   - 1 Care Circle: `Eleanor Vance Care Circle` (code: `CARE01`).
   - 2 Members:
     - **Sarah Vance (Daughter)** — Role: `admin`
     - **Dr. Marcus Chen (Home Nurse)** — Role: `viewer`
   - 3 Timeline Events:
     - 🩺 `Cardiologist Follow-up Scheduled` (Appointment)
     - 💊 `Morning Blood Pressure & Beta Blocker Administered` (Medication)
     - 📝 `Afternoon Walk & Tea in the Garden` (Care Note)

---

## 🛠️ Tech Stack & Constraints

- **Frontend**: React Native with Expo SDK 58 (managed workflow) for iOS, Android, and Web.
- **Backend**: Supabase (Postgres Database, Auth, Row Level Security, Realtime).
- **Language**: TypeScript strict mode (`noImplicitAny`, strict null checks, no `any`).
- **Tests**: Jest integration test suite covering all Phase 1 requirements.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn
- For iOS Simulator: macOS with Xcode installed (`xcode-select --install`)
- For Mobile Device testing: Expo Go app installed on your iPhone or Android phone

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase (Backend)

#### Option A: Quick Test & Instant Verification (Zero Setup)
The app includes seamless offline/demo data matching the seed requirements. You can immediately launch the app without creating a Supabase account.

#### Option B: Connecting to Live Supabase Project
1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` with your project credentials.
4. Apply the database migrations:
   - Navigate to the Supabase Dashboard **SQL Editor**.
   - Copy and execute [supabase/migrations/20261023000001_initial_schema.sql](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/migrations/20261023000001_initial_schema.sql).
5. Seed the database:
   - Copy and execute [supabase/seed.sql](file:///Users/dilnawaz/Elderly%20Care%20Hub/supabase/seed.sql) in the SQL Editor.
   - Alternatively, run `npm run seed` with `SUPABASE_SERVICE_ROLE_KEY` set.

---

## 🧪 Running Integration Tests

Run the full integration test suite:
```bash
npm test
```

Tests cover:
- Caregiver magic-link auth validation and persona loading.
- Care circle creation, unique invite code generation, and joining with `admin`/`viewer` roles.
- Timeline feed reverse-chronological ordering, filtering, note creation, and realtime event propagation.

Type check in strict mode:
```bash
npx tsc --noEmit
```

---

## 📱 Running the App

### iOS Simulator
```bash
npm run ios
```
*Note: Make sure an iOS Simulator is booted or available in Xcode.*

### Web Preview (Immediate Browser Testing)
```bash
npm run web
```
Opens in your browser at `http://localhost:8081`.

### Android Emulator / Device
```bash
npm run android
```

### Physical Phone (iOS / Android via Expo Go)
```bash
npm start
```
Scan the QR code in your terminal with the camera (iOS) or Expo Go app (Android).

---

## 📂 Project Structure

```
.
├── .agents/
│   └── rules.md                  # Project rules & constraints
├── __tests__/                    # Integration test suites
│   ├── auth.integration.test.ts
│   ├── careCircle.integration.test.ts
│   └── timeline.integration.test.ts
├── App.tsx                       # Root app router & auth listener
├── app.json                      # Expo configuration
├── package.json
├── PROJECT_RULES.md              # Core product & engineering principles
├── scripts/
│   └── seed.ts                   # Automated seed verification script
├── src/
│   ├── components/
│   │   ├── Button.tsx            # Large touch target buttons
│   │   ├── FilterBar.tsx         # Event filter chips
│   │   ├── Input.tsx             # Accessible form input
│   │   └── TimelineCard.tsx      # Dignified timeline card with badge & metadata
│   ├── lib/
│   │   └── supabase.ts           # Supabase client with auth persistence
│   ├── screens/
│   │   ├── AddNoteScreen.tsx     # Add care update modal
│   │   ├── AuthScreen.tsx        # Magic link login & persona switchers
│   │   ├── CircleSelectScreen.tsx# Select, create, or join care circle
│   │   └── TimelineScreen.tsx    # Live shared timeline feed
│   ├── services/
│   │   ├── careCircleService.ts  # Supabase RPC, queries, and realtime sync
│   │   └── mockData.ts           # Phase 1 seed data fixtures
│   └── types/
│       └── database.ts           # Strict TypeScript models
└── supabase/
    ├── migrations/
    │   └── 20261023000001_initial_schema.sql # RLS policies, tables, functions
    └── seed.sql                  # Seed data (1 circle, 2 members, 3 events)
```
