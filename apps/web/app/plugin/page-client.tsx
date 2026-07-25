"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
    QrCodeIcon,
    GaugeIcon,
    UploadIcon,
    Gamepad2Icon,
    ShieldCheckIcon,
    ZapIcon,
    DownloadIcon,
    TerminalIcon,
    ArrowRightIcon,
    CopyIcon,
    CheckIcon,
    CodeIcon,
    SettingsIcon,
    FolderArchiveIcon,
} from "lucide-react"

// ── Screenshot slots ────────────────────────────────────────────
// Each screenshot is a self-contained card. Until you drop real
// screenshots into /public/plugin/ and set showScreenshot=true, a
// styled placeholder describing the exact shot to capture is shown.
interface Shot {
    id: string
    title: string
    caption: string
    // filename the user should save the capture as (in /public/plugin/)
    file: string
    // true = present as a device photo (rounded, shadow) instead of a flat
    // screenshot. Use for in-game shots where the QAM overlay can't be
    // captured by Steam's screenshot shortcut, so a phone photo is used.
    photo?: boolean
}

const SCREENSHOTS: Shot[] = [
    {
        id: "developer-mode",
        title: "Enable Developer mode",
        caption:
            "In the Decky menu → General, toggle on Developer mode. This unlocks the 'Install Plugin from ZIP File' option in the Developer tab.",
        file: "developer-mode.jpg",
    },
    {
        id: "zip-file",
        title: "Install from the ZIP",
        caption:
            "Switch to the Developer tab, tap Browse under 'Install Plugin from ZIP File', and pick the DeckyVault ZIP you just downloaded.",
        file: "zip-file.jpg",
    },
    {
        id: "panel-overview",
        title: "The plugin panel",
        caption:
            "The full DeckyVault panel in the Quick Access Menu — recording, account, and setup sections all in one scrollable view.",
        file: "panel-overview.jpg",
    },
    {
        id: "pair-qr",
        title: "Pair with your phone",
        caption:
            "Tap 'Pair with Phone' and a QR code appears. Scan it with your phone, confirm on deckyvault.xyz, and your account links automatically — no copy-pasting API keys.",
        file: "pair-qr.jpg",
    },
    {
        id: "launch-option",
        title: "Add the launch option",
        caption:
            "In Steam, right-click your game → Properties → Launch Options, and paste the MangoHud wrapper command. Copy it straight from the plugin.",
        file: "launch-option.jpg",
    },
    {
        id: "recording",
        title: "Record while you play",
        caption:
            "Once in-game, open the panel and hit Start Recording. A live timer tracks your session. Stop when you're done benchmarking.",
        file: "recording.jpg",
        photo: true,
    },
    {
        id: "session-form",
        title: "Review & submit",
        caption:
            "After stopping, review the captured FPS, 1% lows, and power draw. Add notes, then upload straight to DeckyVault — or export to a file.",
        file: "session-form.jpg",
        photo: true,
    },
    {
        id: "entry-live",
        title: "See it on DeckyVault",
        caption:
            "Your submission appears on the game's page instantly — FPS averages, frame-time consistency, and TDP, all tied to your account.",
        file: "entry-live.jpg",
    },
]

// Screenshot files that actually exist in /public/plugin/ — flip these
// to true once you've captured and saved the corresponding file.
const HAS_SCREENSHOT: Record<string, boolean> = {
    "developer-mode": true,
    "zip-file": true,
    "panel-overview": true,
    "pair-qr": true,
    "launch-option": true,
    recording: true,
    "session-form": true,
    "entry-live": true,
}

const LAUNCH_COMMAND = "~/deckyvault-mangohud.sh %command%"

const FEATURES = [
    {
        icon: GaugeIcon,
        title: "Capture real gameplay",
        body: "Records FPS, frame times, and 1% lows with MangoHud — not synthetic benchmarks, but how the game actually runs on your Deck.",
    },
    {
        icon: ZapIcon,
        title: "Power draw & TDP",
        body: "Measures CPU + GPU power and adds peripheral overhead (screen, fan, speakers) for a realistic estimate of total system draw.",
    },
    {
        icon: QrCodeIcon,
        title: "QR-code pairing",
        body: "Link the plugin to your DeckyVault account by scanning a QR code with your phone. No manual key entry, no fiddly typing.",
    },
    {
        icon: UploadIcon,
        title: "One-tap upload",
        body: "Submit entries straight to DeckyVault from the Quick Access Menu. They appear on the game's page instantly, tied to your profile.",
    },
    {
        icon: Gamepad2Icon,
        title: "Auto game detection",
        body: "Detects the running game and its Steam App ID, reads the Proton version, and resolves the game name automatically.",
    },
    {
        icon: ShieldCheckIcon,
        title: "Your key, your control",
        body: "Pairing creates a real API key you can view and revoke anytime from Settings → API Keys. Nothing is stored without your say-so.",
    },
]

const STEPS = [
    {
        icon: DownloadIcon,
        title: "Install Decky Loader",
        body: (
            <>
                If you haven&apos;t, install{" "}
                <a
                    href="https://github.com/SteamDeckHomebrew/decky-loader"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                >
                    Decky Loader
                </a>{" "}
                on your Steam Deck — it&apos;s a one-time prerequisite that adds
                the Quick Access Menu plugin browser.
            </>
        ),
    },
    {
        icon: SettingsIcon,
        title: "Enable Developer mode",
        body: (
            <>
                In the QAM, open the <strong>Decky</strong> settings →
                <strong> General</strong>, and flip on{" "}
                <strong>Developer mode</strong>. This unlocks the
                &quot;Install Plugin from ZIP File&quot; option in the Developer
                tab.
            </>
        ),
    },
    {
        icon: FolderArchiveIcon,
        title: "Install from the ZIP",
        body: (
            <>
                Download{" "}
                <a
                    href="https://github.com/AdrianBonpin/deckyvault/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                >
                    the latest plugin ZIP
                </a>{" "}
                from GitHub Releases. Then in QAM → <strong>Decky</strong> →
                <strong> Developer</strong> → <strong>Install Plugin from ZIP
                File</strong> → <strong>Browse</strong>, pick the ZIP and let
                Decky Loader do the rest.
            </>
        ),
    },
    {
        icon: QrCodeIcon,
        title: "Pair your account",
        body: (
            <>
                Open the plugin in the Quick Access Menu → <strong>Account</strong> →{" "}
                <strong>Pair with Phone</strong>. Scan the QR code with your phone
                and confirm on deckyvault.xyz. Your API key is created and saved
                automatically.
            </>
        ),
    },
    {
        icon: TerminalIcon,
        title: "Set the launch option",
        body: (
            <>
                In <strong>MangoHud Setup</strong>, tap <strong>Write Config</strong>.
                Then add the launch option to your game (Steam → right-click →
                Properties → Launch Options):
            </>
        ),
        code: LAUNCH_COMMAND,
    },
    {
        icon: GaugeIcon,
        title: "Record & upload",
        body: (
            <>
                Launch the game, open the panel, and hit <strong>Start Recording</strong>{" "}
                once you&apos;re in-game. When you&apos;re done, stop it, review the
                stats, and <strong>upload to DeckyVault</strong>.
            </>
        ),
    },
]

// ── Screenshot acts ────────────────────────────────────
// The "See it in action" gallery is structured as a 4-act narrative so the
// story flows: Install → Set up → Capture → Share. Each act has a heading +
// a list of shots. The last act's shot is rendered larger as a visual payoff.
const ACTS: {
    number: string
    title: string
    subtitle: string
    shotIds: string[]
    layout: "grid-3" | "grid-2" | "feature"
}[] = [
    {
        number: "1",
        title: "Install the plugin",
        subtitle: "Enable Developer mode and load the ZIP from the Decky menu.",
        shotIds: ["developer-mode", "zip-file"],
        layout: "grid-2",
    },
    {
        number: "2",
        title: "Get set up",
        subtitle: "Pair your account and add the MangoHud launch option.",
        shotIds: ["panel-overview", "pair-qr", "launch-option"],
        layout: "grid-3",
    },
    {
        number: "3",
        title: "Capture performance",
        subtitle: "Hit record, play, then review your stats.",
        shotIds: ["recording", "session-form"],
        layout: "grid-2",
    },
    {
        number: "4",
        title: "Share & compare",
        subtitle: "Your entry appears on the game's page for the community.",
        shotIds: ["entry-live"],
        layout: "feature",
    },
]

export function PluginPageClient() {
    const [copied, setCopied] = useState(false)

    async function copyCommand() {
        try {
            await navigator.clipboard.writeText(LAUNCH_COMMAND)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // ignore
        }
    }

    return (
        <div className="min-h-screen">
            {/* ── Hero ────────────────────────────────────────────── */}
            <section className="relative overflow-hidden px-4 md:px-[10svw] pt-16 pb-12 md:pt-24 md:pb-20">
                <div
                    className="absolute inset-0 -z-10 opacity-40"
                    style={{
                        background:
                            "radial-gradient(60% 50% at 50% 0%, rgba(27,155,243,0.25) 0%, transparent 70%)",
                    }}
                />
                <div className="max-w-5xl mx-auto flex flex-col items-center text-center gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium"
                    >
                        <Gamepad2Icon className="h-3.5 w-3.5" />
                        Decky Loader Plugin · v1.1.0
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="text-3xl md:text-5xl font-bold tracking-tight"
                    >
                        Benchmark your Steam Deck,{" "}
                        <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                            straight from the Quick Access Menu
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-base md:text-lg text-text/60 max-w-2xl"
                    >
                        The DeckyVault plugin captures real-world FPS, frame times,
                        and power draw with MangoHud — then uploads them to
                        DeckyVault with a single tap. No spreadsheets, no manual
                        screenshots, no fuss.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="flex flex-col sm:flex-row gap-3 mt-2"
                    >
                        <a
                            href="https://github.com/AdrianBonpin/deckyvault/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            <DownloadIcon className="h-4 w-4" />
                            Download Plugin ZIP
                        </a>
                        <Link
                            href="#install"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-text text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
                        >
                            Installation Guide
                            <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* ── Features grid ────────────────────────────────────── */}
            <section className="px-4 md:px-[10svw] py-12 md:py-16">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                        Built for the Steam Deck
                    </h2>
                    <p className="text-text/50 text-center mb-10 max-w-xl mx-auto">
                        Everything you need to capture and share performance data,
                        designed around the Deck&apos;s controller-friendly UI.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-xl border border-border bg-text/2 p-5 flex flex-col gap-3"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <f.icon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-semibold text-sm">{f.title}</h3>
                                <p className="text-sm text-text/55 leading-relaxed">
                                    {f.body}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works (steps) ─────────────────────────────── */}
            <section
                id="install"
                className="px-4 md:px-[10svw] py-12 md:py-16 border-t border-border"
            >
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                        How it works
                    </h2>
                    <p className="text-text/50 text-center mb-12 max-w-xl mx-auto">
                        Six steps from install to your first uploaded benchmark.
                    </p>

                    <div className="flex flex-col gap-6">
                        {STEPS.map((step, i) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, x: -16 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex gap-4 md:gap-6"
                            >
                                <div className="flex flex-col items-center shrink-0">
                                    <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                        {i + 1}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className="w-px flex-1 bg-border mt-2 min-h-[24px]" />
                                    )}
                                </div>
                                <div className="flex-1 pb-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <step.icon className="h-4 w-4 text-primary" />
                                        <h3 className="font-semibold">{step.title}</h3>
                                    </div>
                                    <p className="text-sm text-text/60 leading-relaxed mb-3">
                                        {step.body}
                                    </p>
                                    {step.code && (
                                        <div className="flex items-center gap-2 rounded-lg border border-border bg-text/5 p-3 max-w-md">
                                            <code className="flex-1 font-mono text-xs md:text-sm text-text/80 break-all">
                                                {step.code}
                                            </code>
                                            <button
                                                onClick={copyCommand}
                                                className="shrink-0 p-1.5 rounded hover:bg-text/10 text-text/50 hover:text-text transition-colors"
                                                title="Copy"
                                            >
                                                {copied ? (
                                                    <CheckIcon className="h-4 w-4 text-green-400" />
                                                ) : (
                                                    <CopyIcon className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── See it in action: 3-act narrative ──────────────────────── */}
            <section className="px-4 md:px-[10svw] py-12 md:py-20 border-t border-border">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2">
                            See it in action
                        </h2>
                        <p className="text-text/50 max-w-xl mx-auto">
                            A walkthrough of the plugin, from pairing to publishing.
                        </p>
                    </div>

                    <div className="flex flex-col gap-10 md:gap-14">
                        {ACTS.map((act, actIdx) => {
                            const shots = act.shotIds
                                .map((id) => SCREENSHOTS.find((s) => s.id === id))
                                .filter((s): s is (typeof SCREENSHOTS)[number] => Boolean(s))

                            return (
                                <div key={act.number} className="flex flex-col">
                                    {/* Act heading */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -12 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: actIdx * 0.05 }}
                                        className="flex items-center gap-3 mb-5"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                                            {act.number}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-lg md:text-xl font-semibold leading-tight">
                                                {act.title}
                                            </h3>
                                            <p className="text-sm text-text/50">
                                                {act.subtitle}
                                            </p>
                                        </div>
                                    </motion.div>

                                    {/* Shot grid for this act */}
                                    <div
                                        className={
                                            act.layout === "grid-3"
                                                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                                : act.layout === "grid-2"
                                                    ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                                                    : "grid grid-cols-1 gap-4"
                                        }
                                    >
                                        {shots.map((shot) => {
                                            const isFeature = act.layout === "feature"
                                            return (
                                                <motion.figure
                                                    key={shot.id}
                                                    initial={{ opacity: 0, y: 16 }}
                                                    whileInView={{ opacity: 1, y: 0 }}
                                                    viewport={{ once: true }}
                                                    className="rounded-xl border border-border bg-text/2 overflow-hidden flex flex-col hover:border-primary/30 transition-colors"
                                                >
                                                    <div
                                                        className={
                                                            isFeature
                                                                ? "relative aspect-[16/9] bg-gradient-to-br from-text/5 to-text/10 flex items-center justify-center p-4"
                                                                : "relative aspect-[16/10] bg-gradient-to-br from-text/5 to-text/10 flex items-center justify-center p-3"
                                                        }
                                                    >
                                                        {HAS_SCREENSHOT[shot.id] ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={`/plugin/${shot.file}`}
                                                                alt={shot.title}
                                                                className={shot.photo
                                                                    ? "max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/40 ring-1 ring-black/20"
                                                                    : isFeature
                                                                        ? "w-full h-full object-contain rounded-md"
                                                                        : "w-full h-full object-contain"}
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-text/30 p-6 text-center">
                                                                <Gamepad2Icon className="h-8 w-8 opacity-50" />
                                                                <span className="text-xs">
                                                                    {shot.photo ? "device photo" : "screenshot"} not yet captured
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <figcaption className="p-4 flex flex-col gap-1">
                                                        <div className="text-sm font-semibold">
                                                            {shot.title}
                                                        </div>
                                                        <p className="text-xs text-text/55 leading-relaxed">
                                                            {shot.caption}
                                                        </p>
                                                    </figcaption>
                                                </motion.figure>
                                            )
                                        })}
                                    </div>

                                    {/* Flow arrow between acts */}
                                    {actIdx < ACTS.length - 1 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            whileInView={{ opacity: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: actIdx * 0.05 + 0.1 }}
                                            className="flex justify-center mt-8 md:mt-10"
                                        >
                                            <div className="w-px h-8 md:h-10 bg-gradient-to-b from-primary/40 to-primary/10" />
                                        </motion.div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ── Install CTA ──────────────────────────────────────── */}
            <section className="px-4 md:px-[10svw] py-12 md:py-20 border-t border-border">
                <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-text/2 p-8 md:p-10 flex flex-col items-center text-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <DownloadIcon className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold">
                        Ready to start benchmarking?
                    </h2>
                    <p className="text-text/60 max-w-md text-sm">
                        Download the plugin ZIP and install it via Decky Loader&apos;s{" "}
                        <em>Install Plugin from ZIP File</em> option, or grab it from
                        URL.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a
                            href="https://github.com/AdrianBonpin/deckyvault/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            <DownloadIcon className="h-4 w-4" />
                            Download ZIP
                        </a>
                        <a
                            href="https://github.com/AdrianBonpin/deckyvault"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-text text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
                        >
                            <CodeIcon className="h-4 w-4" />
                            View Source
                        </a>
                    </div>
                </div>
            </section>
        </div>
    )
}