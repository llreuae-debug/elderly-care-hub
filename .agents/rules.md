# Elderly Care Hub — Project Rules

## Product Principles
- Elder dignity first: no surveillance-style UI. Check-ins are opt-in, not forced.
- Low tech literacy: large touch targets, no passwords (magic link/PIN), voice-friendly.
- Multi-caregiver coordination is the core differentiator. Everything else is secondary.

## Tech Constraints
- Frontend: React Native (Expo managed workflow) — one codebase iOS + Android.
- Backend: Supabase (auth, realtime, push via Edge Functions).
- SMS fallback: Twilio (critical for elders without smartphones).
- No custom wearable hardware in MVP. Phone-based fall detection only.

## Code Standards
- TypeScript strict mode. No `any`.
- Every feature must have at least one integration test.
- Commit after each task. Small commits.

## Phase Discipline
- Only build what the current phase specifies.
- Do not add features, libraries, or "nice-to-haves" without explicit approval.
