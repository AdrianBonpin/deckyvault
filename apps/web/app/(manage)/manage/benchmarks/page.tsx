import type { Metadata } from "next"
import { BenchmarksClient } from "./benchmarks-client"

export const metadata: Metadata = {
  title: "Benchmarks",
}

export default function BenchmarksPage() {
  return <BenchmarksClient />
}
