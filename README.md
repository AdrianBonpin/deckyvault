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
