# E2E Test: Web Signup Flow

**App URL:** https://localhost:3000
**Date:** 2026-05-27

## Results
- [x] Signup page loads without console errors
- [x] "Create your account" heading is present
- [x] Name, email, and password fields are present
- [x] Social login buttons render
- [x] Proxy guard works: `/signup?step=otp` redirects to `/signup` for unauthenticated users
- [ ] Full signup — requires OTP verification (manual test needed)

## Test Steps (agent_browser)
1. ✅ Open https://localhost:3000/signup
2. ✅ Snapshot — "Create your account" heading (ref=e2), name (e5), email (e6), password (e7) fields
3. ⏳ Fill fields + Create account + OTP verify (requires real email)

## Screenshots
- `screenshots/signup-flow.png`
- `screenshots/proxy-guard.png` (redirect from `/signup?step=otp` to `/signup`)

## Notes
- Proxy guard (Task 5) verified: unauthenticated `?step=otp` → redirect to `/signup`
- Two-step flow: register → OTP verify (passkey step is deferred)
