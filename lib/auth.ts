import { betterAuth } from 'better-auth'
import { admin, emailOTP, lastLoginMethod } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { expo } from '@better-auth/expo'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/lib/db/index'
import { ac, admin as adminRole, moderator, contributor, user } from '@/lib/auth/permissions'
import { sendOTP, OTP_EXPIRY_SECONDS } from '@/lib/auth/email'

// ── Origin setup ───────────────────────────────────────
// Web + mobile passkey origins
const webOrigin = process.env.BETTER_AUTH_URL ?? 'https://localhost:3000'
const appScheme = 'deckyvault://'

// Build trusted origins: web URL + app scheme + optional expo dev
const trustedOrigins = [
    webOrigin,
    appScheme,
]

// Add Expo dev URLs in development
if (process.env.NODE_ENV !== 'production') {
    trustedOrigins.push('exp://*')
    trustedOrigins.push('exp://192.168.*.*:*')
}

// Passkey origins: web URL + optional Android APK key hash
const passkeyOrigins = [
    webOrigin,
    ...(process.env.ANDROID_APK_KEY_HASH
        ? [`android:apk-key-hash:${process.env.ANDROID_APK_KEY_HASH}`]
        : []),
]

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
            origin: passkeyOrigins,
            advanced: {
                webAuthnChallengeCookie: 'better-auth-passkey',
            },
        }),
        lastLoginMethod({
            storeInDatabase: true,
        }),
        admin({
            ac,
            roles: {
                admin: adminRole,
                moderator,
                contributor,
                user,
            },
            defaultRole: 'user',
            adminRoles: ['admin'],
        }),
        expo(),
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
    trustedOrigins,
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
