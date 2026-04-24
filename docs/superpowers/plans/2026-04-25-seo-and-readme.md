# SEO & README Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive SEO infrastructure (metadata, OG images, sitemap, robots.txt, manifest) and update the README to reflect the current project state.

**Architecture:** All SEO files live in `app/` as Next.js file conventions. The OG image is dynamically generated using `ImageResponse` from `next/og`, leveraging the existing `app/icon.png` logo. Sitemap and manifest use TypeScript file conventions for future dynamic data readiness. The site URL is `https://deckyvault.xyz`.

**Tech Stack:** Next.js 16.2.4 App Router, `next/og` ImageResponse, TypeScript, Tailwind CSS v4

---

## File Structure

### Files to Create
| File | Purpose |
|------|---------|
| `app/layout.tsx` | Modify: add full metadata (title template, description, OpenGraph, Twitter, authors, keywords, metadataBase) |
| `app/opengraph-image.tsx` | Create: dynamic OG banner image using ImageResponse with logo + brand colors |
| `app/twitter-image.tsx` | Create: Twitter card image (can share OG image logic or be identical) |
| `app/sitemap.ts` | Create: programmatic sitemap with static routes, ready for dynamic data |
| `app/robots.ts` | Create: robots.txt allowing all crawlers, pointing to sitemap |
| `app/manifest.ts` | Create: PWA web manifest with app name, theme colors, icons |
| `app/icon.png` | Already exists — used as favicon and in OG image generation |
| `README.md` | Modify: update tech stack, install commands, development status note |

### Files Unchanged
| File | Reason |
|------|--------|
| `app/page.tsx` | Landing page — no SEO changes needed (metadata is in layout) |
| `app/globals.css` | Styles — no changes needed |
| `next.config.ts` | No config changes needed for this scope |
| `public/` | Stays empty — all assets handled via app directory conventions |

---

## Chunk 1: Root Layout Metadata & OG Image Generation

### Task 1: Enhance Root Layout Metadata

**Files:**
- Modify: `app/layout.tsx`

The current layout only sets `title`. We need to add full metadata for SEO and social sharing.

- [ ] **Step 1: Update `app/layout.tsx` with comprehensive metadata**

Replace the existing `metadata` export with a full configuration:

```tsx
import type { Metadata } from "next"
import { Lexend } from "next/font/google"
import "./globals.css"

const font = Lexend({
    variable: "--font-lexend",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    metadataBase: new URL("https://deckyvault.xyz"),
    title: {
        default: "DeckyVault - Steam Deck Benchmarks & Settings",
        template: "%s | DeckyVault",
    },
    description:
        "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
    keywords: [
        "Steam Deck",
        "benchmarks",
        "settings",
        "performance",
        "FPS",
        "gaming",
        "Steam Machine",
        "Proton",
        "FSR",
        "compatibility",
    ],
    authors: [{ name: "Adrian Bonpin", url: "https://github.com/AdrianBonpin" }],
    creator: "@adrianbonpin",
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://deckyvault.xyz",
        siteName: "DeckyVault",
        title: "DeckyVault - Steam Deck Benchmarks & Settings",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        images: [
            {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: "DeckyVault - Steam Deck Benchmarks & Settings",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "DeckyVault - Steam Deck Benchmarks & Settings",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        creator: "@adrianbonpin",
        images: ["/twitter-image"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className={`${font.variable} bg-background text-text antialiased overscroll-none`}
        >
            <body className='min-h-full flex flex-col relative'>
                {children}
            </body>
        </html>
    )
}
```

- [ ] **Step 2: Verify layout compiles**

Run: `bun run build`
Expected: Build succeeds with no TypeScript errors.

---

### Task 2: Create Dynamic OpenGraph Image

**Files:**
- Create: `app/opengraph-image.tsx`

Uses `ImageResponse` from `next/og` to generate a branded OG banner at build time. Reads the existing `app/icon.png` as a base64 data URI and renders it with the DeckyVault name and tagline on the brand background color.

- [ ] **Step 1: Create `app/opengraph-image.tsx`**

```tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "DeckyVault - Steam Deck Benchmarks & Settings"
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = "image/png"

export default async function Image() {
    const logoData = await readFile(
        join(process.cwd(), "app/icon.png"),
        "base64"
    )
    const logoSrc = `data:image/png;base64,${logoData}`

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#100b14",
                    color: "#ebe4f1",
                    fontFamily: "sans-serif",
                    gap: "16px",
                }}
            >
                <img
                    src={logoSrc}
                    alt="DeckyVault"
                    height="120"
                    style={{ borderRadius: "16px" }}
                />
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                    }}
                >
                    DeckyVault
                </div>
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 400,
                        opacity: 0.8,
                    }}
                >
                    Steam Deck Benchmarks &amp; Settings
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
```

- [ ] **Step 2: Verify OG image builds**

Run: `bun run build`
Expected: Build succeeds. `opengraph-image` route appears in build output.

---

### Task 3: Create Twitter Card Image

**Files:**
- Create: `app/twitter-image.tsx`

Shares the same design as the OG image. Next.js supports separate `twitter-image` files. For now, we duplicate the OG image logic to allow independent customization later.

- [ ] **Step 1: Create `app/twitter-image.tsx`**

```tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "DeckyVault - Steam Deck Benchmarks & Settings"
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = "image/png"

export default async function Image() {
    const logoData = await readFile(
        join(process.cwd(), "app/icon.png"),
        "base64"
    )
    const logoSrc = `data:image/png;base64,${logoData}`

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#100b14",
                    color: "#ebe4f1",
                    fontFamily: "sans-serif",
                    gap: "16px",
                }}
            >
                <img
                    src={logoSrc}
                    alt="DeckyVault"
                    height="120"
                    style={{ borderRadius: "16px" }}
                />
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                    }}
                >
                    DeckyVault
                </div>
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 400,
                        opacity: 0.8,
                    }}
                >
                    Steam Deck Benchmarks &amp; Settings
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
```

- [ ] **Step 2: Verify Twitter image builds**

Run: `bun run build`
Expected: Build succeeds. Both `opengraph-image` and `twitter-image` routes appear.

---

## Chunk 2: Sitemap, Robots.txt, and Manifest

### Task 4: Create Dynamic Sitemap

**Files:**
- Create: `app/sitemap.ts`

Programmatically generates `sitemap.xml`. Currently static (just the homepage), but structured so that dynamic game pages can be added later by querying the database.

- [ ] **Step 1: Create `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next"

const BASE_URL = "https://deckyvault.xyz"

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        // Future dynamic routes can be added here:
        // {
        //     url: `${BASE_URL}/games/${game.slug}`,
        //     lastModified: game.updatedAt,
        //     changeFrequency: "weekly",
        //     priority: 0.8,
        // },
    ]
}
```

- [ ] **Step 2: Verify sitemap builds**

Run: `bun run build`
Expected: Build succeeds. `/sitemap.xml` route available.

---

### Task 5: Create Robots.txt

**Files:**
- Create: `app/robots.ts`

Allows all crawlers, points to the sitemap, and sets the host.

- [ ] **Step 1: Create `app/robots.ts`**

```ts
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
        },
        sitemap: "https://deckyvault.xyz/sitemap.xml",
        host: "https://deckyvault.xyz",
    }
}
```

- [ ] **Step 2: Verify robots.txt builds**

Run: `bun run build`
Expected: Build succeeds. `/robots.txt` route available.

---

### Task 6: Create Web App Manifest

**Files:**
- Create: `app/manifest.ts`

Generates `manifest.webmanifest` for PWA support and better mobile experience. Uses the existing `app/icon.png` and the brand colors from `globals.css`.

- [ ] **Step 1: Create `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "DeckyVault - Steam Deck Benchmarks & Settings",
        short_name: "DeckyVault",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        start_url: "/",
        display: "standalone",
        background_color: "#100b14",
        theme_color: "#eb3779",
        icons: [
            {
                src: "/icon.png",
                sizes: "any",
                type: "image/png",
            },
        ],
    }
}
```

Note: `app/icon.png` is served at `/icon.png` by Next.js (the existing build output confirms this route exists).

- [ ] **Step 2: Verify manifest builds**

Run: `bun run build`
Expected: Build succeeds. `/manifest.webmanifest` route available.

---

## Chunk 3: README Update

### Task 7: Update README.md

**Files:**
- Modify: `README.md`

The current README is outdated — references npm/yarn/pnpm instead of bun, doesn't mention Elysia, Drizzle, Tiptap, better-auth, S3 storage, or the actual full tech stack. Needs to reflect the current state and note that the site is under development.

- [ ] **Step 1: Replace `README.md` content**

```markdown
# DeckyVault

An open-source, community-driven database for Steam Deck (OLED & LCD) and Steam Machine compatibility, performance metrics, and settings.

> **Note:** DeckyVault is currently under active development. The site is live at [deckyvault.xyz](https://deckyvault.xyz) but features are being built incrementally. Stay tuned!

## Why DeckyVault?

Gaming on the Steam Deck is incredible, but finding reliable, detailed answers about whether a game will run well — or how to optimize it — can be frustrating. Existing resources are often fragmented, outdated, or lack the depth the community needs.

**DeckyVault** aims to solve this by being the definitive, community-first hub for Steam Deck performance data.

## Features

- **Community-First Contributions** — Built by the community, for the community. Anyone can contribute data and improvements.
- **Streamlined Filters & Searching** — Quickly find the games you're looking for with powerful search and filtering.
- **Rich Performance Metrics**
  - Community average FPS (**low**, **avg**, **high**).
  - Extended FPS metrics for technologies like **FSR** and **Frame Generation**.
- **Beautifully Formatted Settings** — No more endless single-column lists. Every game features **sectioned setting tables** that mirror in-game menus.
- **Historical FPS Graphs** — Track performance improvements over time across:
  - Game Versions
  - Proton / Native builds
  - SteamOS Versions
- **Multi-Device Support** — Dedicated metrics and optimized settings for **Steam Deck OLED**, **Steam Deck LCD**, and **Steam Machine**, all on a single page with quick toggles.
- **Comprehensive Compatibility Tracking**
  - Proton vs. Native status
  - Online Play & Anti-Cheat status
  - Straightforward "Playable" tags
- **Loading & Storage Metrics** — Track initial launch times, game load times, world loading, and **SD Card** performance.
- **Community & Steam Integration** — On-site comments plus existing reviews, artwork, and stats pulled directly from Steam.
- **Open Source** — Fully transparent. Help us build the best resource for Deck gamers.

## Tech Stack

- **[Next.js 16](https://nextjs.org)** — React framework (App Router)
- **[React 19](https://react.dev)** — UI library
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[Tailwind CSS v4](https://tailwindcss.com)** — Utility-first styling
- **[Elysia](https://elysiajs.com)** — Backend API framework
- **[Drizzle ORM](https://orm.drizzle.team)** — Type-safe database queries
- **[PostgreSQL](https://www.postgresql.org)** — Primary database
- **[better-auth](https://better-auth.com)** — Authentication (Google & Discord OAuth)
- **[Tiptap](https://tiptap.dev)** — Rich text editor
- **[Motion](https://motion.dev)** — Animations
- **[AWS S3](https://aws.amazon.com/s3/)** — File storage
- **[Bun](https://bun.sh)** — Package manager & runtime

## Getting Started

Clone the repository and install dependencies:

```bash
bun install
```

Copy the environment file and configure your values:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server (HTTPS) |
| `bun run build` | Create production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |

## Contributing

We welcome contributions of all kinds! Whether you want to:

- Suggest a new feature
- Report a bug
- Improve the design
- Contribute code

Feel free to open an [issue](https://github.com/AdrianBonpin/deckyvault/issues) or submit a [pull request](https://github.com/AdrianBonpin/deckyvault/pulls).

If you're interested in helping develop or design the project, don't hesitate to reach out!

## Roadmap

This project is actively being developed. Here are some of the major items on our radar:

- [ ] Core database and API for game entries
- [ ] Advanced search and filter system
- [ ] Community submission and moderation tools
- [ ] FPS graphing and historical data visualization
- [ ] Steam API integration for reviews, artwork, and stats
- [ ] Support for additional handheld devices *(future consideration)*

Stay tuned for updates!

## License

This project is open-source. *(Add your specific license here, e.g., MIT, GPL-3.0)*

## Acknowledgements

- Built with love for the Steam Deck community.
- Check out the author's existing project for an idea of what to expect: **[https://grounds.ph](https://grounds.ph)**

---

*DeckyVault is an independent project and is not affiliated with Valve Corporation.*
```

- [ ] **Step 2: Verify no build impact**

Run: `bun run build`
Expected: Build succeeds (README changes don't affect build).

---

## Chunk 4: Verification & Lint/Build Cleanup

### Task 8: Final Verification

**Files:**
- All files created/modified in Tasks 1-7

- [ ] **Step 1: Run full lint**

Run: `bun run lint`
Expected: No errors or warnings.

- [ ] **Step 2: Run full build**

Run: `bun run build`
Expected: Build succeeds. Verify the following routes are generated:
- `/` — main page
- `/icon.png` — favicon (already existed)
- `/opengraph-image` — OG banner
- `/twitter-image` — Twitter card
- `/sitemap.xml` — sitemap
- `/robots.txt` — robots
- `/manifest.webmanifest` — PWA manifest

- [ ] **Step 3: Fix any lint or build errors**

If lint or build fails, fix the issues before claiming completion. Common issues to watch for:
- TypeScript errors in OG image files (ensure `readFile` import works)
- ESLint warnings on unused variables or missing dependencies
- Build failures from incorrect `ImageResponse` JSX

- [ ] **Step 4: Commit all changes**

```bash
git add app/layout.tsx app/opengraph-image.tsx app/twitter-image.tsx app/sitemap.ts app/robots.ts app/manifest.ts README.md
git commit -m "feat: add comprehensive SEO (metadata, OG images, sitemap, robots, manifest) and update README"
```

---

## Summary of Routes After Implementation

| Route | Type | Source File |
|-------|------|-------------|
| `/` | Static page | `app/page.tsx` |
| `/icon.png` | Favicon | `app/icon.png` |
| `/opengraph-image` | OG banner (PNG) | `app/opengraph-image.tsx` |
| `/twitter-image` | Twitter card (PNG) | `app/twitter-image.tsx` |
| `/sitemap.xml` | Sitemap | `app/sitemap.ts` |
| `/robots.txt` | Robots | `app/robots.ts` |
| `/manifest.webmanifest` | PWA manifest | `app/manifest.ts` |
