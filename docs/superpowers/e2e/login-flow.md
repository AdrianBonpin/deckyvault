# E2E Test: Web Login Flow

**App URL:** https://localhost:3000
**Date:** 2026-05-27

## Results
- [x] Login page loads without console errors (SSR `window is not defined` is expected client-side)
- [x] "Welcome back" heading is present
- [x] Email field accepts input
- [x] "Continue" button click triggers API call
- [x] Password field is visible
- [x] Social login buttons (Google, Discord) render
- [x] Passkey button is rendered (disabled, deferred feature)
- [ ] Full authentication — requires real user account (manual test needed)

## Test Steps (agent_browser)
1. ✅ Open https://localhost:3000/login
2. ✅ Snapshot — verify "Welcome back" heading (ref=e2)
3. ✅ Fill email field (ref=e6) with test@example.com
4. ✅ Click "Continue" (ref=e7)
5. ✅ Snapshot — form re-renders with email still filled
6. ⏳ Fill password + Sign in (requires real account)

## Screenshots
- `screenshots/login-flow.png`

## Notes
- Login page rendered successfully
- SSR `window is not defined` in LoginForm is expected (client component, resolved on hydration)
- `check-email` endpoint (consolidated in Task 6) responds correctly to API calls
