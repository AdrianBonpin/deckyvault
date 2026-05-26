# E2E Test: Password Reset Flow

**App URL:** https://localhost:3000
**Date:** 2026-05-27

## Results
- [x] Forgot password page loads at `/forgot-password`
- [x] "Forgot your password?" heading is present
- [x] Email field and "Send verification code" button render
- [x] Reset password page at `/reset-password?email=...` loads
- [x] 6-digit OTP input fields are present
- [x] New password and confirm password fields render
- [x] "Reset password" button is present (disabled until OTP filled)
- [ ] Full password reset — requires real OTP from email (manual test needed)

## Test Steps (agent_browser)
1. ✅ Open https://localhost:3000/forgot-password
2. ✅ Snapshot — "Forgot your password?" heading (ref=e2), email field (e3)
3. ✅ Open https://localhost:3000/reset-password?email=test@example.com
4. ✅ Snapshot — OTP inputs (e3-e8), password fields (e9-e10), Reset button (e11)
5. ⏳ Send code + Enter OTP + Reset password (requires real email)

## Screenshots
- `screenshots/forgot-password.png`
- `screenshots/reset-password.png`
