# Elderly Care Hub — Pre-Launch Links & Navigation Audit Report

**Date**: October 23, 2026  
**Auditor**: Senior QA & Release Engineer  
**Audit File**: `audit/links-audit.md`  

---

## Summary Counts

| Status | Count | Description |
| :--- | :---: | :--- |
| **OK** | 49 | Routes, internal asset paths, screens, and handlers functioning as designed. |
| **FIXED** | 10 | Previously missing or unhandled routes, deep link listeners, shortcuts, and metadata resolved. |
| **NEEDS-INPUT** | 8 | External placeholder URLs awaiting production domain and legal policy endpoints. |
| **UNVERIFIED** | 1 | Live carrier Twilio SMS dispatch requiring paid Twilio account credentials and cellular network. |
| **TOTAL** | **68** | All 68 scanned items accounted for; 0 broken links remaining. |

---

## Detailed Audit Table

| ID | Type | Location (file:line) | Target | Status | Notes / Fix Description |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **LNK-01** | internal | `app.json:8` | `./assets/icon.png` | **OK** | App icon asset verified on disk (1,012,918 bytes). |
| **LNK-02** | internal | `app.json:11` | `./assets/splash-icon.png` | **OK** | Splash screen image verified on disk (298,847 bytes). |
| **LNK-03** | internal | `app.json:21` | `./assets/android-icon-foreground.png` | **OK** | Android adaptive foreground asset verified on disk (298,847 bytes). |
| **LNK-04** | internal | `app.json:22` | `./assets/android-icon-background.png` | **OK** | Android adaptive background asset verified on disk (17,549 bytes). |
| **LNK-05** | internal | `app.json:23` | `./assets/android-icon-monochrome.png` | **OK** | Android monochrome icon asset verified on disk (4,140 bytes). |
| **LNK-06** | internal | `app.json:28` | `./assets/favicon.png` | **OK** | Web favicon asset verified on disk (6,796 bytes). |
| **LNK-07** | internal | `app.json:34` | `./assets/icon.png` | **OK** | Expo Notifications plugin icon asset verified on disk. |
| **LNK-08** | internal | `src/screens/AuthScreen.tsx:78` | `../../assets/logo.png` | **OK** | Brand logo asset verified on disk (1,370,605 bytes). |
| **LNK-09** | internal | `src/screens/ElderLoginScreen.tsx:74` | `../../assets/logo.png` | **OK** | Brand logo asset verified on disk. |
| **LNK-10** | internal | `src/screens/OnboardingModal.tsx:102` | `../../assets/logo.png` | **OK** | Brand logo asset verified on disk. |
| **LNK-11** | nav | `app.json:5` | `scheme: "elderlycare"` | **FIXED** | Added `"scheme": "elderlycare"` in `app.json` enabling native OS deep linking. |
| **LNK-12** | nav | `src/lib/deepLinking.ts:92` | `elderlycare://today` | **FIXED** | Implemented URL parser mapping `today` to caregiver Today schedule screen. |
| **LNK-13** | nav | `src/lib/deepLinking.ts:95` | `elderlycare://coverage` | **FIXED** | Implemented URL parser mapping `coverage` to Coverage & Shift screen. |
| **LNK-14** | nav | `src/lib/deepLinking.ts:98` | `elderlycare://timeline` | **FIXED** | Implemented URL parser mapping `timeline` to Timeline feed screen. |
| **LNK-15** | nav | `src/lib/deepLinking.ts:102` | `elderlycare://elder` | **FIXED** | Implemented URL parser mapping `elder` to simplified Elder Mode. |
| **LNK-16** | nav | `src/lib/deepLinking.ts:81` | `elderlycare://circle/join/:code` | **FIXED** | Implemented URL parser extracting invite code and auto-joining circle. |
| **LNK-17** | nav | `App.tsx:88` | `Linking.getInitialURL()` | **FIXED** | Added cold launch URL handler routing deep link intents on app startup. |
| **LNK-18** | nav | `App.tsx:91` | `Linking.addEventListener('url')` | **FIXED** | Added runtime URL listener routing deep link intents when app is running. |
| **LNK-19** | nav | `App.tsx:152` | `OnboardingModal` | **OK** | Triggered via top toolbar "ℹ️ Tutorial" button & first-run flag. |
| **LNK-20** | nav | `App.tsx:284` | `ElderLoginScreen` | **OK** | Triggered from `AuthScreen` via "Switch to Elder Mode". |
| **LNK-21** | nav | `App.tsx:291` | `ElderLoginScreen` | **FIXED** | Added `onSwitchToElderMode` to `CircleSelectScreen` for direct elder mode switch. |
| **LNK-22** | nav | `src/screens/ElderLoginScreen.tsx:203` | `AuthScreen` | **OK** | "Switch to Caregiver Login" returns to caregiver mode. |
| **LNK-23** | nav | `src/screens/ElderHomeScreen.tsx:183` | `AuthScreen` / `CircleSelectScreen` | **OK** | "Exit Elder Mode" clears elder session and restores caregiver mode. |
| **LNK-24** | nav | `src/screens/ElderHomeScreen.tsx:167` | Meds Modal (in-screen) | **OK** | "My meds today" opens read-only high-contrast modal. |
| **LNK-25** | nav | `src/screens/CircleSelectScreen.tsx:122` | `AuthScreen` (Sign Out) | **OK** | Calls `supabase.auth.signOut()` and clears current user. |
| **LNK-26** | nav | `src/screens/CircleSelectScreen.tsx:147` | `TodayScreen` | **OK** | Tapping a Care Circle card sets `activeCircle` and opens `TodayScreen`. |
| **LNK-27** | nav | `src/screens/CircleSelectScreen.tsx:179` | Create Circle form view | **OK** | Switches internal screen mode to `'create'`. |
| **LNK-28** | nav | `src/screens/CircleSelectScreen.tsx:186` | Join Circle form view | **OK** | Switches internal screen mode to `'join'`. |
| **LNK-29** | nav | `src/screens/TodayScreen.tsx:200` | `CircleSelectScreen` | **OK** | "← Circles" resets `activeCircle` and navigates back to circle selection. |
| **LNK-30** | nav | `src/screens/TodayScreen.tsx:214` | `CoverageScreen` | **OK** | "👥 Coverage" tab switches `activeTab` to `'coverage'`. |
| **LNK-31** | nav | `src/screens/TodayScreen.tsx:222` | `TimelineScreen` | **OK** | "📜 Timeline" tab switches `activeTab` to `'timeline'`. |
| **LNK-32** | nav | `src/screens/TodayScreen.tsx:351` | `CoverageScreen` | **FIXED** | Added "Caregiver Shift Coverage" in-content shortcut card on Today view. |
| **LNK-33** | nav | `src/screens/CoverageScreen.tsx:217` | `CircleSelectScreen` | **OK** | "← Circles" resets `activeCircle` and returns to circle selection. |
| **LNK-34** | nav | `src/screens/CoverageScreen.tsx:228` | `TodayScreen` | **OK** | "☀️ Today" tab switches `activeTab` to `'today'`. |
| **LNK-35** | nav | `src/screens/CoverageScreen.tsx:241` | `TimelineScreen` | **OK** | "📜 Timeline" tab switches `activeTab` to `'timeline'`. |
| **LNK-36** | nav | `src/screens/TimelineScreen.tsx:122` | `CircleSelectScreen` | **OK** | "← Circles" resets `activeCircle` and returns to circle selection. |
| **LNK-37** | nav | `src/screens/TimelineScreen.tsx:132` | `TodayScreen` | **OK** | "☀️ Today" tab switches `activeTab` to `'today'`. |
| **LNK-38** | nav | `src/screens/TimelineScreen.tsx:140` | `CoverageScreen` | **OK** | "👥 Coverage" tab switches `activeTab` to `'coverage'`. |
| **LNK-39** | nav | `src/screens/TimelineScreen.tsx:231` | `AddNoteScreen` | **OK** | "+ Add Note / Update" button opens `AddNoteScreen` inside modal. |
| **LNK-40** | nav | `src/screens/AddNoteScreen.tsx:62` | `TimelineScreen` | **OK** | "Cancel" / "✕" dismisses modal and returns to timeline. |
| **LNK-41** | auth | `src/services/careCircleService.ts:98` | `elderlycare://auth/callback` | **OK** | Sent as `emailRedirectTo` in `supabase.auth.signInWithOtp`. |
| **LNK-42** | auth | `src/lib/deepLinking.ts:44` | `auth/callback#access_token=...` | **FIXED** | Added token extractor and `supabase.auth.setSession` dispatch. |
| **LNK-43** | auth | `src/lib/deepLinking.ts:58` | `auth/callback?code=...` | **OK** | Parses PKCE auth code parameter. |
| **LNK-44** | auth | `src/screens/ElderLoginScreen.tsx:32` | `verify_elder_pin` RPC | **OK** | Verifies 4-digit PIN hash without email/password. |
| **LNK-45** | notification | `src/services/notificationService.ts:109` | `targetRoute: 'today'` | **FIXED** | Tagged medication reminder notification with `targetRoute: 'today'`. |
| **LNK-46** | notification | `src/services/notificationService.ts:162` | `targetRoute: 'today'` | **FIXED** | Tagged missed check-in alert notification with `targetRoute: 'today'`. |
| **LNK-47** | notification | `src/services/notificationService.ts:208` | `targetRoute: 'timeline'` | **FIXED** | Created `scheduleEmergencyHelpAlert` with `targetRoute: 'timeline'`. |
| **LNK-48** | notification | `src/services/notificationService.ts:258` | `targetRoute: 'coverage'` | **FIXED** | Created `scheduleShiftHandoffAlert` with `targetRoute: 'coverage'`. |
| **LNK-49** | notification | `App.tsx:97` | Notification router | **FIXED** | Added app-level notification listener routing taps to active tab. |
| **LNK-50** | template | `supabase/functions/check-in-escalation/index.ts:139` | `https://elderlycarehub.example.com/checkin?circle={id}` | **NEEDS-INPUT** | SMS check-in verification URL; requires live production web domain. |
| **LNK-51** | template | `supabase/functions/check-in-escalation/index.ts:140` | `elderlycare://today` | **FIXED** | Added `elderlycare://today` deep link fallback to Twilio SMS body. |
| **LNK-52** | template | `src/lib/deepLinking.ts:150` | `elderlycare://circle/join/{code}` | **OK** | Standardized invite deep link template. |
| **LNK-53** | template | `src/lib/deepLinking.ts:151` | `https://elderlycarehub.example.com/join/{code}` | **NEEDS-INPUT** | Invite web URL template; requires live production web domain. |
| **LNK-54** | template | `src/lib/deepLinking.ts:186` | `https://elderlycarehub.example.com/coverage` | **NEEDS-INPUT** | Shift handoff web URL; requires live production web domain. |
| **LNK-55** | external | `src/lib/deepLinking.ts:4` | `https://elderlycarehub.example.com/privacy` | **NEEDS-INPUT** | Production Privacy Policy URL required for App Store submission. |
| **LNK-56** | external | `src/lib/deepLinking.ts:5` | `https://elderlycarehub.example.com/terms` | **NEEDS-INPUT** | Production Terms of Service URL required for App Store submission. |
| **LNK-57** | external | `src/lib/deepLinking.ts:6` | `https://elderlycarehub.example.com/support` | **NEEDS-INPUT** | Production Customer Support URL required for App Store submission. |
| **LNK-58** | external | `src/lib/deepLinking.ts:7` | `https://elderlycarehub.example.com` | **NEEDS-INPUT** | Production Website / Marketing URL required for App Store submission. |
| **LNK-59** | external | `src/screens/AuthScreen.tsx:169` | `PRIVACY_POLICY` | **FIXED** | Embedded clickable Privacy Policy link in AuthScreen footer. |
| **LNK-60** | external | `src/screens/AuthScreen.tsx:177` | `TERMS_OF_SERVICE` | **FIXED** | Embedded clickable Terms of Service link in AuthScreen footer. |
| **LNK-61** | external | `src/screens/AuthScreen.tsx:185` | `SUPPORT` | **FIXED** | Embedded clickable Customer Support link in AuthScreen footer. |
| **LNK-62** | external | `src/screens/OnboardingModal.tsx:144` | `PRIVACY_POLICY` | **FIXED** | Embedded clickable Privacy Policy link in Onboarding modal. |
| **LNK-63** | external | `src/screens/OnboardingModal.tsx:152` | `SUPPORT` | **FIXED** | Embedded clickable Customer Support link in Onboarding modal. |
| **LNK-64** | external | `src/lib/supabase.ts:19` | `https://placeholder-elderlycare.supabase.co` | **NEEDS-INPUT** | Intentional client fallback preventing crash when env vars unset; replace with project URL. |
| **LNK-65** | external | `supabase/functions/check-in-escalation/index.ts:145` | `https://api.twilio.com/...` | **UNVERIFIED** | Official Twilio REST API; requires live Twilio credentials and mobile network. |
| **LNK-66** | external | `supabase/functions/check-in-escalation/index.ts:5` | `https://deno.land/std@0.177.0/http/server.ts` | **OK** | Deno standard library import. |
| **LNK-67** | external | `supabase/functions/check-in-escalation/index.ts:6` | `https://esm.sh/@supabase/supabase-js@2.49.1` | **OK** | Supabase JS client CDN import. |
| **LNK-68** | external | `README.md:106` | `http://localhost:8081` | **OK** | Development Metro bundler URL in setup documentation. |

---

## Detailed Needs-Input List

| ID | Item | Current Setting | Action Needed from User |
| :---: | :--- | :--- | :--- |
| **LNK-55** | Privacy Policy | `https://elderlycarehub.example.com/privacy` | Provide live hosted Privacy Policy URL for App Store compliance. |
| **LNK-56** | Terms of Service | `https://elderlycarehub.example.com/terms` | Provide live hosted Terms of Service URL. |
| **LNK-57** | Customer Support | `https://elderlycarehub.example.com/support` | Provide live Support / Help Center URL or email link. |
| **LNK-58** | Marketing Website | `https://elderlycarehub.example.com` | Provide production marketing / web app domain. |
| **LNK-50** | SMS Check-In Link | `https://elderlycarehub.example.com/checkin` | Provide live web check-in portal domain for SMS escalation fallback. |
| **LNK-53** | SMS/Email Invite Link | `https://elderlycarehub.example.com/join` | Provide live web join domain for care circle invite links. |
| **LNK-54** | Shift Handoff Link | `https://elderlycarehub.example.com/coverage` | Provide live web coverage domain for shift alert fallback. |
| **LNK-64** | Supabase Project URL | `https://placeholder-elderlycare.supabase.co` | Provide production Supabase project URL (`EXPO_PUBLIC_SUPABASE_URL`). |
