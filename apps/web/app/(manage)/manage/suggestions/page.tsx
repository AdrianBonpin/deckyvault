import type { Metadata } from "next"
import { SuggestionsClient } from "./suggestions-client"

export const metadata: Metadata = {
  title: "Suggestions",
}

export default function SuggestionsPage() {
  return <SuggestionsClient />
}
