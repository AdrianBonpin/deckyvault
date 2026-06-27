import { createAuthClient } from 'better-auth/react'
import { adminClient, emailOTPClient, lastLoginMethodClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'
import { apiKeyClient } from '@better-auth/api-key/client'

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
    plugins: [
        emailOTPClient(),
        passkeyClient(),
        lastLoginMethodClient(),
        adminClient(),
        apiKeyClient(),
    ]
})

export const { signIn, signOut, signUp, getSession, useSession } = authClient