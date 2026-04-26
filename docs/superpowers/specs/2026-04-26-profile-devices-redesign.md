# Profile & Devices Page Redesign

## Goal
Revamp the profile page from a generic, narrow layout to a full-featured settings hub with password change, passkey management, account linking, and profile editing. Create the initial devices page with aggregated stats and charts. Remove profile photo from the navbar.

## Architecture

### Profile Page (`/profile`)
- Switch from `max-w-3xl` to `max-w-7xl`
- Remove profile photo/avatar from ProfileHeader (no image upload)
- Replace with initials-based avatar or just name display
- Settings tab gets 3 sub-tabs: Profile, Security, Linked Accounts
- Each settings section uses Better Auth's client-side API methods

### Navbar
- Remove profile photo/icon from the authenticated dropdown trigger
- Show just "Profile" text link that opens the dropdown (Profile + Saved Games + Sign out)
- Mobile sidebar already uses text links, just remove avatar section

### Devices Page (`/devices`)
- Grid of device cards with aggregated benchmark statistics
- Clicking a card navigates to `/devices/[slug]` for detailed view
- Detail page leverages existing EChartWrapper + chart components
- New API endpoints for aggregated hardware statistics

### Devices Detail Page (`/devices/[slug]`)
- Hero header with device name, type, benchmark count
- Charts: Historical FPS, FPS Distribution (boxplot), Top Games, Game count by genre/proton status
- Uses same chart components and theme as game page

## Tech Stack
- Better Auth client API (changePassword, updateUser, listAccounts, unlinkAccount, linkSocialAccount, passkey.addPasskey, passkey.deletePasskey, listPasskeys)
- ECharts (echarts-for-react) for device stats charts
- Existing chart components: EChartWrapper, HistoricalAreaChart, FpsBoxplot, DeviceDonut
- Framer Motion for animations (consistent with rest of app)
- Tailwind v4 with existing theme tokens

## Profile Settings Details

### Profile Sub-Tab
- Display name editing (Better Auth `updateUser`)
- Email display (read-only, with link to change email — future feature)
- Role and member since (read-only)

### Security Sub-Tab
- **Password Section**: 
  - If user has password: "Change Password" form with current password + new password + confirm
  - If user has no password (social-only): "Set Password" form
  - Uses Better Auth `changePassword` (with currentPassword) or `setPassword`
- **Passkey Section**:
  - List existing passkeys (name, device type, created date)
  - "Add Passkey" button (Better Auth `addPasskey`)
  - "Delete" button per passkey (Better Auth `deletePasskey`)
  - "Rename" per passkey (Better Auth `updatePasskey`)
  - Safety check: don't allow deleting last auth method

### Linked Accounts Sub-Tab
- List linked providers (Google, Discord, password)
  - Shows provider name, account ID/email, linked date
  - "Unlink" button with confirmation (Better Auth `unlinkAccount`)
  - Safety check: don't allow unlinking last auth method
- "Link Google" / "Link Discord" buttons (Better Auth `linkSocialAccount`)
- Show which providers are available vs already linked

## Devices API

### `GET /api/hardware/stats`
Returns array of all devices with aggregated stats:
```json
[
  {
    "slug": "steam-deck-oled",
    "name": "Steam Deck OLED",
    "deviceType": "handheld",
    "sortOrder": 0,
    "totalBenchmarks": 150,
    "avgFps": 45.2,
    "gameCount": 35,
    "verifiedCount": 20,
    "bestGame": { "id": "...", "title": "...", "fpsAvg": 120 }
  }
]
```

### `GET /api/hardware/:slug/stats`
Returns detailed stats for one device:
```json
{
  "slug": "steam-deck-oled",
  "name": "Steam Deck OLED",
  "deviceType": "handheld",
  "totalBenchmarks": 150,
  "avgFps": 45.2,
  "verifiedCount": 20,
  "gameCount": 35,
  "boxplot": [...],
  "historical": [...],
  "topGames": [...],
  "protonBreakdown": [...],
  "fsrBreakdown": [...]
}
```

## Component File Structure

### New Files
- `components/profile/settings-profile-tab.tsx` — Profile sub-tab
- `components/profile/settings-security-tab.tsx` — Security sub-tab (password + passkeys)
- `components/profile/settings-accounts-tab.tsx` — Linked Accounts sub-tab
- `app/devices/page.tsx` — Devices grid page (server component)
- `app/devices/page-client.tsx` — Devices grid client component
- `app/devices/[slug]/page.tsx` — Device detail page (server component)
- `app/devices/[slug]/device-detail-client.tsx` — Device detail client component
- `lib/api/hardware-stats.ts` — Hardware stats API routes

### Modified Files
- `app/profile/page.tsx` — Redesign layout, widen to max-w-7xl, add settings sub-tabs
- `components/profile/profile-header.tsx` — Remove image/avatar, show name-centric layout
- `components/navbar.tsx` — Remove profile photo/icon from dropdown trigger, keep text-only "Profile"
- `lib/routes.ts` — Add /devices route
- `lib/api/hardware.ts` — May need minor updates for new stats endpoints

## Design Patterns (from existing pages)
- **Game page** layout pattern: `max-w-7xl mx-auto` with `px-4 md:px-[10svw]` sections
- **Chart cards**: `rounded-xl border border-border bg-text/[0.03] p-4`
- **Stat cards**: Icon + label + value in `flex items-center gap-3`
- **Section headers**: `text-sm font-medium text-text/80 mb-2`
- **Tab style**: `border-b border-border` with active state `border-primary text-primary`
- **Animations**: `motion.div` with `initial={{ opacity: 0, y: 12 }}` and staggered delays

## Edge Cases & Safety
1. Password section: Users with social-only accounts (no password) see "Set Password" not "Change Password"
2. Unlinking: Prevent removing the last authentication method (must always have at least one way to log in)
3. Passkey deletion: Same safety check — don't allow removing the only auth method
4. Device stats: Handle case where no benchmarks exist for a device (show empty state)
5. Mobile responsive: All new components must work on mobile (single-column layouts)