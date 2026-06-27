import { betterAuth } from "better-auth"
import { testUtils } from "better-auth/plugins"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { db } from "@/lib/db/index"

export const testAuth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    testUtils({ captureOTP: true }),
  ],
  emailAndPassword: {
    enabled: true,
  },
})

export async function getTestHelpers() {
  const ctx = await testAuth.$context
  return ctx.test
}
