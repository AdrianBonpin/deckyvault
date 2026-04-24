# DeckyVault

An open-source, community-driven database for Steam Deck (OLED & LCD) and Steam Machine compatibility, performance metrics, and settings.

[//]: # "Add shields here if available: e.g., license, contributors, last commit"

## Why DeckyVault?

Gaming on the Steam Deck is incredible, but finding reliable, detailed answers about whether a game will run well—or how to optimize it—can be frustrating. Existing resources are often fragmented, outdated, or lack the depth the community needs.

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

- **[Next.js](https://nextjs.org)** — React framework for production
- **[React](https://react.dev)** — UI library
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling *(verify in your local setup)*

## Getting Started

First, clone the repository and install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the pages by modifying files in the `app/` directory. The page auto-updates as you edit the file.

## Contributing

We welcome contributions of all kinds! Whether you want to:

- Suggest a new feature
- Report a bug
- Improve the design
- Contribute code

Feel free to open an [issue](../../issues) or submit a [pull request](../../pulls).

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
