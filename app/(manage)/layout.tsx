import { ManageSidebar } from "@/components/manage/manage-sidebar"
import { auth } from "@/lib/auth"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
    title: {
        template: "%s | Manage — DeckyVault",
        default: "Manage — DeckyVault",
    },
    robots: { index: false, follow: false },
}

export default async function ManageLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    const role = session?.user?.role ?? "user"
    if (role !== "moderator" && role !== "admin") {
        redirect("/")
    }
    return (
        <section className='w-full flex flex-col gap-8 py-16'>
            <div className='px-4 md:px-8 lg:px-12'>
                <div className='mx-auto'>
                    <h1 className='text-2xl sm:text-3xl font-bold'>Manage</h1>
                    <p className='text-sm text-text/60 mt-1'>
                        Manage your platform
                    </p>
                </div>
            </div>

            <div className='px-4 md:px-8 lg:px-12'>
                <div className='mx-auto flex flex-col md:flex-row gap-6'>
                    <ManageSidebar />
                    <div className='flex-1 min-w-0'>{children}</div>
                </div>
            </div>
        </section>
    )
}
