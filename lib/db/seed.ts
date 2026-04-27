import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { hardware } from "./schema/hardware"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool)

async function seed() {
  // ── Hardware ──────────────────────────────────────────────────────
  console.log("Seeding hardware table...")

  const devices = [
    {
      slug: "steamdeck-oled",
      name: "Steam Deck OLED",
      deviceType: "handheld" as const,
      sortOrder: 0,
    },
    {
      slug: "steamdeck-lcd",
      name: "Steam Deck LCD",
      deviceType: "handheld" as const,
      sortOrder: 1,
    },
    {
      slug: "steam-machine",
      name: "Steam Machine",
      deviceType: "console" as const,
      sortOrder: 2,
    },
  ]

  for (const device of devices) {
    await db
      .insert(hardware)
      .values(device)
      .onConflictDoNothing({ target: hardware.slug })
  }

  console.log(`Seeded ${devices.length} hardware devices.`)
  await pool.end()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
