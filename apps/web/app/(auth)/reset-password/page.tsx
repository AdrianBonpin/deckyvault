import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/reset-password-form"
import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ email?: string }>
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
    const { email } = await searchParams

    if (!email) {
        redirect("/forgot-password")
    }

    return (
        <Suspense>
            <ResetPasswordForm email={email} />
        </Suspense>
    )
}
