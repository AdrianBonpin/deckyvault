import type { Metadata } from "next"
import { StorageClient } from "./storage-client"

export const metadata: Metadata = {
  title: "Storage",
}

export default function StoragePage() {
  return <StorageClient />
}
