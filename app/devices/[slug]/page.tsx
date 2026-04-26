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
