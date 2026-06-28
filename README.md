<div align="center">

# DeckyVault

**The community-driven database for Steam Deck performance data, settings, and compatibility.**

[![Live Site](https://img.shields.io/badge/Live-deckyvault.xyz-eb3779?style=flat-square)](https://deckyvault.xyz)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-1.3-black?style=flat-square&logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#license)

</div>

---

DeckyVault is an open-source platform where the Steam Deck community shares real-world performance benchmarks, optimized game settings, and compatibility reports. Every data point comes from actual players — not spec sheets.

The project includes a **Decky Loader plugin** that automatically records performance metrics (FPS, TDP, temps) during gameplay and exports or uploads them directly to DeckyVault.

> **Actively developed.** The site is live at [deckyvault.xyz](https://deckyvault.xyz). Features ship incrementally.

## Features

### Performance Data
- **Community FPS metrics** — low / average / high benchmarks from real players
- **Extended FPS tracking** — FSR, Frame Generation, and upscaling-specific metrics
- **Historical graphs** — track performance across game versions, Proton builds, and SteamOS releases

### Game Settings
- **Sectioned settings tables** — organized to mirror in-game menus, not flat lists
- **Per-device presets** — separate optimized settings for Steam Deck OLED, LCD, and Steam Machine
- **One-click presets** — apply community-verified settings instantly

### Compatibility
- **Proton vs. Native status** — know before you launch
- **Online Play & Anti-Cheat tracking** — see which multiplayer games actually work
- **Playable tags** — straightforward compatibility labels

### Community
- **Rich text comments** — Tiptap-powered editor with threaded discussions
- **Upvoting** — surface the most helpful contributions
- **Steam integration** — reviews, artwork, and stats pulled directly from Steam

### Platform
- **Unified search** — find games, hardware, and benchmarks in one place
- **Device profiles** — dedicated pages for each hardware device with OG image generation
- **Saved games** — bookmark and track the games you care about
- **Admin dashboard** — moderation tools for comments, reports, and content management

### Decky Loader Plugin
- **Auto-record performance** — MangoHud-powered FPS, TDP, and temperature logging
- **One-click upload** — send benchmarks directly to DeckyVault via API key
- **Export to file** — save `.deckyvault.json` files for manual upload
- **Manual inputs** — upscaler type, frame gen, in-game settings, load times, notes
- **Hardware auto-detection** — identifies Steam Deck LCD vs OLED from DMI data

## Monorepo Structure

```
deckyvault/
├── apps/
│   └── web/                  # Next.js 16 web application
│       ├── app/              # App Router pages & API routes
│       ├── components/       # React components
│       ├── lib/              # API routes, auth, DB schema
│       └── drizzle/          # Database migrations
├── packages/
│   └── shared/               # Shared TypeScript types & constants
│       └── src/
│           └── index.ts      # DeckyVaultImportV1, hardware slugs, API types
├── plugins/
│   └── decky-vault/          # Decky Loader plugin
│       ├── main.py           # Python backend (filesystem, shell, HTTP)
│       ├── src/              # TypeScript/React frontend
│       │   ├── index.tsx     # Plugin entry point (definePlugin)
│       │   ├── components/  # Main panel, session form, settings panel
│       │   └── lib/         # RPC wrappers, state management
│       └── tests/            # Python unit tests
├── docs/
│   └── superpowers/          # Plans & specs
└── public/                   # Static assets
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Next.js 16                     │
│              (App Router + React 19)              │
├─────────────────────────────────────────────────┤
│  app/                    │  components/           │
│  ├── (auth)/             │  ├── comments/         │
│  ├── (manage)/manage/    │  ├── charts/           │
│  ├── api/[[...slugs]]/   │  ├── manage/           │
│  ├── game/[id]/          │  ├── profile/          │
│  ├── games/              │  └── wizard/           │
│  └── ...                 │                        │
├─────────────────────────────────────────────────┤
│              Elysia API (catch-all route)         │
│  lib/api/ — 24 route modules                     │
├─────────────────────────────────────────────────┤
│  Drizzle ORM → PostgreSQL                        │
│  lib/db/schema/ — 9 schema files                 │
├─────────────────────────────────────────────────┤
│  better-auth (Google + Discord OAuth, Passkeys,  │
│  API Keys) · AWS S3 · Resend                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Decky Loader Plugin                 │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  React Frontend  │  │  Python Backend      │  │
│  │  (Steam CEF)     │◄─┤  (filesystem, shell, │  │
│  │  UI + state      │  │  HTTP, log parsing)  │  │
│  └─────────────────┘  └──────────┬───────────┘  │
│                                   │              │
│                          POST /api/performance/import│
│                          (via x-api-key header)     │
└─────────────────────────────────────────────────────┘
```

The API layer uses [Elysia](https://elysiajs.com) mounted as a catch-all Next.js route handler at `app/api/[[...slugs]]/route.ts`. All route modules live in `lib/api/` and are composed into a single Elysia app.

The Decky Loader plugin uses a dual architecture: a React/TypeScript frontend (runs in Steam's CEF context) communicates with a Python backend via `@decky/api`'s RPC mechanism. The Python backend handles filesystem I/O, shell commands, and HTTP requests to the DeckyVault API.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | [React 19](https://react.dev) · [Tailwind CSS v4](https://tailwindcss.com) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| API | [Elysia](https://elysiajs.com) |
| Database | [PostgreSQL](https://www.postgresql.org) · [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [better-auth](https://better-auth.com) (Google, Discord, Passkeys, OTP, API Keys) |
| Editor | [Tiptap](https://tiptap.dev) (rich text) |
| Animations | [Motion](https://motion.dev) |
| Charts | [ECharts](https://echarts.apache.org) |
| Storage | [AWS S3](https://aws.amazon.com/s3/) |
| Email | [Resend](https://resend.com) |
| Runtime | [Bun](https://bun.sh) |
| Plugin SDK | [@decky/api](https://npmjs.com/package/@decky/api) · [@decky/ui](https://npmjs.com/package/@decky/ui) |
| Plugin Backend | Python 3 · urllib (stdlib) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- PostgreSQL database
- Node.js 18+ (for Next.js compatibility)

### Installation

```bash
git clone https://github.com/AdrianBonpin/deckyvault.git
cd deckyvault
bun install
```

### Environment

Copy the example environment file and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret key for auth sessions |
| `BETTER_AUTH_URL` | Your app URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret |
| `AWS_ACCESS_KEY_ID` | AWS S3 access key |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret key |
| `AWS_S3_BUCKET` | S3 bucket name |
| `RESEND_API_KEY` | Resend API key for transactional email |

### Database

Push the schema to your database:

```bash
cd apps/web
bun run db:push
```

Or generate and run migrations:

```bash
bun run db:generate
bun run db:migrate
```

Seed the database (optional):

```bash
bun run db:seed
```

### Development

```bash
# From the root — runs the web app
bun run dev
```

Open [https://localhost:3000](https://localhost:3000) (self-signed HTTPS via `--experimental-https`).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start web app dev server with HTTPS |
| `bun run build` | Create production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run test` | Run tests with Vitest |
| `bun run test:watch` | Run tests in watch mode |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed the database |

## Decky Loader Plugin

The `plugins/decky-vault/` directory contains a Decky Loader plugin that records performance metrics and exports/uploads them to DeckyVault.

### Building

```bash
cd plugins/decky-vault
bun install
bun run build
```

Output: `plugins/decky-vault/dist/index.js`

### Installing on Steam Deck

1. Build the plugin (see above)
2. Copy the entire `plugins/decky-vault/` directory to `/home/deck/homebrew/plugins/` on your Steam Deck
3. Restart Decky Loader or reload plugins
4. The plugin appears as "DeckyVault" in the Quick Access Menu

### Usage

1. Open the DeckyVault plugin from the Quick Access Menu (QAM)
2. Go to the **Settings** tab and configure:
   - **API Key** — get one from DeckyVault → Profile → Settings → API Keys
   - **Write MangoHud Config** — writes the logging config to `~/.config/MangoHud/MangoHud.conf`
3. Add `mangohud %command%` to your game's Steam launch options
4. Go to the **Record** tab and press **Start Recording**
5. Play your game
6. Press **Stop Recording** — FPS stats are parsed from the MangoHud log
7. Fill in manual details (upscaler, frame gen, settings, etc.)
8. **Export to File** or **Upload to DeckyVault**

### Plugin Architecture

```
plugins/decky-vault/
├── main.py              # Python backend — settings, MangoHud, system info, export, upload
├── src/
│   ├── index.tsx        # Entry point — definePlugin, SteamClient events, tab nav
│   ├── types.d.ts       # SteamClient type declarations
│   ├── lib/
│   │   ├── api.ts       # Typed RPC wrappers (callable → Python methods)
│   │   └── store.ts     # React hooks (useSettings, useSession) + payload builder
│   └── components/
│       ├── main-panel.tsx     # Record/Stop button, timer, recent recordings
│       ├── session-form.tsx   # Auto-captured metrics + manual inputs + actions
│       └── settings-panel.tsx # API key, export path, hardware, MangoHud setup
├── tests/
│   ├── test_mangohud_parser.py  # 7 unit tests for log parsing
│   ├── test_settings.py         # 4 unit tests for settings persistence
│   └── fixtures/
│       └── sample_mangohud.log  # Sample log for parser tests
├── package.json          # Frontend deps (@decky/api, @decky/ui, @decky/rollup)
├── plugin.json           # Decky plugin metadata
└── rollup.config.js      # @decky/rollup build config
```

### Running Plugin Tests

```bash
cd plugins/decky-vault
python -m pytest tests/ -v
```

## Project Structure

```
deckyvault/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/              # Auth pages (sign-in, reset password)
│       │   ├── (manage)/manage/     # Admin dashboard
│       │   │   ├── benchmarks/      # Benchmark moderation
│       │   │   ├── comments/        # Comment moderation
│       │   │   ├── games/           # Game management & sync
│       │   │   ├── hardware/        # Hardware management
│       │   │   ├── reports/         # Report moderation
│       │   │   └── users/           # User management
│       │   ├── api/[[...slugs]]/    # Elysia API catch-all
│       │   ├── compare/             # Side-by-side game comparison
│       │   ├── game/[id]/           # Individual game page
│       │   ├── games/               # Games listing
│       │   ├── devices/             # Hardware device pages
│       │   ├── profile/             # User profiles
│       │   └── search/              # Unified search
│       ├── components/
│       │   ├── auth/                # Auth-related components
│       │   ├── charts/              # ECharts wrappers
│       │   ├── comments/            # CommentSection, CommentItem
│       │   ├── manage/              # Admin sidebar
│       │   ├── profile/             # Settings tabs
│       │   └── wizard/              # Contribution wizard
│       ├── lib/
│       │   ├── api/                 # 24 Elysia route modules
│       │   ├── auth.ts              # better-auth server config
│       │   ├── auth-client.ts       # better-auth client
│       │   ├── db/
│       │   │   ├── schema/          # 9 Drizzle schema files
│       │   │   ├── index.ts         # DB connection
│       │   │   └── seed.ts          # Database seeder
│       │   ├── hooks/               # Custom React hooks
│       │   └── steam/               # Steam API integration
│       └── drizzle/                 # Generated migrations
├── packages/
│   └── shared/                      # Shared types & constants
├── plugins/
│   └── decky-vault/                 # Decky Loader plugin
├── docs/
│   └── superpowers/                 # Plans & specs
└── public/                          # Static assets
```

## Contributing

Contributions are welcome. Here's how to get involved:

1. **Report bugs** — [Open an issue](https://github.com/AdrianBonpin/deckyvault/issues) with steps to reproduce
2. **Suggest features** — Describe the problem you're solving and your proposed approach
3. **Submit code** — Fork the repo, create a branch, and [open a PR](https://github.com/AdrianBonpin/deckyvault/pulls)

### Guidelines

- Follow existing code patterns and TypeScript conventions
- Run `bun run lint` and `bun run build` before submitting
- Keep PRs focused — one feature or fix per PR
- Include screenshots for UI changes

## License

MIT

## Acknowledgements

Built with love for the Steam Deck community.

Created by [Adrian Bonpin](https://grounds.ph).

---

*DeckyVault is an independent project and is not affiliated with Valve Corporation.*