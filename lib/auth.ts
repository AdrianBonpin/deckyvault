import { betterAuth } from 'better-auth'
import { admin, emailOTP, lastLoginMethod } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db/index'
import { ac, admin as adminRole, contributor, user } from '@/lib/auth/permissions'
import { sendOTP, OTP_EXPIRY_SECONDS } from '@/lib/auth/email'

export const auth = betterAuth({
    experimental: { joins: true },
    database: drizzleAdapter(db, {
        provider: 'pg'
    }),
    plugins: [
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                await sendOTP({ email, otp, type })
            },
            otpLength: 6,
            expiresIn: OTP_EXPIRY_SECONDS,
            allowedAttempts: 5,
        }),
        passkey({
            rpID: process.env.RP_ID ?? 'localhost',
            rpName: 'DeckyVault',
            origin: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
        }),
        lastLoginMethod({
            storeInDatabase: true,
        }),
        admin({
            ac,
            roles: {
                admin: adminRole,
                contributor,
                user,
            },
            defaultRole: 'user',
            adminRoles: ['admin'],
        }),
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
    },
    emailAndPassword: {
        enabled: true,
    },
})
