import type { Metadata } from "next"
import { HardwareClient } from "./hardware-client"

export const metadata: Metadata = {
  title: "Hardware",
}

export default function HardwarePage() {
  return <HardwareClient />
}
