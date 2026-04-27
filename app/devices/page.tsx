import { db } from "@/lib/db/index"
import { hardware } from "@/lib/db/schema"
import { DevicesPageClient } from "./page-client"

export const metadata = {
    title: "Devices — DeckyVault",
    description: "Browse handheld and console devices with benchmark data on DeckyVault",
    alternates: { canonical: "https://deckyvault.xyz/devices" },
}

export default async function DevicesPage() {
    const devices = await db.select({ slug: hardware.slug, name: hardware.name }).from(hardware)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: devices.map((d, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: d.name,
            url: `https://deckyvault.xyz/devices/${d.slug}`,
        })),
    }

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <DevicesPageClient />
        </>
    )
}
