import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { NonSteamWizard } from "@/components/wizard/non-steam-wizard"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Add Non-Steam Game",
}

export default async function AddGamePage() {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Add a Game</h1>
        <p className="text-sm text-text/60">
          Add a non-Steam game to DeckyVault. Search for cover art, set platform support, and submit.
        </p>
      </div>
      <NonSteamWizard />
    </div>
  )
}
