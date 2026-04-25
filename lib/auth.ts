import { betterAuth } from 'better-auth'
import { admin, emailOTP, lastLoginMethod } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db/index'

export const auth = betterAuth({
    experimental: { joins: true },
    database: drizzleAdapter(db, {
        provider: 'pg'
    }),
    plugins: [
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                if (type === 'sign-in') {
                    // TODO: send the OTP to the user's email address
                } else if (type === 'email-verification') {
                    // TODO: send the OTP to the user's email address for email verification
                } else {
                    // TODO: send the OTP to the user's email address for password reset
                }
            }
        }),
        passkey(),
        lastLoginMethod(),
        admin()
    ],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID || "",
            clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
        },
    },
    trustedOrigins: [process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:3000"],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 15 * 60,
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ['google', 'discord'],
            allowDifferentEmails: true
        }
    }
})