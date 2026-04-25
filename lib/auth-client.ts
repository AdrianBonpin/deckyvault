import { createAuthClient } from 'better-auth/client'
import { adminClient, emailOTPClient, lastLoginMethodClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:3000",
    plugins: [
        emailOTPClient(),
        passkeyClient(),
        lastLoginMethodClient(),
        adminClient()
    ]
})

export const { signIn, signOut, signUp, getSession, useSession } = authClient