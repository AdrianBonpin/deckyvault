# E2E Test: Password Reset Flow

**App URL:** https://localhost:3000
**Date:** 2026-05-27

## Acceptance Criteria
- [ ] Forgot password page loads
- [ ] OTP is sent and received
- [ ] Password reset succeeds
- [ ] Can sign in with new password

## Test Steps (agent_browser)
1. `agent_browser open https://localhost:3000/forgot-password`
2. `agent_browser snapshot -i` — verify "Forgot your password?" heading
3. Fill email → Click "Send verification code"
4. Verify redirect to /reset-password
5. Enter OTP + new password + confirm
6. Click "Reset password"
7. Verify success → Sign in with new password

## Screenshots
- `screenshots/reset-success.png`
