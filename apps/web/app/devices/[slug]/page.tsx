import { db } from "@/lib/db/index"
import { hardware } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { DeviceDetailClient } from "./device-detail-client"
import type { Metadata } from "next"

export const revalidate = 3600

export async function generateStaticParams() {
  try {
    const devices = await db
      .select({ slug: hardware.slug })
      .from(hardware)
    return devices.map((d) => ({ slug: d.slug }))
  } catch {
    // DB unreachable during build (e.g. Docker builder without network access).
    // Return empty — pages will be generated on first request via ISR.
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const [device] = await db
    .select({
      name: hardware.name,
      deviceType: hardware.deviceType,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) return { title: "Device Not Found — DeckyVault" }

  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"

  return {
    title: `${device.name} — DeckyVault`,
    description: `Benchmark data, FPS stats, and performance analysis for the ${device.name} (${typeLabel}) on DeckyVault.`,
    keywords: [
      device.name.toLowerCase(),
      device.deviceType,
      "benchmarks",
      "FPS",
      "performance",
      "steam deck",
    ],
    alternates: { canonical: `https://deckyvault.xyz/devices/${slug}` },
    openGraph: {
      title: `${device.name} — DeckyVault`,
      description: `Benchmark data and performance stats for ${device.name} on DeckyVault.`,
      url: `https://deckyvault.xyz/devices/${slug}`,
      siteName: "DeckyVault",
      type: "website",
      images: [
        {
          url: `/devices/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${device.name} — DeckyVault`,
      description: `Benchmark data and performance stats for ${device.name} on DeckyVault.`,
      images: [`/devices/${slug}/opengraph-image`],
    },
  }
}

export default async function DevicePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [device] = await db
    .select({
      slug: hardware.slug,
      name: hardware.name,
      deviceType: hardware.deviceType,
      image: hardware.image,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) {
    notFound()
  }

  const allDevices = await db
    .select({ slug: hardware.slug })
    .from(hardware)
    .orderBy(hardware.sortOrder)
  const deviceColorIndex = allDevices.findIndex((d) => d.slug === slug)

  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: device.name,
    category: typeLabel,
    url: `https://deckyvault.xyz/devices/${device.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DeviceDetailClient
        device={{
          slug: device.slug,
          name: device.name,
          deviceType: device.deviceType,
          image: device.image,
          colorIndex: deviceColorIndex,
        }}
      />
    </>
  )
}
