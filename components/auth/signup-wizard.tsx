"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import StepIndicator from "./step-indicator"
import SignupFormStep from "./signup-form-step"
import OtpVerificationStep from "./otp-verification-step"
import PasskeySetupStep from "./passkey-setup-step"

export default function SignupWizard() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const stepParam = searchParams.get("step")

    const [step, setStep] = useState<1 | 2 | 3>(() => {
        if (stepParam === "otp") return 2
        if (stepParam === "passkey") return 3
        return 1
    })
    const [email, setEmail] = useState("")

    // Update URL when step changes
    useEffect(() => {
        const params = new URLSearchParams()
        if (step === 2) params.set("step", "otp")
        if (step === 3) params.set("step", "passkey")
        const query = params.toString()
        router.replace(`/signup${query ? `?${query}` : ""}`, {
            scroll: false,
        })
    }, [step, router])

    const handleSignupSuccess = (userEmail: string) => {
        setEmail(userEmail)
        setStep(2)
    }

    const handleOtpSuccess = () => {
        setStep(3)
    }

    const handlePasskeyComplete = () => {
        router.push("/")
    }

    const handlePasskeySkip = () => {
        router.push("/")
    }

    return (
        <div className="space-y-5">
            <StepIndicator currentStep={step} totalSteps={3} />

            {step === 1 && (
                <SignupFormStep onSuccess={handleSignupSuccess} />
            )}

            {step === 2 && (
                <OtpVerificationStep
                    email={email}
                    onSuccess={handleOtpSuccess}
                    onBack={() => setStep(1)}
                />
            )}

            {step === 3 && (
                <PasskeySetupStep
                    onSuccess={handlePasskeyComplete}
                    onSkip={handlePasskeySkip}
                />
            )}
        </div>
    )
}
