<div align="center">

# DeckyVault

**The community-driven database for Steam Deck performance data, settings, and compatibility.**

[![Live Site](https://img.shields.io/badge/Live-deckyvault.xyz-eb3779?style=flat-square)](https://deckyvault.xyz)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#license)

</div>

---

DeckyVault is an open-source platform where the Steam Deck community shares real-world performance benchmarks, optimized game settings, and compatibility reports. Every data point comes from actual players — not spec sheets.

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
│  better-auth (Google + Discord OAuth, Passkeys)  │
│  AWS S3 (file storage) · Resend (email)          │
└─────────────────────────────────────────────────┘
```

The API layer uses [Elysia](https://elysiajs.com) mounted as a catch-all Next.js route handler at `app/api/[[...slugs]]/route.ts`. All route modules live in `lib/api/` and are composed into a single Elysia app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | [React 19](https://react.dev) · [Tailwind CSS v4](https://tailwindcss.com) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| API | [Elysia](https://elysiajs.com) |
| Database | [PostgreSQL](https://www.postgresql.org) · [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [better-auth](https://better-auth.com) (Google, Discord, Passkeys, OTP) |
| Editor | [Tiptap](https://tiptap.dev) (rich text) |
| Animations | [Motion](https://motion.dev) |
| Charts | [ECharts](https://echarts.apache.org) |
| Storage | [AWS S3](https://aws.amazon.com/s3/) |
| Email | [Resend](https://resend.com) |
| Runtime | [Bun](https://bun.sh) |

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
cp .env.example .env.local
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
bun run dev
```

Open [https://localhost:3000](https://localhost:3000) (self-signed HTTPS via `--experimental-https`).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with HTTPS |
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

## Project Structure

```
deckyvault/
├── app/
│   ├── (auth)/              # Auth pages (sign-in, reset password)
│   ├── (manage)/manage/     # Admin dashboard
│   │   ├── benchmarks/      # Benchmark moderation
│   │   ├── comments/        # Comment moderation
│   │   ├── games/           # Game management & sync
│   │   ├── hardware/        # Hardware management
│   │   ├── reports/         # Report moderation
│   │   └── users/           # User management
│   ├── api/[[...slugs]]/    # Elysia API catch-all
│   ├── compare/             # Side-by-side game comparison
│   ├── game/[id]/           # Individual game page
│   ├── games/               # Games listing
│   ├── devices/             # Hardware device pages
│   ├── profile/             # User profiles
│   └── search/              # Unified search
├── components/
│   ├── auth/                # Auth-related components
│   ├── charts/              # ECharts wrappers
│   ├── comments/            # CommentSection, CommentItem
│   ├── manage/              # Admin sidebar
│   ├── profile/             # Settings tabs
│   └── wizard/              # Contribution wizard
├── lib/
│   ├── api/                 # 24 Elysia route modules
│   ├── auth.ts              # better-auth server config
│   ├── auth-client.ts       # better-auth client
│   ├── db/
│   │   ├── schema/          # 9 Drizzle schema files
│   │   ├── index.ts         # DB connection
│   │   └── seed.ts          # Database seeder
│   ├── hooks/               # Custom React hooks
│   └── steam/               # Steam API integration
├── drizzle/                 # Generated migrations
├── docs/superpowers/        # Plans & specs
└── public/                  # Static assets
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
