import { z } from "zod"
import { isDeckyVaultEmail, DOMAIN_BLOCK_ERROR } from "./domain-block"

export const loginEmailSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

export const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
})

export const signupSchema = z
    .object({
        name: z
            .string()
            .min(1, "Name is required")
            .max(100, "Name must be 100 characters or less"),
        email: z.string().email("Please enter a valid email address"),
        password: z
            .string()
            .min(10, "Password must be at least 10 characters"),
    })
    .refine(
        (data) =>
            process.env.NODE_ENV === "development" ||
            !isDeckyVaultEmail(data.email),
        {
            message: DOMAIN_BLOCK_ERROR,
            path: ["email"],
        },
    )

export const otpSchema = z.object({
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
})

export const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

export const resetPasswordSchema = z
    .object({
        otp: z.string().length(6, "OTP must be exactly 6 digits"),
        newPassword: z
            .string()
            .min(10, "Password must be at least 10 characters"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })

export type LoginEmailInput = z.infer<typeof loginEmailSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type OtpInput = z.infer<typeof otpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
