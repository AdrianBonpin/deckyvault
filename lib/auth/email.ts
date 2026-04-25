export const OTP_EXPIRY_SECONDS = 300

type OTPParams = {
  email: string
  otp: string
  type: "sign-in" | "email-verification" | "forget-password" | "change-email"
}

const subjects: Record<OTPParams["type"], string> = {
  "sign-in": "Sign in to DeckyVault",
  "email-verification": "Verify your DeckyVault email",
  "forget-password": "Reset your DeckyVault password",
  "change-email": "Change your DeckyVault email",
}

export async function sendOTP({ email, otp, type }: OTPParams) {
  const subject = subjects[type]

  // If RESEND_API_KEY is set, use Resend. Otherwise, log to console in dev.
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "DeckyVault <noreply@deckyvault.xyz>",
        to: email,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
            <h2 style="color: #eb3779;">${subject}</h2>
            <p>Your verification code is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #571b8b;">${otp}</p>
            <p style="color: #666; font-size: 14px;">This code expires in ${OTP_EXPIRY_SECONDS / 60} minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      })
    } catch (error) {
      console.error("[EMAIL OTP] Failed to send via Resend:", error)
      throw new Error("Failed to send verification email")
    }
  } else if (process.env.NODE_ENV === "development") {
    console.log(`[EMAIL OTP] To: ${email} | Type: ${type} | OTP: ${otp}`)
  } else {
    throw new Error("RESEND_API_KEY is not configured")
  }
}
