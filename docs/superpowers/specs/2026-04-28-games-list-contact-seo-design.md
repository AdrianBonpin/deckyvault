# Games List, Contact Page & SEO — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

---

## 1. Games List Page (`/games`)

### Architecture

Server component for initial render + SEO metadata, client component for interactive infinite scroll, search, and filtering.

### Data Flow

1. `page.tsx` (server) fetches first 24 games with total count via direct DB query
2. `games-page-client.tsx` (client) renders compact grid + search/filter bar
3. As user scrolls near bottom, `IntersectionObserver` triggers fetch to `/api/games?offset=N&limit=24&search=...&filter_...`
4. URL search params update reflectively: `?q=term&genre=Action&device=steam-deck&sort=benchmarks`

### Card Design (Compact)

Each card displays:
- Game cover image (capsule image, portrait 2:3 ratio, `next/image` with lazy loading)
- Title (1–2 lines, truncated with `line-clamp-2`)
- 1–2 compact stat badges:
  - Benchmark count (icon + number)
  - Avg FPS badge (if data exists) or "No data yet" muted text
- Deck status pill (Native/Proton/Unsupported) — from `gamePlatformSupport`
- On hover: subtle border highlight + scale, links to `/game/{id}`

### Filters

- **Search**: Debounced text input (300ms), uses `?search=` on `/api/games`
- **Genre**: Multi-select pill buttons derived from aggregating genres from initial game batch
- **Device**: Pill buttons matching existing devices page pattern (all hardware slugs)
- **Sort**: Dropdown — Name A–Z, Most Benchmarks, Recently Added

### Performance

- Initial 24 items server-rendered for SEO crawlability
- Subsequent pages fetched client-side (24 per page)
- `IntersectionObserver` on sentinel element at bottom of grid
- `next/image` with `sizes` attribute for responsive srcsets
- Total count tracked to stop loading when exhausted
- Suspense boundary around grid for streaming initial data

### SEO

- `generateMetadata()`: title "Games — DeckyVault", description, OG tags, canonical `https://deckyvault.xyz/games`
- JSON-LD `ItemList` schema with initial 24 games
- Page is indexable (unlike `/search`)

### File Structure

```
app/games/
  page.tsx              — Server component: fetch initial games, metadata, JSON-LD
  games-page-client.tsx — Client component: grid, infinite scroll, search, filters
```

---

## 2. Contact / Report Page (`/contact`)

### Architecture

Client component for the form UI, server-side Elysia API route for Discord webhook submission.

### Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Category | Radio/pill select | Yes | Bug Report, Game Data Issue, User Report, Feature Request, General Feedback, Database Error |
| Name | Text | No | Pre-filled from session if logged in |
| Email | Text | No | Pre-filled from session if logged in |
| Subject | Text | Yes | Max 200 chars |
| Message | Textarea | Yes | Max 2000 chars |
| Game URL | Text | Conditional | Shown only for "Game Data Issue" category. Validates `/game/` URL pattern |
| Honeypot | Hidden text | No | Must remain empty (anti-bot) |
| Timestamp | Hidden | No | Client-side submission start time (anti-bot timing check) |

### Discord Webhook Integration

New Elysia route: `POST /api/contact`

**Payload → Discord Embed mapping:**
- Category → embed color (🔴 red: Bug/DB Error, 🟡 yellow: Game Data, 🔵 blue: User Report, 🟢 green: Feature Request, ⚪ grey: General)
- Name, Email, Subject, Message → embed fields
- Game URL → link field (when present)
- User ID (if authenticated) → footer field
- IP hash (SHA-256 truncated) → footer field for tracking

**Environment variable:** `DISCORD_WEBHOOK_URL` added to `.env.example`

### Anti-Abuse Measures

1. **Honeypot field**: Hidden input that bots fill; server rejects if non-empty
2. **Timing check**: Server rejects submissions where timestamp < 3 seconds ago (bots submit instantly)
3. **IP rate limiting**: In-memory LRU cache, max 3 submissions per IP per hour
4. **Server-side validation**: All required fields, max lengths, category enum check, Game URL format validation

### UX

- Success: Clear success message after submission (inline, not toast)
- Error: Inline validation errors per field; rate limit exceeded shows friendly message asking to try later
- Accessible: Proper `<label>` associations, ARIA attributes, keyboard navigable, focus management
- No CAPTCHA — timing + honeypot + rate limit is sufficient

### SEO

- `robots: { index: false, follow: true }` — not useful indexed
- Simple metadata: title "Contact & Report — DeckyVault"

### File Structure

```
app/contact/
  page.tsx              — Client component: contact form with category picker, validation, submission
lib/api/contact.ts      — Elysia route: POST handler, Discord webhook, rate limit, validation
```

---

## 3. SEO & Sitemap Updates

### Sitemap Additions

Current sitemap includes: `/`, `/devices`, `/game/{id}` (all), `/devices/{slug}` (all).

**Add:**
| URL | Priority | Change Frequency |
|-----|----------|-----------------|
| `/games` | 0.7 | weekly |
| `/contact` | 0.3 | monthly |
| `/login` | 0.3 | monthly |
| `/signup` | 0.3 | monthly |

**Enhancement:** Add `images` property to game sitemap entries using `capsuleImage` field.

### Robots.txt Updates

Add explicit disallow rules:
```
Disallow: /admin
Disallow: /api
```

This is in addition to the per-page `robots` metadata that already exists on admin and search pages.

### Files to Modify

```
app/sitemap.ts          — Add static pages, enhance game entries with images
app/robots.ts           — Add /admin and /api disallow rules
```

---

## Edge Cases & Security

- **Games list with zero results**: Show friendly empty state with icon + message
- **Games list API failure**: Client-side error state with retry CTA
- **Contact form rate limit exceeded**: HTTP 429 response, inline message "Please try again in a few minutes"
- **Discord webhook down**: Server catches webhook POST failure, returns 500 with generic error message (no Discord implementation details leaked)
- **XSS in form fields**: All fields validated server-side; Discord embed content is structured (not raw HTML)
- **Games grid empty DB**: Server component renders empty state, no client-side fallback needed
- **Deep pagination**: Cap offset at 10000 (to prevent DB strain from bots scrolling endlessly); show "You've reached the end" message