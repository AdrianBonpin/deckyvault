import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact & Report",
  description: "Report issues, suggest features, or send feedback to the DeckyVault team.",
  robots: { index: false, follow: true },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
