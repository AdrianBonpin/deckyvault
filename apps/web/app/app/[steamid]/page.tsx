import { permanentRedirect } from "next/navigation"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ steamid: string }>
}

export default async function AppRedirectPage({ params }: Props) {
  const { steamid } = await params
  permanentRedirect(`/game/${steamid}`)
}

export const dynamic = "force-dynamic"

export function generateMetadata({ params }: Props): Metadata {
  return {
    robots: { index: false, follow: false },
  }
}