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

function SetupStep({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <PanelSectionRow>
      <div style={{ display: "flex", gap: "10px", padding: "6px 0", alignItems: "flex-start" }}>
        <div style={{
          flexShrink: 0,
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "#1b9bf3",
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
    const hasFrameTiming = content.includes("frame_timing")
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
      {/* ── Recording ──────────────────────────────────────────── */}
      <PanelSection title="Recording">
        {error && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ color: "#e74c3c", padding: "8px" }}>{error}</div>
          </PanelSectionRow>
        )}

        {recordingState === "idle" && (
          <>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaPlay />
                  Start Recording
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {recordingState === "recording" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ padding: "8px 0", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "4px" }}>
                  <FaClock />
                  <strong>{formatTime(elapsed)}</strong>
                </div>
                <div style={{ fontSize: "13px", opacity: 0.7 }}>
                  {session.gameName ? `Recording: ${session.gameName}` : "Recording..."}
                </div>
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={onStop}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaStop />
                  Stop Recording
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {recentSessions.length > 0 && recordingState === "idle" && (
          <PanelSection title="Recent Recordings">
            {recentSessions.map((rs, i) => (
              <PanelSectionRow key={i}>
                <div className={staticClasses.Text} style={{ padding: "4px 0", fontSize: "13px" }}>
                  <strong>{rs.gameName || "Unknown game"}</strong>
                  <br />
                  <span style={{ opacity: 0.6 }}>
                    {rs.fpsAvg ? `${rs.fpsAvg} FPS avg` : "No data"} · {new Date(rs.date).toLocaleDateString()}
                  </span>
                </div>
              </PanelSectionRow>
            ))}
          </PanelSection>
        )}
      </PanelSection>

      {/* ── Status ──────────────────────────────────────────────── */}
      <PanelSection title="Status">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleCheckMangohud}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCog />
              Check MangoHud Status
            </div>
          </ButtonItem>
        </PanelSectionRow>
        {mangohudStatus.checked && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "4px 0" }}>
              {mangohudStatus.installed ? (
                <><FaCheck style={{ color: "#2ecc71" }} /> MangoHud {mangohudStatus.version}</>
              ) : (
                <><FaTimes style={{ color: "#e74c3c" }} /> MangoHud not found</>
              )}
            </div>
          </PanelSectionRow>
        )}
        {session.gameName && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "4px 0" }}>
              <strong>Game:</strong> {session.gameName}
              {session.appId && <> <strong>App ID:</strong> {session.appId}</>}
            </div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleTestKey} disabled={keyTestStatus === "testing"}>
            {keyTestStatus === "testing" ? "Testing..." : "Test API Key"}
            {keyTestStatus === "valid" && <FaCheck style={{ color: "#2ecc71", marginLeft: "8px" }} />}
            {keyTestStatus === "invalid" && <FaTimes style={{ color: "#e74c3c", marginLeft: "8px" }} />}
          </ButtonItem>
        </PanelSectionRow>
        {keyTestMessage && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "12px", color: keyTestStatus === "valid" ? "#2ecc71" : "#e74c3c", padding: "4px 0" }}>
              {keyTestMessage}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* ── Account ─────────────────────────────────────────── */}
      <PanelSection title="Account">
        {pairState.status === "idle" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", lineHeight: "1.5", opacity: 0.7 }}>
                Link this plugin to your DeckyVault account by scanning a QR code with your phone — no manual key entry needed.
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleStartPairing}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaQrcode />
                  Pair with Phone
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {pairState.status === "starting" && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ padding: "12px 0", textAlign: "center", fontSize: "13px", opacity: 0.7 }}>
              Starting pairing session…
            </div>
          </PanelSectionRow>
        )}

        {(pairState.status === "showing-qr" || pairState.status === "polling") && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", lineHeight: "1.5", opacity: 0.8 }}>
                Scan this code with your phone's camera, then confirm on the page that opens.
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0", background: "#fff", borderRadius: "12px" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaTimes />
                  Cancel
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {pairState.status === "linked" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "13px", color: "#2ecc71", padding: "4px 0", textAlign: "center" }}>
                <FaCheck /> Plugin linked to your account!
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, padding: "4px 0", textAlign: "center" }}>
                API key saved. You can now upload performance entries.
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCancelPairing}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaLink />
                  Done
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}

        {pairState.status === "error" && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "12px", color: "#e74c3c", padding: "4px 0" }}>
                <FaTimes /> {pairState.error}
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleStartPairing}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaQrcode />
                  Try Again
                </div>
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCancelPairing}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  Dismiss
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>

      {/* ── Usage Instructions ──────────────────────────────────── */}
      <PanelSection title="Usage Instructions">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", lineHeight: "1.5" }}>
            Add this to your game's Steam launch options, then launch the game. Press Start Recording once you're in-game and ready to benchmark.
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontFamily: "monospace",
            fontSize: "14px",
            textAlign: "center",
          }}>
            ~/deckyvault-mangohud.sh %command%
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleCopyLaunchOption}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
              <FaCopy />
              {copiedLaunchOpt ? "Copied to clipboard" : "Copy Launch Option"}
            </div>
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, padding: "4px 0" }}>
            Config stored in ~/.config/MangoHud/MangoHud.conf
          </div>
        </PanelSectionRow>
      </PanelSection>

      {/* ── MangoHud Config ────────────────────────────────────── */}
      <PanelSection title="MangoHud Config">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleWriteConfig}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaDownload />
              Write Config
            </div>
          </ButtonItem>
        </PanelSectionRow>
        {configWritten && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "12px", color: "#2ecc71", padding: "4px 0" }}>
              <FaCheck /> Config written
            </div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleVerifyConfig}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaSearch />
              Verify Config
            </div>
          </ButtonItem>
        </PanelSectionRow>
        {configVerified.checked && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", color: configVerified.valid ? "#2ecc71" : "#e74c3c" }}>
              {configVerified.valid ? <FaCheck /> : <FaTimes />} {configVerified.message}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* ── Configuration ────────────────────────────────────────── */}
      <PanelSection title="Configuration">
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
          <TextField
            label="Export Path"
            value={settings.exportPath}
            onChange={(e) => onUpdateSetting("exportPath", e.target.value)}
            placeholder="/home/deck/Downloads"
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Server URL"
            value={settings.baseUrl}
            onChange={(e) => onUpdateSetting("baseUrl", e.target.value)}
            placeholder="https://deckyvault.xyz"
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
          <ButtonItem layout="below" onClick={handleExportConfig}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaFileExport />
              Export Config to Downloads
            </div>
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleImportConfig}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaFileImport />
              Import Config from Downloads
            </div>
          </ButtonItem>
        </PanelSectionRow>
        {configStatus && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", color: configStatus.isError ? "#e74c3c" : "#2ecc71" }}>
              {configStatus.isError ? <FaTimes /> : <FaCheck />} {configStatus.message}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* ── MangoHud Setup Guide ────────────────────────────── */}
      <PanelSection title="MangoHud Setup Guide">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0 8px 0", lineHeight: "1.5", opacity: 0.7 }}>
            Follow these steps once to enable performance logging.
          </div>
        </PanelSectionRow>

        <SetupStep number={1} title="Write MangoHud Config" body="Tap 'Write Config' above. This creates the logging config and a wrapper script automatically." />
        <SetupStep number={2} title="Add the Launch Option" body="Right-click your game in Steam → Properties → Launch Options, and paste the launch option above." />
        <SetupStep number={3} title="Launch the Game" body="Start the game from Steam. MangoHud loads automatically using the wrapper script." />
        <SetupStep number={4} title="Record While Playing" body="Once in-game, open this panel and press Start Recording. Press Stop when done." />

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "11px", padding: "10px 0 0 0", lineHeight: "1.5", opacity: 0.5, borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "8px" }}>
            Steam Deck ships with MangoHud pre-installed. On other Linux distros, install it with <span style={{ fontFamily: "monospace", opacity: 0.8 }}>sudo apt install mangohud</span> or via Flatpak.
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  )
}