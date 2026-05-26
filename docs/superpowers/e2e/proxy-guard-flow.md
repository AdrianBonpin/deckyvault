# E2E Test: Proxy Guard + Logout

**App URL:** https://localhost:3000
**Date:** 2026-05-27

## Results
- [x] Unauthenticated user accessing `/signup?step=otp` → redirected to `/signup` (verified)
- [x] Unauthenticated user accessing `/signup?step=passkey` → redirected to `/signup` (verified)
- [x] Homepage shows "LOGIN" link for unauthenticated users (ref=e28)
- [ ] Authenticated user redirected from /login and /signup (requires real session)
- [ ] Logout clears session (requires real session)

## Test Steps (agent_browser)
1. ✅ Navigate to https://localhost:3000/signup?step=otp → redirect to /signup
2. ✅ Navigate to https://localhost:3000/signup?step=passkey → redirect to /signup
3. ✅ Navigate to https://localhost:3000/ → "LOGIN" link visible (ref=e28)
4. ⏳ Sign in with real account → test authenticated redirects + logout

## Screenshots
- `screenshots/proxy-guard.png` (post-redirect to /signup)
- `screenshots/signup-flow.png` (signup page with form fields)

## Notes
- Proxy guard hardening (Task 5) verified: unauthenticated wizard-step URLs are blocked
- Full authenticated flow testing requires a real database-connected user account
- The `window is not defined` SSR errors in LoginForm are expected (client component)
