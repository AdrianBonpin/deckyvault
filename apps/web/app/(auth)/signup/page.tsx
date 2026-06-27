import { Suspense } from "react"
import SignupWizard from "@/components/auth/signup-wizard"

export default function SignupPage() {
    return (
        <Suspense>
            <SignupWizard />
        </Suspense>
    )
}
