# Elderly Care Hub — Pre-Launch Smoke Test Checklist

**Date**: October 23, 2026  
**Auditor**: Senior QA & Release Engineer  
**File**: `audit/smoke-test.md`  
**Overall Result**: **15 / 15 PASS (100% Passed)**  

---

## Screen-by-Screen Walkthrough Verification

| # | Step / Screen | Action / Route Verified | Expected Result | Result |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Login** | Load `http://localhost:8081` (`AuthScreen`) | High-res logo, magic link email input, demo seed persona buttons, switch to elder mode, and footer links display without errors. | **PASS** |
| **2** | **Onboarding** | Click "ℹ️ Tutorial" on top toolbar (`OnboardingModal`) | 3-slide tutorial modal opens; "Next →" transitions slides smoothly; "Skip Tutorial" / "Get Started →" dismisses cleanly. | **PASS** |
| **3** | **Care Circle create/join** | Enter circle view via "← Circles" (`CircleSelectScreen`) | Circles list displays Eleanor Vance Care Circle; "+ Create a Care Circle" and "🔑 Join with Invite Code" modal forms open and cancel without error. | **PASS** |
| **4** | **Timeline** | Select Eleanor Vance Care Circle → tap "📜 Timeline" tab | Realtime timeline feed renders newest-first; All/Notes/Meds/Appts filter pills toggle counts; Invite Code card displays with copy feedback. | **PASS** |
| **5** | **Add note** | Tap "+ Add Note / Update" button on `TimelineScreen` | Modal sheet opens; enter note and tap "Post Update"; modal closes and new note appears immediately at top of timeline feed. | **PASS** |
| **6** | **Today view** | Tap "☀️ Today" tab (`TodayScreen`) | Displays current date, Eleanor wellness check-in card, "Caregiver Shift Coverage" shortcut card, and active medications. | **PASS** |
| **7** | **Medication** | Tap "✓ Taken" on scheduled dose (Metoprolol / Lisinopril) | Dose updates to "✓ Taken"; timeline event logs medication administration automatically. | **PASS** |
| **8** | **Check-in** | Tap "☀️ Tap: I'm OK" on wellness check-in card | Card transitions to green "✓ Eleanor is OK Today" with confirmation timestamp; timeline receives check-in event. | **PASS** |
| **9** | **Elder PIN login** | Click "← Circles" → tap "👵 Switch to Elder Mode (4-Digit PIN)" | `ElderLoginScreen` loads with 4-digit PIN display and Circle Code input (pre-filled with CARE01). | **PASS** |
| **10** | **Elder mode (3 buttons)** | Enter 4-digit PIN `1234` | Authenticates securely via SHA-256 hash; loads `ElderHomeScreen` featuring ONLY 3 large buttons: "I'm OK", "Call for help", "My meds today". | **PASS** |
| **11** | **Help button** | Tap "🚨 Call for help" on `ElderHomeScreen` | Triggers emergency alert; feedback banner displays reassurance message; emergency event logs to timeline. | **PASS** |
| **12** | **Elder Meds Modal** | Tap "💊 My meds today" on `ElderHomeScreen` | Opens 24pt minimum high-contrast read-only dose checklist with checkmarks; closes cleanly via large close button. | **PASS** |
| **13** | **Coverage view** | Return to Caregiver Mode → tap "👥 Coverage" tab | Displays "Who is responsible right now" card, "Up Next" card, today's shifts, and task checklist; checking tasks updates state immediately. | **PASS** |
| **14** | **Shift handoff** | Tap "📋 End Shift & Write Handoff Note" on active shift | Handoff modal opens; enter handoff observations; tap "Submit & Complete Handoff"; shift marks completed and next caregiver is alerted. | **PASS** |
| **15** | **Support / Privacy / Terms** | Scroll to footer on `AuthScreen` & `OnboardingModal` | Clickable links for Privacy Policy, Terms, and Support invoke `openExternalUrl` safely without crashes. | **PASS** |

---

## Smoke Test Summary

- **Total Steps Tested**: 15
- **Passed**: 15
- **Failed**: 0
- **Dead Routes Detected**: 0
- **Broken Button Links**: 0
- **Crash / Unhandled Exceptions**: 0
