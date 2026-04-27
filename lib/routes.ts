export const routes = [
    {
        title: "Home",
        href: "/",
    },
    {
        title: "Search",
        href: "/search",
    },
    {
        title: "Games",
        href: "/games",
    },
    // TODO: Add back when compare page is implemented
    // {
    //     title: "Compare",
    //     href: "/compare",
    // },
    {
        title: "Devices",
        href: "/devices",
    },
    {
        title: "Contact",
        href: "/contact",
    },
    // TODO: Add back when about page is implemented
    // {
    //     title: "About",
    //     href: "/about",
    // }
]

export const authRoutes = [
    {
        title: "Profile",
        href: "/profile",
        icon: "User",
    },
    {
        title: "Saved Games",
        href: "/profile?tab=saved",
        icon: "Bookmark",
    },
]

export const adminRoutes = [
    {
        title: "Users",
        href: "/admin/users",
        icon: "Users",
    },
    {
        title: "Hardware",
        href: "/admin/hardware",
        icon: "Cpu",
    },
    {
        title: "Games",
        href: "/admin/games",
        icon: "Gamepad2",
    },
]