import { AdminSidebar } from "@/components/admin/admin-sidebar"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: {
        template: "%s | Admin — DeckyVault",
        default: "Admin — DeckyVault",
    },
    robots: { index: false, follow: false },
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <section className='w-full flex flex-col gap-8 py-16'>
            <div className='px-4 md:px-[10svw]'>
                <div className='max-w-7xl mx-auto'>
                    <h1 className='text-2xl sm:text-3xl font-bold'>Admin</h1>
                    <p className='text-sm text-text/60 mt-1'>
                        Manage users, hardware, and games
                    </p>
                </div>
            </div>

            <div className='px-4 md:px-[10svw]'>
                <div className='max-w-7xl mx-auto flex flex-col md:flex-row gap-6'>
                    <AdminSidebar />
                    <div className='flex-1 min-w-0'>{children}</div>
                </div>
            </div>
        </section>
    )
}
