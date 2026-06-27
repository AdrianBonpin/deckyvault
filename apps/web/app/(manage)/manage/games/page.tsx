import type { Metadata } from "next"
import { GamesClient } from "./games-client"

export const metadata: Metadata = {
  title: "Games",
}

export default function GamesPage() {
  return <GamesClient />
}
