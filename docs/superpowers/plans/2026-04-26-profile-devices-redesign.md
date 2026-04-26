# Profile & Devices Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the profile page into a full settings hub and create a devices page with aggregated stats and charts.

**Architecture:** Profile page expands from max-w-3xl to max-w-7xl with Settings sub-tabs (Profile, Security, Linked Accounts) powered by Better Auth client APIs. Navbar drops the avatar/icon. New devices page uses a card grid with drill-down detail pages and ECharts-powered statistics. New Elysia API endpoints provide aggregated hardware stats.

**Tech Stack:** Next.js 16, Better Auth (client APIs: changePassword, updateUser, listAccounts, unlinkAccount, linkSocialAccount, passkey.*), Elysia, Drizzle ORM, ECharts (echarts-for-react), Framer Motion, Tailwind v4

---

## File Structure

### New Files
- `components/profile/settings-profile-tab.tsx` — Profile name/email editing
- `components/profile/settings-security-tab.tsx` — Password + Passkey management
- `components/profile/settings-accounts-tab.tsx` — Account linking/unlinking
- `app/devices/page.tsx` — Devices grid (server component, fetches data)
- `app/devices/page-client.tsx` — Devices grid client (cards with stats)
- `app/devices/[slug]/page.tsx` — Device detail (server component)
- `app/devices/[slug]/device-detail-client.tsx` — Device detail with charts
- `lib/api/hardware-stats.ts` — Aggregated hardware stats endpoints

### Modified Files
- `app/profile/page.tsx` — Wider layout, sub-tab Settings, no image avatar
- `components/profile/profile-header.tsx` — Remove image/avatar, name-centric
- `components/navbar.tsx` — Remove avatar/icon, text-only "Profile" trigger
- `lib/routes.ts` — Add /devices route
- `lib/api/index.ts` — Export hardware-stats routes
- `app/api/[[...slugs]]/route.ts` — Import hardware stats routes

---

### Task 1: Navbar — Remove Profile Photo/Icon

**Files:**
- Modify: `components/navbar.tsx`

**Context:** The navbar currently shows the user's image (or a fallback User icon) alongside "Profile" text in a dropdown trigger. Per the spec, we remove the image/icon entirely and show only the text "Profile". The dropdown menu logic stays (Profile, Saved Games, Sign out), just the trigger loses the avatar.

- [ ] **Step 1: Remove avatar from desktop dropdown trigger**

In `components/navbar.tsx`, find the desktop `<button>` that triggers the user menu. Replace the avatar+text trigger:

```tsx
// BEFORE: Has image/icon + text
<button
  onClick={() => setUserMenuOpen(!userMenuOpen)}
  className='flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors uppercase cursor-pointer'
>
  {session.user.image ? (
    <Image
      src={session.user.image}
      alt=''
      width={20}
      height={20}
      unoptimized
      className='h-5 w-5 rounded-full'
    />
  ) : (
    <div className='h-5 w-5 rounded-full bg-secondary flex items-center justify-center'>
      <User className='h-3 w-3 text-text' />
    </div>
  )}
  <span>Profile</span>
</button>
```

Replace with text-only trigger:

```tsx
<button
  onClick={() => setUserMenuOpen(!userMenuOpen)}
  className='text-sm font-medium hover:text-primary transition-colors uppercase cursor-pointer'
>
  Profile
</button>
```

- [ ] **Step 2: Remove avatar from mobile sidebar auth section**

In the mobile sidebar section, find where auth routes render user-specific links. Remove the image/icon display next to each auth route link, but keep the lucide icons (User, Bookmark) from `authRoutes` — those are menu item icons, not avatars. The mobile sidebar currently has no explicit avatar rendering either, so this step is mostly a verification that no image rendering exists in the mobile section. If it does, remove it.

- [ ] **Step 3: Remove the unused Image and User imports if no longer needed**

Check if `Image` from `next/image` and `User` from `lucide-react` are still used elsewhere in the file. If `Image` is only used for the avatar, remove the import. Keep `User` if it's used in the auth routes icon mapping.

- [ ] **Step 4: Verify the navbar renders correctly**

Run `bun run build 2>&1 | tail -20` and check for no type errors. Manually verify the dropdown still works by checking the code logic is intact.

- [ ] **Step 5: Commit**

```bash
git add components/navbar.tsx
git commit -m "refactor: remove profile avatar from navbar dropdown trigger"
```

---

### Task 2: Profile Page Layout + ProfileHeader Redesign

**Files:**
- Modify: `app/profile/page.tsx`
- Modify: `components/profile/profile-header.tsx`

**Context:** The profile page needs to widen from `max-w-3xl` to `max-w-7xl` with the game-page-style section padding (`px-4 md:px-[10svw]`). The ProfileHeader must remove the avatar/image display and switch to a name-centric layout with role badge and member-since info. The overall styling should match the game page and search page — card-based sections with `rounded-xl border border-border bg-text/[0.03]` styling.

- [ ] **Step 1: Update ProfileHeader to remove avatar**

In `components/profile/profile-header.tsx`, refactor the component to:
- Remove the `image` prop entirely from the interface
- Remove the avatar/image section (the `<div className="relative shrink-0">` block with Image/User icon)
- Make the layout a simple left-aligned block:
  - Name (h1) + role badge inline
  - "Member since {date}" below
  - Email address if provided (read-only, subtle text)

Updated component:

```tsx
"use client"

import { Shield, Crown, CheckCircle, Mail } from "lucide-react"
import { motion } from "motion/react"

interface ProfileHeaderProps {
  name: string
  email?: string
  role: string | null
  verified: boolean
  createdAt: string
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  admin: { label: "Admin", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Crown },
  contributor: { label: "Contributor", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
  user: { label: "Member", color: "bg-text/10 text-text/60 border-text/20", icon: Shield },
}

export function ProfileHeader({ name, email, role, verified, createdAt }: ProfileHeaderProps) {
  const config = roleConfig[role || "user"] || roleConfig.user
  const RoleIcon = config.icon

  const joinDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
          <RoleIcon className="h-3 w-3" />
          {config.label}
        </span>
        {verified && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-text/50">
        <span>Member since {joinDate}</span>
        {email && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {email}
            </span>
          </>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Widen the profile page and update ProfileHeader call sites**

In `app/profile/page.tsx`, make these changes:

1. Change `max-w-3xl` to `max-w-7xl` in the main container div
2. Wrap the content in the game-page-style section pattern with `px-4 md:px-[10svw]` padding
3. Update the `ProfileHeader` call to remove the `image` prop and add `email` prop
4. Add `motion.div` section wrappers with staggered animations (matching the game page pattern)

The page layout should use section wrappers like the game page:

```tsx
// Top-level wrapper
<div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8 space-y-8">
  {/* Profile header section */}
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <ProfileHeader ... />
  </motion.div>

  {/* Stats section */}
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
    <StatsRow ... />
  </motion.div>

  {/* Tabs + content section */}
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
    {/* tabs and content */}
  </motion.div>
</div>
```

5. Update the `ProfileHeader` invocation — remove `image`, add `email`:

```tsx
<ProfileHeader
  name={profile.name}
  email={profile.email}
  role={profile.role}
  verified={profile.verified}
  createdAt={profile.createdAt}
/>
```

- [ ] **Step 3: Update public profile page header**

In `app/profile/[id]/profile-page-client.tsx`, the `ProfileHeader` call also passes `image`. Remove the `image` prop. The public profile doesn't show email, so this is a simple prop removal.

- [ ] **Step 4: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx app/profile/[id]/profile-page-client.tsx components/profile/profile-header.tsx
git commit -m "refactor: widen profile to max-w-7xl and remove avatar from header"
```

---

### Task 3: Settings — Profile Sub-Tab

**Files:**
- Create: `components/profile/settings-profile-tab.tsx`
- Modify: `app/profile/page.tsx` (wire up the sub-tab later in Task 6)

**Context:** This component renders the Profile settings sub-tab inside the Settings tab. It allows the user to change their display name using Better Auth's `updateUser` API. Email is shown read-only (email change is a separate, more complex flow requiring verification). Role and member-since are also read-only.

- [ ] **Step 1: Create the settings-profile-tab component**

Create `components/profile/settings-profile-tab.tsx`:

```tsx
"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Loader2, Save, User } from "lucide-react"
import { motion } from "motion/react"

interface SettingsProfileTabProps {
  name: string
  email: string
  role: string | null
  createdAt: string
}

export function SettingsProfileTab({ name, email, role, createdAt }: SettingsProfileTabProps) {
  const [displayName, setDisplayName] = useState(name)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty" })
      return
    }

    setIsSaving(true)
    setMessage(null)

    const { error } = await authClient.updateUser({
      name: displayName.trim(),
    })

    if (error) {
      setMessage({ type: "error", text: error.message || "Failed to update name" })
    } else {
      setMessage({ type: "success", text: "Name updated successfully" })
    }
    setIsSaving(false)
  }

  const joinDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Display Name */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Display Name</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
              placeholder="Your display name"
            />
          </div>
          <button
            onClick={handleSaveName}
            disabled={isSaving || displayName === name}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Email</h3>
        <p className="text-sm text-text/80">{email}</p>
        <p className="text-xs text-text/40 mt-1">Email changes require verification. Contact support if needed.</p>
      </div>

      {/* Account Info (read-only) */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Account Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text/50">Role</span>
            <p className="text-text/80 capitalize">{role || "user"}</p>
          </div>
          <div>
            <span className="text-text/50">Member since</span>
            <p className="text-text/80">{joinDate}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run `bun run build 2>&1 | tail -20` — it won't be imported yet, but verify no syntax/type errors in the file itself by checking the build output.

- [ ] **Step 3: Commit**

```bash
git add components/profile/settings-profile-tab.tsx
git commit -m "feat: add settings profile sub-tab with name editing"
```

---

### Task 4: Settings — Security Sub-Tab (Password + Passkeys)

**Files:**
- Create: `components/profile/settings-security-tab.tsx`

**Context:** This component has two sections: Password management (change or set password) and Passkey management (list, add, rename, delete). Better Auth provides `changePassword`, `setPassword`, `passkey.addPasskey`, and the passkey list atom. We need to check if the user has a password (by checking if their account has a password credential) — we can infer this from whether `password` is set on their account.

We'll add a new API endpoint to check auth methods for safety (prevent removing the last auth method).

- [ ] **Step 1: Add a /user/me/auth-methods API endpoint**

In `lib/api/user.ts`, add a new route that returns the user's authentication methods and their counts:

```ts
.get(
  "/me/auth-methods",
  async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      set.status = 401
      return { error: "Unauthorized" }
    }

    // Count accounts by provider
    const accounts = await db
      .select({ providerId: account.providerId, id: account.id })
      .from(account)
      .where(eq(account.userId, session.user.id))

    // Count passkeys
    const [passkeyRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(passkey)
      .where(eq(passkey.userId, session.user.id))

    // Check if user has a password (from accounts where providerId is "credential")
    const hasPassword = accounts.some((a) => a.providerId === "credential")

    // OAuth providers
    const oauthProviders = accounts
      .filter((a) => a.providerId !== "credential")
      .map((a) => ({
        providerId: a.providerId,
        id: a.id,
      }))

    // Total auth methods = passwords + passkeys + oauth accounts
    const totalAuthMethods =
      (hasPassword ? 1 : 0) + (passkeyRow?.count ?? 0) + oauthProviders.length

    return {
      hasPassword,
      passkeyCount: passkeyRow?.count ?? 0,
      oauthProviders,
      totalAuthMethods,
    }
  },
)
```

This requires the `account` and `passkey` imports (already in schema), and `eq` + `sql` from drizzle (already imported).

- [ ] **Step 2: Create the settings-security-tab component**

Create `components/profile/settings-security-tab.tsx` with two sections:

**Password Section:**
- Fetch `/api/user/me/auth-methods` to determine if user has a password
- If user has password: show "Change Password" form (current + new + confirm)
- If user has no password: show "Set Password" form (new + confirm only)
- Uses `authClient.changePassword({ newPassword, currentPassword })` or `authClient.setPassword({ newPassword })`
- Success/error feedback

**Passkey Section:**
- List passkeys using Better Auth's client (`useStore` with `authClient.$listPasskeys` — we'll use `fetch("/api/auth/passkey/list-user-passkeys")` for simplicity)
- "Add Passkey" button using `authClient.passkey.addPasskey()`
- Each passkey shows: name (or "Unnamed"), device type, created date
- Delete button per passkey — calls `fetch("/api/auth/passkey/delete-passkey", { method: "POST", body: JSON.stringify({ id }) })`
- Rename button per passkey — calls `fetch("/api/auth/passkey/update-passkey", { method: "POST", body: JSON.stringify({ id, name }) })`
- Safety check: disable delete if `totalAuthMethods <= 1`

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { authClient } from "@/lib/auth-client"
import { Loader2, Key, Fingerprint, Plus, Trash2, Pencil, Check, X, Shield } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface AuthMethods {
  hasPassword: boolean
  passkeyCount: number
  oauthProviders: { providerId: string; id: string }[]
  totalAuthMethods: number
}

interface PasskeyInfo {
  id: string
  name: string | null
  deviceType: string
  createdAt: string | null
}

export function SettingsSecurityTab() {
  // ── Auth methods state ────────────────────────────────────────
  const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null)
  const [loadingMethods, setLoadingMethods] = useState(true)

  const fetchAuthMethods = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me/auth-methods")
      if (res.ok) {
        const data = await res.json()
        setAuthMethods(data)
      }
    } catch (err) {
      console.error("Failed to fetch auth methods:", err)
    } finally {
      setLoadingMethods(false)
    }
  }, [])

  useEffect(() => {
    fetchAuthMethods()
  }, [fetchAuthMethods])

  // ── Password state ────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleChangePassword = async () => {
    setPasswordLoading(true)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" })
      setPasswordLoading(false)
      return
    }

    if (authMethods?.hasPassword) {
      // Change password
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      })
      if (error) {
        setPasswordMessage({ type: "error", text: error.message || "Failed to change password" })
      } else {
        setPasswordMessage({ type: "success", text: "Password changed successfully" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } else {
      // Set password
      const { error } = await authClient.setPassword({
        newPassword,
      })
      if (error) {
        setPasswordMessage({ type: "error", text: error.message || "Failed to set password" })
      } else {
        setPasswordMessage({ type: "success", text: "Password set successfully" })
        setNewPassword("")
        setConfirmPassword("")
        await fetchAuthMethods()
      }
    }
    setPasswordLoading(false)
  }

  // ── Passkey state ─────────────────────────────────────────────
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(true)
  const [addingPasskey, setAddingPasskey] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [passkeyMessage, setPasskeyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/passkey/list-user-passkeys", {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setPasskeys(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Failed to fetch passkeys:", err)
    } finally {
      setPasskeysLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPasskeys()
  }, [fetchPasskeys])

  const handleAddPasskey = async () => {
    setAddingPasskey(true)
    setPasskeyMessage(null)
    const { error } = await authClient.passkey.addPasskey()
    if (error) {
      setPasskeyMessage({ type: "error", text: error.message || "Failed to add passkey" })
    } else {
      setPasskeyMessage({ type: "success", text: "Passkey added successfully" })
      await fetchPasskeys()
      await fetchAuthMethods()
    }
    setAddingPasskey(false)
  }

  const handleDeletePasskey = async (id: string) => {
    if (authMethods && authMethods.totalAuthMethods <= 1) return
    setPasskeyMessage(null)
    try {
      const res = await fetch("/api/auth/passkey/delete-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setPasskeyMessage({ type: "success", text: "Passkey removed" })
        await fetchPasskeys()
        await fetchAuthMethods()
      } else {
        const data = await res.json()
        setPasskeyMessage({ type: "error", text: data.message || "Failed to remove passkey" })
      }
    } catch {
      setPasskeyMessage({ type: "error", text: "Failed to remove passkey" })
    }
  }

  const handleRenamePasskey = async (id: string) => {
    setPasskeyMessage(null)
    try {
      const res = await fetch("/api/auth/passkey/update-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, name: renameValue }),
      })
      if (res.ok) {
        setPasskeyMessage({ type: "success", text: "Passkey renamed" })
        setRenamingId(null)
        await fetchPasskeys()
      } else {
        const data = await res.json()
        setPasskeyMessage({ type: "error", text: data.message || "Failed to rename passkey" })
      }
    } catch {
      setPasskeyMessage({ type: "error", text: "Failed to rename passkey" })
    }
  }

  const isOnlyAuthMethod = authMethods ? authMethods.totalAuthMethods <= 1 : true

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── Warning if only one auth method ────────────────── */}
      {isOnlyAuthMethod && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <Shield className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-400 font-medium">Single authentication method</p>
            <p className="text-xs text-text/50 mt-1">
              You only have one way to sign in. Consider adding a passkey or linking a social account to avoid losing access.
            </p>
          </div>
        </div>
      )}

      {/* ── Password Section ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          {authMethods?.hasPassword ? "Change Password" : "Set Password"}
        </h3>

        {loadingMethods ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-text/40" />
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            {authMethods?.hasPassword && (
              <div>
                <label className="text-xs text-text/50 uppercase tracking-wider">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-text/50 uppercase tracking-wider">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-text/50 uppercase tracking-wider">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors mt-1"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              {authMethods?.hasPassword ? "Change Password" : "Set Password"}
            </button>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {passwordMessage.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Passkeys Section ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Passkeys
          </h3>
          <button
            onClick={handleAddPasskey}
            disabled={addingPasskey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
          >
            {addingPasskey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add Passkey
          </button>
        </div>

        {passkeyMessage && (
          <p className={`text-sm mb-3 ${passkeyMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {passkeyMessage.text}
          </p>
        )}

        {passkeysLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-text/40" />
          </div>
        ) : passkeys.length === 0 ? (
          <div className="text-center py-8 text-text/40">
            <Fingerprint className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No passkeys registered</p>
            <p className="text-xs mt-1">Add a passkey for passwordless sign-in</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {passkeys.map((pk) => (
                <motion.div
                  key={pk.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Fingerprint className="h-4 w-4 text-text/40 shrink-0" />
                    <div className="min-w-0">
                      {renamingId === pk.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="px-2 py-0.5 rounded bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenamePasskey(pk.id)
                              if (e.key === "Escape") setRenamingId(null)
                            }}
                          />
                          <button onClick={() => handleRenamePasskey(pk.id)} className="text-green-400 hover:text-green-300 cursor-pointer">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setRenamingId(null)} className="text-red-400 hover:text-red-300 cursor-pointer">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium truncate">{pk.name || "Unnamed passkey"}</p>
                      )}
                      <p className="text-xs text-text/40">
                        {pk.deviceType}
                        {pk.createdAt && ` · ${new Date(pk.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {renamingId !== pk.id && (
                      <button
                        onClick={() => { setRenamingId(pk.id); setRenameValue(pk.name || "") }}
                        className="p-1.5 rounded-md hover:bg-text/5 text-text/40 hover:text-text transition-colors cursor-pointer"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePasskey(pk.id)}
                      disabled={isOnlyAuthMethod}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-text/40 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={isOnlyAuthMethod ? "Cannot remove your only authentication method" : "Remove passkey"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 3: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/api/user.ts components/profile/settings-security-tab.tsx
git commit -m "feat: add security settings tab with password and passkey management"
```

---

### Task 5: Settings — Linked Accounts Sub-Tab

**Files:**
- Create: `components/profile/settings-accounts-tab.tsx`

**Context:** This component handles linking and unlinking social accounts (Google, Discord) and showing the password status. It uses Better Auth's `listUserAccounts` (via `GET /api/auth/list-accounts`) and `unlinkAccount` (`POST /api/auth/unlink-account`). For linking, it uses `authClient.linkSocialAccount` which redirects to OAuth.

- [ ] **Step 1: Create the settings-accounts-tab component**

Create `components/profile/settings-accounts-tab.tsx`:

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Link as LinkIcon, Unlink, Shield } from "lucide-react"
import { motion } from "motion/react"
import { FaGoogle, FaDiscord } from "react-icons/fa"

interface LinkedAccount {
  id: string
  providerId: string
  accountId: string
  createdAt: string
}

interface AuthMethods {
  hasPassword: boolean
  passkeyCount: number
  oauthProviders: { providerId: string; id: string }[]
  totalAuthMethods: number
}

const providerConfig: Record<string, { name: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  google: { name: "Google", icon: FaGoogle, color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
  discord: { name: "Discord", icon: FaDiscord, color: "text-indigo-400", bgColor: "bg-indigo-500/10 border-indigo-500/20" },
  credential: { name: "Password", icon: null, color: "text-text/60", bgColor: "bg-text/5 border-border" },
}

export function SettingsAccountsTab() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [accountsRes, methodsRes] = await Promise.all([
        fetch("/api/auth/list-accounts", { credentials: "include" }),
        fetch("/api/user/me/auth-methods"),
      ])

      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(Array.isArray(data) ? data : [])
      }

      if (methodsRes.ok) {
        const data = await methodsRes.json()
        setAuthMethods(data)
      }
    } catch (err) {
      console.error("Failed to fetch account data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleLink = async (provider: "google" | "discord") => {
    try {
      const { data, error } = await authClient.linkSocialAccount({
        provider,
        callbackURL: window.location.href,
      })

      if (error) {
        setMessage({ type: "error", text: error.message || "Failed to link account" })
        return
      }

      // If the API returns a URL, redirect to it
      if (data && (data as { url?: string }).url) {
        window.location.href = (data as { url: string }).url
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to initiate account linking" })
    }
  }

  const handleUnlink = async (providerId: string) => {
    if (authMethods && authMethods.totalAuthMethods <= 1) return

    setUnlinking(providerId)
    setMessage(null)

    try {
      const res = await fetch("/api/auth/unlink-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ providerId }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: `${providerConfig[providerId]?.name || providerId} account unlinked` })
        await fetchData()
      } else {
        const data = await res.json()
        setMessage({ type: "error", text: data.message || "Failed to unlink account" })
      }
    } catch {
      setMessage({ type: "error", text: "Failed to unlink account" })
    } finally {
      setUnlinking(null)
    }
  }

  const linkedProviders = new Set(accounts.map((a) => a.providerId))
  const availableProviders = ["google", "discord"].filter((p) => !linkedProviders.has(p))
  const isOnlyAuthMethod = authMethods ? authMethods.totalAuthMethods <= 1 : true

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── Warning if only one auth method ────────────────── */}
      {isOnlyAuthMethod && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <Shield className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-400 font-medium">Single authentication method</p>
            <p className="text-xs text-text/50 mt-1">
              You only have one way to sign in. Consider linking a social account or adding a passkey.
            </p>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      {/* ── Linked Accounts ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4 flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Linked Accounts
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-text/40" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Password status */}
            {authMethods && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-text/10 flex items-center justify-center text-text/40 text-sm font-bold">
                    ●
                  </div>
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-text/40">
                      {authMethods.hasPassword ? "Configured" : "Not set"}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${authMethods.hasPassword ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-text/10 text-text/40 border border-border"}`}>
                  {authMethods.hasPassword ? "Active" : "Inactive"}
                </span>
              </div>
            )}

            {/* OAuth accounts */}
            {accounts.map((account) => {
              const config = providerConfig[account.providerId] || {
                name: account.providerId,
                icon: null,
                color: "text-text/60",
                bgColor: "bg-text/5 border-border",
              }
              const canUnlink = !isOnlyAuthMethod

              return (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.bgColor} border`}>
                      {config.icon ? <config.icon className={`h-4 w-4 ${config.color}`} /> : <LinkIcon className={`h-4 w-4 ${config.color}`} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{config.name}</p>
                      <p className="text-xs text-text/40">Linked</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlink(account.providerId)}
                    disabled={!canUnlink || unlinking === account.providerId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {unlinking === account.providerId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    Unlink
                  </button>
                </div>
              )
            })}

            {/* Passkeys count */}
            {authMethods && authMethods.passkeyCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-text/10 flex items-center justify-center text-text/40">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Passkeys</p>
                    <p className="text-xs text-text/40">{authMethods.passkeyCount} registered</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Active
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Link New Account ────────────────────────────────── */}
      {availableProviders.length > 0 && (
        <div className="rounded-xl border border-border bg-text/[0.03] p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Link a Social Account</h3>
          <div className="flex flex-wrap gap-3">
            {availableProviders.map((provider) => {
              const config = providerConfig[provider]
              if (!config) return null
              return (
                <button
                  key={provider}
                  onClick={() => handleLink(provider as "google" | "discord")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${config.bgColor} ${config.color} text-sm font-medium hover:opacity-80 transition-opacity cursor-pointer`}
                >
                  {config.icon && <config.icon className="h-4 w-4" />}
                  Link {config.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
```

Note: This requires `react-icons/fa` (already used in the project for `FaSteam` and `FaDiscord`).

- [ ] **Step 2: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/profile/settings-accounts-tab.tsx
git commit -m "feat: add linked accounts settings tab with link/unlink"
```

---

### Task 6: Profile Page — Wire Up Settings Sub-Tabs

**Files:**
- Modify: `app/profile/page.tsx`

**Context:** Now we wire the three settings sub-tab components into the profile page. The Settings tab formerly showed a placeholder. It now shows three inner sub-tabs: Profile, Security, Linked Accounts. The page state needs a `SettingsTab` type to track which sub-tab is active.

- [ ] **Step 1: Update profile page types and imports**

In `app/profile/page.tsx`, add imports for the three new settings components and update the `Tab` type:

```tsx
import { SettingsProfileTab } from "@/components/profile/settings-profile-tab"
import { SettingsSecurityTab } from "@/components/profile/settings-security-tab"
import { SettingsAccountsTab } from "@/components/profile/settings-accounts-tab"

type Tab = "overview" | "saved" | "settings"
type SettingsTab = "profile" | "security" | "accounts"
```

- [ ] **Step 2: Add settingsSubTab state**

Add `const [settingsSubTab, setSettingsSubTab] = useState<SettingsTab>("profile")` to the component.

- [ ] **Step 3: Replace the Settings tab placeholder content**

Replace the settings tab content (the `<div className="text-center py-12 text-text/40">` block) with the actual sub-tabs:

```tsx
{activeTab === "settings" && (
  <div className="space-y-4">
    {/* Settings sub-tabs */}
    <div className="flex gap-1 border-b border-border">
      {([
        { id: "profile" as SettingsTab, label: "Profile" },
        { id: "security" as SettingsTab, label: "Security" },
        { id: "accounts" as SettingsTab, label: "Linked Accounts" },
      ]).map((subTab) => (
        <button
          key={subTab.id}
          onClick={() => setSettingsSubTab(subTab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            settingsSubTab === subTab.id
              ? "border-primary text-primary"
              : "border-transparent text-text/50 hover:text-text/70"
          }`}
        >
          {subTab.label}
        </button>
      ))}
    </div>

    {/* Settings sub-tab content */}
    {settingsSubTab === "profile" && (
      <SettingsProfileTab
        name={profile.name}
        email={profile.email}
        role={profile.role}
        createdAt={profile.createdAt}
      />
    )}
    {settingsSubTab === "security" && <SettingsSecurityTab />}
    {settingsSubTab === "accounts" && <SettingsAccountsTab />}
  </div>
)}
```

- [ ] **Step 4: Update the `Overview` tab icon**

The current tabs array uses `Settings` icon for both Overview and Settings tabs. Fix the icon mapping:

```tsx
const tabs: { id: Tab; label: string; icon: typeof Bookmark }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "saved", label: "Saved Games", icon: Bookmark },
  { id: "settings", label: "Settings", icon: Settings },
]
```

Make sure `TrendingUp` is imported from lucide-react (it's already imported via StatsRow).

- [ ] **Step 5: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: wire up settings sub-tabs in profile page"
```

---

### Task 7: Hardware Stats API Endpoints

**Files:**
- Create: `lib/api/hardware-stats.ts`
- Modify: `lib/api/index.ts`
- Modify: `app/api/[[...slugs]]/route.ts`

**Context:** Create two new API endpoints:
1. `GET /api/hardware/stats` — Returns all devices with aggregated benchmark data
2. `GET /api/hardware/:slug/stats` — Returns detailed stats for a single device (similar structure to game-stats)

These endpoints query `performanceEntries` joined with `games`, `gameVersions`, and `hardware` tables.

- [ ] **Step 1: Create the hardware-stats API file**

Create `lib/api/hardware-stats.ts`:

```ts
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  hardware,
  performanceEntries,
  gameVersions,
  games,
} from "@/lib/db/schema"
import { eq, and, sql, desc } from "drizzle-orm"

export const hardwareStatsRoutes = new Elysia({ prefix: "/hardware" })
  // ── All devices with aggregated stats ──────────────────────
  .get(
    "/stats",
    async () => {
      // Get all hardware devices
      const devices = await db
        .select({
          slug: hardware.slug,
          name: hardware.name,
          deviceType: hardware.deviceType,
          sortOrder: hardware.sortOrder,
        })
        .from(hardware)
        .orderBy(hardware.sortOrder)

      // Get aggregated stats per device
      const statsPerDevice = await db
        .select({
          hardwareSlug: performanceEntries.hardwareSlug,
          totalBenchmarks: sql<number>`count(*)::int`,
          avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
          verifiedCount: sql<number>`count(*) filter (where ${performanceEntries.verifiedAt} is not null)::int`,
          gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .where(eq(performanceEntries.isRemoved, false))
        .groupBy(performanceEntries.hardwareSlug)

      const statsMap = new Map(statsPerDevice.map((s) => [s.hardwareSlug, s]))

      // Best game per device
      const bestGames = await db
        .select({
          hardwareSlug: performanceEntries.hardwareSlug,
          gameId: games.id,
          gameTitle: games.title,
          gameHeaderImage: games.headerImage,
          fpsAvg: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(eq(performanceEntries.isRemoved, false))
        .groupBy(performanceEntries.hardwareSlug, games.id, games.title, games.headerImage)
        .orderBy(desc(sql`avg(${performanceEntries.fpsAvg})`))

      // For each device, pick the best game
      const bestGameMap = new Map<string, { id: string; title: string; headerImage: string | null; fpsAvg: number }>()
      for (const bg of bestGames) {
        if (!bestGameMap.has(bg.hardwareSlug)) {
          bestGameMap.set(bg.hardwareSlug, {
            id: bg.gameId,
            title: bg.gameTitle,
            headerImage: bg.gameHeaderImage,
            fpsAvg: Number(bg.fpsAvg),
          })
        }
      }

      return devices.map((device) => {
        const stats = statsMap.get(device.slug)
        const bestGame = bestGameMap.get(device.slug)
        return {
          slug: device.slug,
          name: device.name,
          deviceType: device.deviceType,
          sortOrder: device.sortOrder,
          totalBenchmarks: stats?.totalBenchmarks ?? 0,
          avgFps: stats?.avgFps ? Number(stats.avgFps) : null,
          gameCount: stats?.gameCount ?? 0,
          verifiedCount: stats?.verifiedCount ?? 0,
          bestGame: bestGame ?? null,
        }
      })
    },
  )
  // ── Single device detailed stats ───────────────────────────
  .get(
    "/:slug/stats",
    async ({ params, set }) => {
      const { slug } = params

      // Verify hardware exists
      const [device] = await db
        .select({
          slug: hardware.slug,
          name: hardware.name,
          deviceType: hardware.deviceType,
        })
        .from(hardware)
        .where(eq(hardware.slug, slug))
        .limit(1)

      if (!device) {
        set.status = 404
        return { error: "Device not found" }
      }

      // All entries for this device
      const entries = await db
        .select({
          id: performanceEntries.id,
          gameId: games.id,
          gameTitle: games.title,
          gameHeaderImage: games.headerImage,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          fsrVersion: performanceEntries.fsrVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          upvotes: performanceEntries.upvotes,
          downvotes: performanceEntries.downvotes,
          verifiedAt: performanceEntries.verifiedAt,
          createdAt: performanceEntries.createdAt,
          genres: games.genres,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(
          and(
            eq(performanceEntries.hardwareSlug, slug),
            eq(performanceEntries.isRemoved, false),
          )
        )

      if (entries.length === 0) {
        return {
          ...device,
          totalBenchmarks: 0,
          avgFps: null,
          verifiedCount: 0,
          gameCount: 0,
          boxplot: [],
          historical: [],
          topGames: [],
          genreBreakdown: [],
          protonBreakdown: [],
          fsrBreakdown: [],
        }
      }

      const totalBenchmarks = entries.length
      const avgFps = Math.round(
        (entries.reduce((s, e) => s + (e.fpsAvg ?? 0), 0) / totalBenchmarks) * 10
      ) / 10
      const verifiedCount = entries.filter((e) => e.verifiedAt !== null).length

      // Unique game count
      const gameIds = new Set(entries.map((e) => e.gameId))
      const gameCount = gameIds.size

      // ── Boxplot: FPS distribution per game ───────────────
      const gameFpsMap = new Map<string, { title: string; values: number[] }>()
      for (const e of entries) {
        if (!gameFpsMap.has(e.gameId)) {
          gameFpsMap.set(e.gameId, { title: e.gameTitle, values: [] })
        }
        gameFpsMap.get(e.gameId)!.values.push(e.fpsAvg ?? 0)
      }

      // Top 10 games by benchmark count for boxplot
      const topGameEntries = [...gameFpsMap.entries()]
        .sort((a, b) => b[1].values.length - a[1].values.length)
        .slice(0, 10)

      const boxplot = topGameEntries.map(([gameId, { title, values }]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const n = sorted.length
        return {
          gameId,
          gameTitle: title,
          min: sorted[0],
          q1: sorted[Math.floor(n * 0.25)] ?? sorted[0],
          median: sorted[Math.floor(n * 0.5)] ?? sorted[0],
          q3: sorted[Math.floor(n * 0.75)] ?? sorted[n - 1],
          max: sorted[n - 1],
          count: n,
        }
      })

      // ── Historical: avg FPS per month ───────────────────
      const monthMap = new Map<string, { sum: number; count: number }>()
      for (const e of entries) {
        const month = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`
        if (!monthMap.has(month)) monthMap.set(month, { sum: 0, count: 0 })
        const m = monthMap.get(month)!
        m.sum += e.fpsAvg ?? 0
        m.count++
      }

      const historical = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, { sum, count }]) => ({
          period,
          avgFps: Math.round((sum / count) * 10) / 10,
          count,
        }))

      // ── Top Games by avg FPS ────────────────────────────
      const topGames = [...gameFpsMap.entries()]
        .map(([gameId, { title, values }]) => ({
          gameId,
          gameTitle: title,
          headerImage: entries.find((e) => e.gameId === gameId)?.gameHeaderImage ?? null,
          avgFps: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
          benchmarkCount: values.length,
        }))
        .sort((a, b) => b.avgFps - a.avgFps)
        .slice(0, 20)

      // ── Genre breakdown ─────────────────────────────────
      const genreMap = new Map<string, number>()
      for (const e of entries) {
        if (e.genres && Array.isArray(e.genres)) {
          for (const g of e.genres) {
            genreMap.set(g, (genreMap.get(g) || 0) + 1)
          }
        }
      }
      const genreBreakdown = [...genreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([genre, count]) => ({ genre, count }))

      // ── Proton breakdown ────────────────────────────────
      const protonMap = new Map<string, number>()
      for (const e of entries) {
        if (e.protonVersion) {
          protonMap.set(e.protonVersion, (protonMap.get(e.protonVersion) || 0) + 1)
        }
      }
      const protonBreakdown = [...protonMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([version, count]) => ({ version, count }))

      // ── FSR breakdown ───────────────────────────────────
      const fsrMap = new Map<string, { count: number; avgFps: number }>()
      for (const e of entries) {
        const key = e.fsrVersion ?? "none"
        if (!fsrMap.has(key)) fsrMap.set(key, { count: 0, avgFps: 0 })
        const f = fsrMap.get(key)!
        f.count++
        f.avgFps += e.fpsAvg ?? 0
      }
      const fsrBreakdown = [...fsrMap.entries()].map(([version, data]) => ({
        version,
        count: data.count,
        avgFps: Math.round((data.avgFps / data.count) * 10) / 10,
      }))

      return {
        ...device,
        totalBenchmarks,
        avgFps,
        verifiedCount,
        gameCount,
        boxplot,
        historical,
        topGames,
        genreBreakdown,
        protonBreakdown,
        fsrBreakdown,
      }
    },
    {
      params: t.Object({ slug: t.String() }),
    },
  )
```

- [ ] **Step 2: Export the new routes**

Add the export to `lib/api/index.ts`:

```ts
export { hardwareStatsRoutes } from "./hardware-stats"
```

- [ ] **Step 3: Mount the routes in the API entry point**

In `app/api/[[...slugs]]/route.ts`, add the import and `.use(hardwareStatsRoutes)`:

```ts
import { hardwareStatsRoutes } from "@/lib/api"

// In the app chain, add after .use(hardwareRoutes):
.use(hardwareStatsRoutes)
```

- [ ] **Step 4: Verify API compiles**

Run `bun run build 2>&1 | tail -30` and check for no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api/hardware-stats.ts lib/api/index.ts app/api/\\[\\[...slugs\\]\\]/route.ts
git commit -m "feat: add hardware stats API endpoints (list + detail)"
```

---

### Task 8: Devices Grid Page

**Files:**
- Create: `app/devices/page.tsx` (server component)
- Create: `app/devices/page-client.tsx` (client component with device cards)

**Context:** Create the `/devices` page that shows a grid of device cards. Each card displays the device name, type, benchmark count, avg FPS, and game count. Clicking a card navigates to `/devices/[slug]`. The page fetches data from `/api/hardware/stats`.

- [ ] **Step 1: Create the server component**

Create `app/devices/page.tsx`:

```tsx
import { DevicesPageClient } from "./page-client"

export const metadata = {
  title: "Devices — DeckyVault",
  description: "Browse handheld and console devices with benchmark data on DeckyVault",
}

export default function DevicesPage() {
  return <DevicesPageClient />
}
```

- [ ] **Step 2: Create the client component**

Create `app/devices/page-client.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Gamepad2Icon, TrendingUpIcon, DatabaseIcon, CheckCircleIcon, ArrowRightIcon, Loader2 } from "lucide-react"

interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  sortOrder: number
  totalBenchmarks: number
  avgFps: number | null
  gameCount: number
  verifiedCount: number
  bestGame: {
    id: string
    title: string
    headerImage: string | null
    fpsAvg: number
  } | null
}

export function DevicesPageClient() {
  const [devices, setDevices] = useState<DeviceStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/hardware/stats")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDevices(data)
      } catch (err) {
        setError("Failed to load devices")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDevices()
  }, [])

  const deviceTypeLabel: Record<string, string> = {
    handled: "Handheld",
    console: "Console",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8">
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8">
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>No devices found</p>
          <p className="text-sm mt-1">Benchmark data will appear as devices are added</p>
        </div>
      </div>
    )
  }

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Devices</h1>
          <p className="text-sm text-text/60 mt-1">
            Browse benchmark data for handheld and console devices
          </p>
        </div>
      </motion.div>

      {/* Device Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device, i) => (
            <motion.div
              key={device.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <Link
                href={`/devices/${device.slug}`}
                className="block p-5 rounded-xl border border-border bg-text/[0.03] hover:border-primary/30 transition-colors group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {device.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/20 text-secondary border border-secondary/30 capitalize mt-1">
                      <Gamepad2Icon className="h-2.5 w-2.5" />
                      {deviceTypeLabel[device.deviceType] || device.deviceType}
                    </span>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-text/20 group-hover:text-primary transition-colors" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="flex flex-col items-center text-center">
                    <DatabaseIcon className="h-4 w-4 text-primary mb-1" />
                    <span className="text-lg font-bold tabular-nums">{device.totalBenchmarks}</span>
                    <span className="text-[10px] text-text/50">Benchmarks</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <TrendingUpIcon className="h-4 w-4 text-green-400 mb-1" />
                    <span className="text-lg font-bold tabular-nums">
                      {device.avgFps !== null ? device.avgFps : "—"}
                    </span>
                    <span className="text-[10px] text-text/50">Avg FPS</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Gamepad2Icon className="h-4 w-4 text-accent mb-1" />
                    <span className="text-lg font-bold tabular-nums">{device.gameCount}</span>
                    <span className="text-[10px] text-text/50">Games</span>
                  </div>
                </div>

                {/* Best game */}
                {device.bestGame && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-text/50">
                    Top: <span className="text-text/80 font-medium">{device.bestGame.title}</span> · {device.bestGame.fpsAvg} FPS
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 3: Update routes**

In `lib/routes.ts`, confirm the `/devices` route already exists. It does — it's already there as:

```ts
{
  title: "Devices",
  href: "/devices",
},
```

- [ ] **Step 4: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/devices/page.tsx app/devices/page-client.tsx lib/routes.ts
git commit -m "feat: add devices grid page with device cards"
```

---

### Task 9: Devices Detail Page with Charts

**Files:**
- Create: `app/devices/[slug]/page.tsx` (server component)
- Create: `app/devices/[slug]/device-detail-client.tsx` (client component with charts)

**Context:** The device detail page shows comprehensive stats for a single device, following the game page layout pattern. It reuses the `EChartWrapper` chart components and theme. Charts include: Historical FPS trend, FPS Distribution (boxplot by game), Genre Breakdown (donut), Proton Version Breakdown, and Top Games list.

- [ ] **Step 1: Create the server component**

Create `app/devices/[slug]/page.tsx`:

```tsx
import { db } from "@/lib/db/index"
import { hardware } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { DeviceDetailClient } from "./device-detail-client"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [device] = await db
    .select({ name: hardware.name })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) return { title: "Device Not Found — DeckyVault" }

  return {
    title: `${device.name} — DeckyVault`,
    description: `Benchmark data and performance stats for ${device.name} on DeckyVault`,
  }
}

export default async function DevicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const [device] = await db
    .select({
      slug: hardware.slug,
      name: hardware.name,
      deviceType: hardware.deviceType,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) {
    notFound()
  }

  return <DeviceDetailClient device={device} />
}
```

- [ ] **Step 2: Create the device detail client component**

Create `app/devices/[slug]/device-detail-client.tsx`:

This component fetches `/api/hardware/:slug/stats` and renders a page similar to the game page. It includes:
- Hero header (device name, type badge, stats)
- Historical FPS chart (using EChartWrapper directly, matching the HistoricalAreaChart pattern)
- FPS Distribution boxplot (by game, using EChartWrapper)
- Genre Breakdown donut chart
- Top Games list
- Proton/FSR breakdown sections

The component will be structured similarly to `GamePageClient` with `max-w-7xl` sections, `motion.div` animations, and card-based layout.

```tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Gamepad2Icon, TrendingUpIcon, DatabaseIcon, CheckCircleIcon, ExternalLinkIcon, ArrowRightIcon, Loader2 } from "lucide-react"
import { EChartWrapper, CHART_THEME, getDeviceColor } from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface DeviceInfo {
  slug: string
  name: string
  deviceType: string
}

interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  totalBenchmarks: number
  avgFps: number | null
  verifiedCount: number
  gameCount: number
  boxplot: Array<{
    gameId: string
    gameTitle: string
    min: number
    q1: number
    median: number
    q3: number
    max: number
    count: number
  }>
  historical: Array<{
    period: string
    avgFps: number
    count: number
  }>
  topGames: Array<{
    gameId: string
    gameTitle: string
    headerImage: string | null
    avgFps: number
    benchmarkCount: number
  }>
  genreBreakdown: Array<{ genre: string; count: number }>
  protonBreakdown: Array<{ version: string; count: number }>
  fsrBreakdown: Array<{ version: string; count: number; avgFps: number }>
}

const deviceTypeLabel: Record<string, string> = {
  handled: "Handheld",
  console: "Console",
}

export function DeviceDetailClient({ device }: { device: DeviceInfo }) {
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      setLoading(true)
      try {
        const res = await fetch(`/api/hardware/${device.slug}/stats`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch (err) {
        console.error("Failed to fetch device stats:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStats()
    return () => { cancelled = true }
  }, [device.slug])

  const deviceColor = getDeviceColor(0)

  // ── Chart Options ──────────────────────────────────────────
  const historicalOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.historical.length === 0) return {}
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: "category",
        data: stats.historical.map((h) => h.period),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "line",
          data: stats.historical.map((h) => h.avgFps),
          smooth: true,
          lineStyle: { color: deviceColor, width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: deviceColor + "40" },
                { offset: 1, color: deviceColor + "05" },
              ],
            },
          },
          symbol: "circle",
          symbolSize: 4,
          itemStyle: { color: deviceColor },
        },
      ],
    }
  }, [stats, deviceColor])

  const boxplotOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.boxplot.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 80, right: 20, top: 10, bottom: 40 },
      xAxis: {
        type: "category",
        data: stats.boxplot.map((b) => b.gameTitle),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 10, rotate: 30 },
      },
      yAxis: {
        type: "value",
        name: "FPS",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: { lineStyle: { color: CHART_THEME.border, opacity: 0.3 } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "boxplot",
          data: stats.boxplot.map((b) => [b.min, b.q1, b.median, b.q3, b.max]),
          itemStyle: { color: deviceColor + "30", borderColor: deviceColor },
        },
      ],
    }
  }, [stats, deviceColor])

  const genreOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.genreBreakdown.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "50%"],
          data: stats.genreBreakdown.map((g, i) => ({
            name: g.genre,
            value: g.count,
            itemStyle: { color: CHART_THEME.deviceColors[i % CHART_THEME.deviceColors.length] },
          })),
          label: {
            color: CHART_THEME.textMuted,
            fontSize: 10,
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
          },
        },
      ],
    ]
  }, [stats])

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* ── Hero Header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">{device.name}</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary border border-secondary/30 capitalize">
              <Gamepad2Icon className="h-3 w-3" />
              {deviceTypeLabel[device.deviceType] || device.deviceType}
            </span>
          </div>
          <p className="text-sm text-text/60">
            Performance benchmarks and statistics
          </p>
        </div>
      </motion.div>

      {/* ── Overview Stats ────────────────────────────────── */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
          <StatCard icon={DatabaseIcon} label="Total Benchmarks" value={String(stats.totalBenchmarks)} />
          <StatCard icon={TrendingUpIcon} label="Average FPS" value={stats.avgFps !== null ? String(stats.avgFps) : "—"} />
          <StatCard icon={Gamepad2Icon} label="Games Tested" value={String(stats.gameCount)} />
          <StatCard icon={CheckCircleIcon} label="Verified" value={String(stats.verifiedCount)} />
          </div>
        </motion.div>
      )}

      {/* ── Loading State ─────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Charts Section ────────────────────────────────── */}
      {stats && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {/* Row 1: Historical FPS */}
            {stats.historical.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-2">Historical Performance</h3>
                <EChartWrapper option={historicalOption} height={280} />
              </div>
            )}

            {/* Row 2: FPS Distribution + Genre Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {stats.boxplot.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">FPS Distribution by Game</h3>
                  <EChartWrapper option={boxplotOption} height={300} />
                </div>
              )}
              {stats.genreBreakdown.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">Genre Breakdown</h3>
                  <EChartWrapper option={genreOption} height={300} />
                </div>
              )}
            </div>

            {/* Row 3: Proton & FSR Breakdown */}
            {(stats.protonBreakdown.length > 0 || stats.fsrBreakdown.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats.protonBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">Proton Version Distribution</h3>
                    <div className="space-y-2">
                      {stats.protonBreakdown.map((p) => (
                        <div key={p.version} className="flex items-center justify-between text-sm">
                          <span className="text-text/70">{p.version}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-text/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(5, (p.count / stats.totalBenchmarks) * 100)}%` }}
                              />
                            </div>
                            <span className="text-text/50 text-xs">{p.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {stats.fsrBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">FSR Version Performance</h3>
                    <div className="space-y-2">
                      {stats.fsrBreakdown.map((f) => (
                        <div key={f.version} className="flex items-center justify-between text-sm">
                          <span className="text-text/70 capitalize">{f.version === "none" ? "Native" : f.version.toUpperCase()}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-text/80 font-medium tabular-nums">{f.avgFps} FPS</span>
                            <span className="text-text/40 text-xs">({f.count})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Top Games */}
            {stats.topGames.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-3">Top Games by Average FPS</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {stats.topGames.slice(0, 8).map((game, i) => (
                    <Link
                      key={game.gameId}
                      href={`/game/${game.gameId}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-text/5 border border-border hover:border-primary/30 transition-colors group"
                    >
                      <div className="text-lg font-bold text-text/20 tabular-nums w-6">{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{game.gameTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-text/50">
                          <span className="text-green-400 font-medium">{game.avgFps} FPS</span>
                          <span>{game.benchmarkCount} runs</span>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-text/20 group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {stats && !loading && stats.totalBenchmarks === 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-[10svw]">
          <div className="text-center py-16 text-text/40">
            <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
            <p>No benchmark data yet for this device</p>
            <p className="text-sm mt-1">Data will appear as benchmarks are submitted</p>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-text/[0.03] min-w-[160px]">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-text/50">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

Run `bun run build 2>&1 | tail -30` and verify no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/devices/\\[slug\\]/page.tsx app/devices/\\[slug\\]/device-detail-client.tsx
git commit -m "feat: add device detail page with charts and stats"
```

---

### Task 10: Final Polish — Build & Lint Check

**Files:**
- Possibly modify: any files with type errors or lint warnings

**Context:** Run a full build and lint pass, fix all issues found.

- [ ] **Step 1: Run the full build**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build 2>&1
```

- [ ] **Step 2: Fix any build errors**

Check the output for TypeScript errors, missing imports, or type mismatches. Fix each error. Most likely issues:
- `authClient.linkSocialAccount` might not be available on the client type — check if it needs to be imported differently
- The `FaDiscord` and `FaGoogle` imports from `react-icons/fa` — verify these exist
- `CheckCircleIcon` in devices page-client should be `CheckCircle` from lucide-react
- EChartWrapper option types might need adjustment

- [ ] **Step 3: Run lint check**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run lint 2>&1
```

- [ ] **Step 4: Fix lint warnings**

Address any eslint warnings, especially:
- Unused imports
- Missing dependencies in useEffect/useCallback
- Any `any` types that should be more specific

- [ ] **Step 5: Verify all pages load**

Start the dev server and manually verify:
- `/profile` loads with wider layout, no avatar, settings sub-tabs work
- `/profile` Settings → Profile (name editing)
- `/profile` Settings → Security (password + passkeys)
- `/profile` Settings → Linked Accounts (link/unlink)
- `/devices` shows device grid
- `/devices/[slug]` shows device detail with charts
- Navbar no longer shows avatar, just "Profile" text

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: build and lint fixes for profile and devices pages"
```