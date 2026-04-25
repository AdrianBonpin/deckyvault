import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { eq } from "drizzle-orm"
import { hardware } from "./schema/hardware"
import { settingCategories } from "./schema/settingCategories"
import { settingDefinitions } from "./schema/settingDefinitions"

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
      deviceType: "handled" as const,
      sortOrder: 0,
    },
    {
      slug: "steamdeck-lcd",
      name: "Steam Deck LCD",
      deviceType: "handled" as const,
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

  // ── Setting Categories ────────────────────────────────────────────
  console.log("Seeding setting categories...")

  const categories = [
    { name: "Graphics", slug: "graphics", sortOrder: 0 },
    { name: "Display", slug: "display", sortOrder: 1 },
    { name: "Audio", slug: "audio", sortOrder: 2 },
    { name: "Controls", slug: "controls", sortOrder: 3 },
    { name: "Gameplay", slug: "gameplay", sortOrder: 4 },
  ]

  const insertedCategories: Record<string, string> = {} // slug → id

  for (const cat of categories) {
    const [inserted] = await db
      .insert(settingCategories)
      .values(cat)
      .onConflictDoNothing({ target: settingCategories.slug })
      .returning()

    if (inserted) {
      insertedCategories[cat.slug] = inserted.id
    } else {
      // Fetch existing
      const existing = await db
        .select()
        .from(settingCategories)
        .where(eq(settingCategories.slug, cat.slug))
        .limit(1)
      if (existing[0]) {
        insertedCategories[cat.slug] = existing[0].id
      }
    }
  }

  console.log(`Seeded ${categories.length} setting categories.`)

  // ── Setting Definitions ──────────────────────────────────────────
  console.log("Seeding setting definitions...")

  const definitions = [
    // Graphics
    {
      categorySlug: "graphics",
      name: "Resolution",
      slug: "resolution",
      inputType: "select" as const,
      options: ["720p", "800p", "1080p", "1200p", "1440p", "4K"],
      impactLevel: "major" as const,
      sortOrder: 0,
    },
    {
      categorySlug: "graphics",
      name: "Texture Quality",
      slug: "texture-quality",
      inputType: "select" as const,
      options: ["Low", "Medium", "High", "Ultra"],
      impactLevel: "major" as const,
      sortOrder: 1,
    },
    {
      categorySlug: "graphics",
      name: "Shadow Quality",
      slug: "shadow-quality",
      inputType: "select" as const,
      options: ["Off", "Low", "Medium", "High", "Ultra"],
      impactLevel: "major" as const,
      sortOrder: 2,
    },
    {
      categorySlug: "graphics",
      name: "Anti-Aliasing",
      slug: "anti-aliasing",
      inputType: "select" as const,
      options: ["Off", "FXAA", "TAA", "MSAA 2x", "MSAA 4x"],
      impactLevel: "moderate" as const,
      sortOrder: 3,
    },
    {
      categorySlug: "graphics",
      name: "Volumetric Fog",
      slug: "volumetric-fog",
      inputType: "toggle" as const,
      options: null,
      impactLevel: "moderate" as const,
      sortOrder: 4,
    },
    {
      categorySlug: "graphics",
      name: "Motion Blur",
      slug: "motion-blur",
      inputType: "toggle" as const,
      options: null,
      impactLevel: "minor" as const,
      sortOrder: 5,
    },
    // Display
    {
      categorySlug: "display",
      name: "Refresh Rate",
      slug: "refresh-rate",
      inputType: "select" as const,
      options: ["30Hz", "40Hz", "60Hz", "90Hz", "120Hz"],
      impactLevel: "moderate" as const,
      sortOrder: 0,
    },
    {
      categorySlug: "display",
      name: "V-Sync",
      slug: "v-sync",
      inputType: "toggle" as const,
      options: null,
      impactLevel: "moderate" as const,
      sortOrder: 1,
    },
    {
      categorySlug: "display",
      name: "Frame Rate Limit",
      slug: "frame-rate-limit",
      inputType: "range" as const,
      options: { min: 15, max: 120, step: 5 },
      impactLevel: "minor" as const,
      sortOrder: 2,
    },
    // Audio
    {
      categorySlug: "audio",
      name: "Master Volume",
      slug: "master-volume",
      inputType: "range" as const,
      options: { min: 0, max: 100, step: 5 },
      impactLevel: "minor" as const,
      sortOrder: 0,
    },
    {
      categorySlug: "audio",
      name: "SFX Volume",
      slug: "sfx-volume",
      inputType: "range" as const,
      options: { min: 0, max: 100, step: 5 },
      impactLevel: "minor" as const,
      sortOrder: 1,
    },
    {
      categorySlug: "audio",
      name: "Music Volume",
      slug: "music-volume",
      inputType: "range" as const,
      options: { min: 0, max: 100, step: 5 },
      impactLevel: "minor" as const,
      sortOrder: 2,
    },
    // Controls
    {
      categorySlug: "controls",
      name: "Controller Vibration",
      slug: "controller-vibration",
      inputType: "toggle" as const,
      options: null,
      impactLevel: "minor" as const,
      sortOrder: 0,
    },
    {
      categorySlug: "controls",
      name: "Aim Sensitivity",
      slug: "aim-sensitivity",
      inputType: "range" as const,
      options: { min: 1, max: 10, step: 1 },
      impactLevel: "minor" as const,
      sortOrder: 1,
    },
    // Gameplay
    {
      categorySlug: "gameplay",
      name: "Difficulty",
      slug: "difficulty",
      inputType: "select" as const,
      options: ["Easy", "Normal", "Hard", "Extreme"],
      impactLevel: "minor" as const,
      sortOrder: 0,
    },
  ]

  let definitionCount = 0
  for (const def of definitions) {
    const categoryId = insertedCategories[def.categorySlug]
    if (!categoryId) continue

    await db
      .insert(settingDefinitions)
      .values({
        categoryId,
        name: def.name,
        slug: def.slug,
        inputType: def.inputType,
        options: def.options,
        impactLevel: def.impactLevel,
        sortOrder: def.sortOrder,
      })
      .onConflictDoNothing({ target: settingDefinitions.slug })

    definitionCount++
  }

  console.log(`Seeded ${definitionCount} setting definitions.`)

  await pool.end()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
