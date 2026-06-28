import { useEffect, useState } from "react"
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
} from "../lib/api"
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

      {/* ── Usage Instructions ──────────────────────────────────── */}
      <PanelSection title="Usage Instructions">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", lineHeight: "1.5" }}>
            Add this to your game's Steam launch options, then press Start Recording before launching.
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

      {/* ── MangoHud Setup Guide ────────────────────────────────── */}
      <PanelSection title="MangoHud Setup Guide">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px", lineHeight: "1.6" }}>
            <strong>Steam Deck (SteamOS):</strong> MangoHud is pre-installed. Add <code>mangohud %command%</code> to your game's Steam launch options (right-click → Properties → Launch Options).
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px", lineHeight: "1.6" }}>
            <strong>Other Linux:</strong> Install via <code>sudo apt install mangohud</code> or <code>flatpak install ...VulkanLayer.MangoHud</code>. See{" "}
            <a href="https://github.com/flightlessmango/MangoHud" style={{ color: "#66c0f4" }}>github.com/flightlessmango/MangoHud</a>.
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px", lineHeight: "1.6" }}>
            <strong>Troubleshooting:</strong> Log empty? Check MangoHud is enabled. Not attaching? Add <code>mangohud %command%</code> to launch options explicitly.
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  )
}