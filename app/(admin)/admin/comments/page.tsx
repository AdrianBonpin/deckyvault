import type { Metadata } from "next"
import { CommentsClient } from "./comments-client"

export const metadata: Metadata = {
  title: "Comments",
}

export default function CommentsPage() {
  return <CommentsClient />
}
