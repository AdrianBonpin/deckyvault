import { useEffect, useState, useRef } from "react"
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  DropdownItem,
  staticClasses,
} from "@decky/ui"
import {
  FaPlay,
  FaStop,
  FaClock,
  FaCopy,
  FaCheck,
  FaTimes,
  FaDownload,
  FaCog,
  FaFileExport,
  FaFileImport,
  FaSearch,
  FaQrcode,
  FaLink,
  FaMicrochip,
  FaGamepad,
  FaServer,
  FaWrench,
} from "react-icons/fa"
import type { RecordingState, SessionData, RecentSession, PluginSettings } from "../lib/store"
import { KNOWN_HARDWARE_SLUGS } from "@deckyvault/shared"
import {
  testApiKey,
  checkMangohud,
  writeMangohudConfig,
  getMangohudConfig,
  exportConfig,
  importConfig,
  initiatePair,
  checkPairStatus,
} from "../lib/api"
import { QRCodeSVG } from "qrcode.react"
import SessionForm from "./session-form"

interface MainPanelProps {
  recordingState: RecordingState
  session: SessionData
  recentSessions: RecentSession[]
  error: string
  settings: PluginSettings
  onStart: () => void
  onStop: () => void
  onUpdateSession: (updates: Partial<SessionData>) => void
  onAddToRecent: (sess: SessionData) => void
  onReset: () => void
  setError: (msg: string) => void
  setGameName: (name: string, appId?: number) => void
  onUpdateSetting: <K extends keyof PluginSettings>(key: K, value: string | null) => void
}

const HARDWARE_OPTIONS = [
  { label: "Auto-detect", data: "" },
  ...KNOWN_HARDWARE_SLUGS.map((slug) => ({ label: slug, data: slug })),
]

// ── Reusable layout helpers ─────────────────────────────────────
// Small, consistent building blocks so every section looks uniform.

const COLORS = {
  ok: "#2ecc71",
  err: "#e74c3c",
  accent: "#1b9bf3",
  muted: "rgba(255,255,255,0.55)",
  panel: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
}

/** Muted intro line shown directly under a PanelSection title. */
function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <PanelSectionRow>
      <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "2px 0 6px 0", lineHeight: "1.45", opacity: 0.6 }}>
        {children}
      </div>
    </PanelSectionRow>
  )
}

/** A labelled status row with a colored icon: ✓/✗ + label + value. */
function StatusRow({
  ok,
  label,
  value,
}: {
  ok: boolean | null
  label: string
  value?: string
}) {
  const icon = ok === null ? null : ok ? <FaCheck style={{ color: COLORS.ok }} /> : <FaTimes style={{ color: COLORS.err }} />
  return (
    <PanelSectionRow>
      <div className={staticClasses.Text} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "3px 0" }}>
        {icon}
        <span style={{ opacity: 0.7 }}>{label}</span>
        {value && <span style={{ fontWeight: 600 }}>{value}</span>}
      </div>
    </PanelSectionRow>
  )
}

/** A labelled key/value row used for system info (Game, App ID, etc). */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <PanelSectionRow>
      <div className={staticClasses.Text} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "3px 0" }}>
        <span style={{ opacity: 0.55, display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ opacity: 0.7, flexShrink: 0 }}>{label}</span>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </div>
    </PanelSectionRow>
  )
}

/** Standard centered icon+label content for ButtonItem. */
function BtnContent({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
      {icon}
      {label}
    </div>
  )
}

/** A numbered setup step with a circular badge. */
function SetupStep({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <PanelSectionRow>
      <div style={{ display: "flex", gap: "10px", padding: "5px 0", alignItems: "flex-start" }}>
        <div style={{
          flexShrink: 0,
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: COLORS.accent,
          color: "white",
          fontSize: "12px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {number}
        </div>
        <div className={staticClasses.Text} style={{ fontSize: "12px", lineHeight: "1.45", flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: "2px" }}>{title}</div>
          <div style={{ opacity: 0.7 }}>{body}</div>
        </div>
      </div>
    </PanelSectionRow>
  )
}

/** Monospace code block with optional copy button. */
function CodeBlock({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  return (
    <>
      <PanelSectionRow>
        <div style={{
          background: COLORS.panel,
          borderRadius: "8px",
          padding: "10px 14px",
          fontFamily: "monospace",
          fontSize: "13px",
          textAlign: "center",
          wordBreak: "break-all",
          border: `1px solid ${COLORS.border}`,
        }}>
          {value}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onCopy}>
          <BtnContent icon={<FaCopy />} label={copied ? "Copied to clipboard" : "Copy"} />
        </ButtonItem>
      </PanelSectionRow>
    </>
  )
}

export default function MainPanel({
  recordingState,
  session,
  recentSessions,
  error,
  settings,
  onStart,
  onStop,
  onUpdateSession,
  onAddToRecent,
  onReset,
  setError,
  setGameName,
  onUpdateSetting,
}: MainPanelProps) {
  const [elapsed, setElapsed] = useState(0)
  const [mangohudStatus, setMangohudStatus] = useState<{
    checked: boolean
    installed: boolean
    path: string
    version: string
  }>({ checked: false, installed: false, path: "", version: "" })
  const [keyTestStatus, setKeyTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle")
  const [keyTestMessage, setKeyTestMessage] = useState("")
  const [copiedLaunchOpt, setCopiedLaunchOpt] = useState(false)
  const [configWritten, setConfigWritten] = useState(false)
  const [configVerified, setConfigVerified] = useState<{
    checked: boolean
    valid: boolean
    message: string
  }>({ checked: false, valid: false, message: "" })
  const [configStatus, setConfigStatus] = useState<{ message: string; isError: boolean } | null>(null)

  // ── Pairing state ───────────────────────────────────────
  const [pairState, setPairState] = useState<{
    status: "idle" | "starting" | "showing-qr" | "polling" | "linked" | "error"
    qrUrl: string
    token: string
    error: string
  }>({ status: "idle", qrUrl: "", token: "", error: "" })
  const pairPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer for recording state
  useEffect(() => {
    if (recordingState !== "recording") {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [recordingState, session.startedAt])

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  async function handleCheckMangohud() {
    const result = await checkMangohud()
    setMangohudStatus({
      checked: true,
      installed: result.installed,
      path: result.path,
      version: result.version,
    })
    if (result.debug) {
      console.log("[DeckyVault] MangoHud debug:", result.debug)
    }
  }

  async function handleTestKey() {
    if (!settings.apiKey) {
      setKeyTestStatus("invalid")
      setKeyTestMessage("Enter an API key first")
      return
    }
    setKeyTestStatus("testing")
    setKeyTestMessage("")
    const result = await testApiKey(settings.apiKey, settings.baseUrl)
    if (result.valid) {
      setKeyTestStatus("valid")
      setKeyTestMessage("API key is valid")
    } else {
      setKeyTestStatus("invalid")
      setKeyTestMessage(result.error || "Invalid API key")
    }
  }

  async function handleCopyLaunchOption() {
    try {
      await navigator.clipboard.writeText("~/deckyvault-mangohud.sh %command%")
      setCopiedLaunchOpt(true)
      setTimeout(() => setCopiedLaunchOpt(false), 2000)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = "~/deckyvault-mangohud.sh %command%"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopiedLaunchOpt(true)
      setTimeout(() => setCopiedLaunchOpt(false), 2000)
    }
  }

  async function handleWriteConfig() {
    const result = await writeMangohudConfig()
    setConfigWritten(result.success)
    if (result.success) {
      // Reset verify state since config changed
      setConfigVerified({ checked: false, valid: false, message: "" })
    }
  }

  async function handleVerifyConfig() {
    const result = await getMangohudConfig()
    if (!result.exists) {
      setConfigVerified({ checked: true, valid: false, message: "No MangoHud config found. Write one first." })
      return
    }
    const content = result.content
    const hasOutputFolder = content.includes("output_folder=/tmp")
    const hasFps = content.includes("fps")
    if (hasOutputFolder && hasFps) {
      setConfigVerified({ checked: true, valid: true, message: "Config looks good" })
    } else {
      setConfigVerified({ checked: true, valid: false, message: "Config is missing required settings. Write it again." })
    }
  }

  async function handleExportConfig() {
    setConfigStatus(null)
    const result = await exportConfig(settings)
    if (result.success) {
      setConfigStatus({ message: `Config saved to ${result.path}`, isError: false })
    } else {
      setConfigStatus({ message: result.error || "Export failed", isError: true })
    }
  }

  async function handleImportConfig() {
    setConfigStatus(null)
    const result = await importConfig()
    if (result.success && result.settings) {
      onUpdateSetting("apiKey", result.settings.apiKey || "")
      onUpdateSetting("exportPath", result.settings.exportPath || "/home/deck/Downloads")
      onUpdateSetting("baseUrl", result.settings.baseUrl || "https://deckyvault.xyz")
      onUpdateSetting("hardwareSlug", result.settings.hardwareSlug || null)
      setConfigStatus({ message: "Config imported from Downloads", isError: false })
    } else {
      setConfigStatus({ message: result.error || "No config file found in Downloads", isError: true })
    }
  }

  // ── Pairing handlers ────────────────────────────────────
  function stopPairPolling() {
    if (pairPollRef.current) {
      clearInterval(pairPollRef.current)
      pairPollRef.current = null
    }
  }

  async function handleStartPairing() {
    setPairState({ status: "starting", qrUrl: "", token: "", error: "" })
    const result = await initiatePair(settings.baseUrl)
    if (!result.success || !result.token || !result.qrUrl) {
      setPairState({
        status: "error",
        qrUrl: "",
        token: "",
        error: result.error || "Could not start pairing.",
      })
      return
    }
    setPairState({
      status: "showing-qr",
      qrUrl: result.qrUrl || "",
      token: result.token || "",
      error: "",
    })

    // Begin polling for confirmation
    const token = result.token
    const baseUrl = settings.baseUrl || "https://deckyvault.xyz"
    stopPairPolling()
    pairPollRef.current = setInterval(async () => {
      const status = await checkPairStatus(token, baseUrl)
      if (status.status === "confirmed" && status.apiKey) {
        stopPairPolling()
        onUpdateSetting("apiKey", status.apiKey)
        setPairState({
          status: "linked",
          qrUrl: result.qrUrl || "",
          token,
          error: "",
        })
      } else if (status.status === "expired" || status.status === "invalid") {
        stopPairPolling()
        setPairState((prev) => ({
          ...prev,
          status: "error",
          error: status.error || "Pairing session expired. Try again.",
        }))
      }
    }, 3000)
  }

  function handleCancelPairing() {
    stopPairPolling()
    setPairState({ status: "idle", qrUrl: "", token: "", error: "" })
  }

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPairPolling()
  }, [])

  // ── Derived readiness flags ─────────────────────────────
  const hasApiKey = !!settings.apiKey
  const isLinked = pairState.status === "linked" || hasApiKey

  // ── Stopped state: show the session form ──────────────────────
  if (recordingState === "stopped") {
    return (
      <SessionForm
        session={session}
        error={error}
        settings={settings}
        onUpdateSession={onUpdateSession}
        onAddToRecent={onAddToRecent}
        onReset={onReset}
        setError={setError}
      />
    )
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          1. RECORDING — the primary action, always first
          ════════════════════════════════════════════════════════ */}
      <PanelSection title="Recording">
        {error && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{
              color: COLORS.err,
              padding: "8px 10px",
              fontSize: "12px",
              background: "rgba(231,76,60,0.10)",
              borderRadius: "6px",
              border: `1px solid rgba(231,76,60,0.25)`,
            }}>
              {error}
            </div>
          </PanelSectionRow>
        )}

        {recordingState === "idle" && (
          <>
            <SectionHint>
              Enter the game name (or let it auto-detect), then start recording once you're in-game.
            </SectionHint>
            <PanelSectionRow>
              <TextField
                label="Game Name"
                value={session.gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g. Cyberpunk 2077"
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={onStart}>
                <BtnContent icon={<FaPlay />} label="Start Recording" />
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {recordingState === "recording" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{
                padding: "14px 0",
                textAlign: "center",
                background: `radial-gradient(circle at center, ${COLORS.err}22 0%, transparent 70%)`,
                borderRadius: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "4px" }}>
                  <FaClock style={{ color: COLORS.err }} />
                  <strong style={{ fontSize: "22px", fontFamily: "monospace" }}>{formatTime(elapsed)}</strong>
                </div>
                <div style={{ fontSize: "13px", opacity: 0.7 }}>
                  {session.gameName ? session.gameName : "Recording…"}
                </div>
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={onStop}>
                <BtnContent icon={<FaStop />} label="Stop Recording" />
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {recentSessions.length > 0 && recordingState === "idle" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "10px 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recent
              </div>
            </PanelSectionRow>
            {recentSessions.map((rs, i) => (
              <PanelSectionRow key={i}>
                <div className={staticClasses.Text} style={{
                  padding: "6px 10px",
                  fontSize: "13px",
                  background: COLORS.panel,
                  borderRadius: "6px",
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <div style={{ fontWeight: 600 }}>{rs.gameName || "Unknown game"}</div>
                  <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>
                    {rs.fpsAvg ? `${rs.fpsAvg} FPS avg` : "No data"} · {new Date(rs.date).toLocaleDateString()}
                  </div>
                </div>
              </PanelSectionRow>
            ))}
          </>
        )}
      </PanelSection>

      {/* ════════════════════════════════════════════════════════
          2. ACCOUNT — pairing + API key (prerequisite for upload)
          ════════════════════════════════════════════════════════ */}
      <PanelSection title="Account">
        {/* Readiness indicator */}
        <StatusRow ok={isLinked ? true : null} label="Plugin" value={isLinked ? "Linked" : "Not linked"} />

        {pairState.status === "idle" && (
          <>
            <SectionHint>
              Scan a QR code with your phone to link your DeckyVault account — no manual key entry needed.
            </SectionHint>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleStartPairing}>
                <BtnContent icon={<FaQrcode />} label="Pair with Phone" />
              </ButtonItem>
            </PanelSectionRow>
            {/* Manual key entry + test */}
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "8px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Or paste a key manually
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label="API Key"
                value={settings.apiKey}
                onChange={(e) => onUpdateSetting("apiKey", e.target.value)}
                placeholder="dv_..."
                bIsPassword
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleTestKey} disabled={keyTestStatus === "testing"}>
                <BtnContent
                  icon={keyTestStatus === "testing" ? <FaClock /> : keyTestStatus === "valid" ? <FaCheck /> : keyTestStatus === "invalid" ? <FaTimes /> : <FaLink />}
                  label={keyTestStatus === "testing" ? "Testing…" : "Test API Key"}
                />
              </ButtonItem>
            </PanelSectionRow>
            {keyTestMessage && (
              <PanelSectionRow>
                <div className={staticClasses.Text} style={{ fontSize: "12px", color: keyTestStatus === "valid" ? COLORS.ok : COLORS.err, padding: "3px 0" }}>
                  {keyTestMessage}
                </div>
              </PanelSectionRow>
            )}
          </>
        )}

        {pairState.status === "starting" && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ padding: "16px 0", textAlign: "center", fontSize: "13px", opacity: 0.7 }}>
              Starting pairing session…
            </div>
          </PanelSectionRow>
        )}

        {(pairState.status === "showing-qr" || pairState.status === "polling") && (
          <>
            <SectionHint>Scan with your phone camera, then tap Confirm on the page.</SectionHint>
            <PanelSectionRow>
              <div style={{ display: "flex", justifyContent: "center", padding: "12px", background: "#fff", borderRadius: "12px" }}>
                <QRCodeSVG value={pairState.qrUrl} size={180} level="M" />
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", textAlign: "center", opacity: 0.6 }}>
                Waiting for confirmation…
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCancelPairing}>
                <BtnContent icon={<FaTimes />} label="Cancel" />
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {pairState.status === "linked" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{
                fontSize: "13px",
                color: COLORS.ok,
                padding: "10px",
                textAlign: "center",
                background: "rgba(46,204,113,0.10)",
                borderRadius: "8px",
                border: "1px solid rgba(46,204,113,0.25)",
              }}>
                <FaCheck /> Linked to your account
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, padding: "2px 0", textAlign: "center" }}>
                API key saved. You can now upload entries.
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCancelPairing}>
                <BtnContent icon={<FaLink />} label="Done" />
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {pairState.status === "error" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{
                fontSize: "12px",
                color: COLORS.err,
                padding: "8px 10px",
                background: "rgba(231,76,60,0.10)",
                borderRadius: "6px",
                border: "1px solid rgba(231,76,60,0.25)",
              }}>
                {pairState.error}
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleStartPairing}>
                <BtnContent icon={<FaQrcode />} label="Try Again" />
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCancelPairing}>
                <BtnContent icon={<FaTimes />} label="Dismiss" />
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>

      {/* ════════════════════════════════════════════════════════
          3. MANGOHUD SETUP — config + launch option + guide,
          all in one coherent section
          ════════════════════════════════════════════════════════ */}
      <PanelSection title="MangoHud Setup">
        <SectionHint>Follow these steps once to enable performance logging.</SectionHint>

        <SetupStep number={1} title="Write the Config" body="Creates the logging config and wrapper script automatically." />
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleWriteConfig}>
            <BtnContent icon={<FaDownload />} label="Write Config" />
          </ButtonItem>
        </PanelSectionRow>
        {configWritten && (
          <StatusRow ok={true} label="Config" value="written" />
        )}

        <SetupStep number={2} title="Add the Launch Option" body="Steam → right-click game → Properties → Launch Options, then paste:" />
        <CodeBlock value="~/deckyvault-mangohud.sh %command%" copied={copiedLaunchOpt} onCopy={handleCopyLaunchOption} />

        <SetupStep number={3} title="Launch & Record" body="Start the game from Steam, then press Start Recording once in-game." />

        {/* Verify + config details */}
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "10px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Verify
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleVerifyConfig}>
            <BtnContent icon={<FaSearch />} label="Verify Config" />
          </ButtonItem>
        </PanelSectionRow>
        {configVerified.checked && (
          <StatusRow ok={configVerified.valid} label="" value={configVerified.message} />
        )}

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{
            fontSize: "11px",
            padding: "10px 0 0 0",
            lineHeight: "1.5",
            opacity: 0.5,
            borderTop: `1px solid ${COLORS.border}`,
            marginTop: "8px",
          }}>
            Config stored in <span style={{ fontFamily: "monospace", opacity: 0.8 }}>~/.config/MangoHud/MangoHud.conf</span>.
            Steam Deck has MangoHud pre-installed; on other Linux, install via <span style={{ fontFamily: "monospace", opacity: 0.8 }}>apt</span> or Flatpak.
          </div>
        </PanelSectionRow>
      </PanelSection>

      {/* ════════════════════════════════════════════════════════
          4. SYSTEM — environment / detection status
          ════════════════════════════════════════════════════════ */}
      <PanelSection title="System">
        <SectionHint>Detect your hardware, OS, and the currently running game.</SectionHint>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleCheckMangohud}>
            <BtnContent icon={<FaCog />} label="Check MangoHud" />
          </ButtonItem>
        </PanelSectionRow>
        {mangohudStatus.checked && (
          <StatusRow
            ok={mangohudStatus.installed}
            label="MangoHud"
            value={mangohudStatus.installed ? mangohudStatus.version : "not found"}
          />
        )}

        {session.gameName && (
          <InfoRow icon={<FaGamepad />} label="Game" value={session.gameName} />
        )}
        {session.appId && (
          <InfoRow icon={<FaMicrochip />} label="App ID" value={String(session.appId)} />
        )}
      </PanelSection>

      {/* ════════════════════════════════════════════════════════
          5. ADVANCED — server, paths, hardware, config portability
          ════════════════════════════════════════════════════════ */}
      <PanelSection title="Advanced">
        <SectionHint>Change these only if you need a custom server or export location.</SectionHint>

        <PanelSectionRow>
          <TextField
            label="Server URL"
            value={settings.baseUrl}
            onChange={(e) => onUpdateSetting("baseUrl", e.target.value)}
            placeholder="https://deckyvault.xyz"
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Export Path"
            value={settings.exportPath}
            onChange={(e) => onUpdateSetting("exportPath", e.target.value)}
            placeholder="/home/deck/Downloads"
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Default Hardware"
            rgOptions={HARDWARE_OPTIONS}
            selectedOption={settings.hardwareSlug || ""}
            onChange={(opt) => onUpdateSetting("hardwareSlug", opt.data as string || null)}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "10px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <FaServer style={{ marginRight: "6px" }} />
            Config Backup
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleExportConfig}>
            <BtnContent icon={<FaFileExport />} label="Export to Downloads" />
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleImportConfig}>
            <BtnContent icon={<FaFileImport />} label="Import from Downloads" />
          </ButtonItem>
        </PanelSectionRow>
        {configStatus && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "6px",
              color: configStatus.isError ? COLORS.err : COLORS.ok,
              background: configStatus.isError ? "rgba(231,76,60,0.10)" : "rgba(46,204,113,0.10)",
              border: `1px solid ${configStatus.isError ? "rgba(231,76,60,0.25)" : "rgba(46,204,113,0.25)"}`,
            }}>
              {configStatus.isError ? <FaTimes /> : <FaCheck />} {configStatus.message}
            </div>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{
            fontSize: "11px",
            padding: "10px 0 0 0",
            lineHeight: "1.5",
            opacity: 0.45,
            borderTop: `1px solid ${COLORS.border}`,
            marginTop: "8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
          }}>
            <FaWrench style={{ marginTop: "2px", flexShrink: 0 }} />
            <span>Export saves your settings (including API key) as a JSON file you can move between devices.</span>
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  )
}