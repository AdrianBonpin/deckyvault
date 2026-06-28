import { useState } from "react"
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  DropdownItem,
  TextField,
  staticClasses,
} from "@decky/ui"
import {
  FaCheck,
  FaTimes,
  FaDownload,
  FaCog,
  FaFileExport,
  FaFileImport,
  FaCopy,
  FaSearch,
} from "react-icons/fa"
import type { PluginSettings } from "../lib/store"
import { KNOWN_HARDWARE_SLUGS } from "@deckyvault/shared"
import { testApiKey, checkMangohud, writeMangohudConfig, getMangohudConfig, exportConfig, importConfig } from "../lib/api"

interface SettingsPanelProps {
  settings: PluginSettings
  onUpdateSetting: <K extends keyof PluginSettings>(
    key: K,
    value: string | null
  ) => void
}

const HARDWARE_OPTIONS = [
  { label: "Auto-detect", data: "" },
  ...KNOWN_HARDWARE_SLUGS.map((slug) => ({ label: slug, data: slug })),
]

export default function SettingsPanel({
  settings,
  onUpdateSetting,
}: SettingsPanelProps) {
  const [keyTestStatus, setKeyTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle")
  const [keyTestMessage, setKeyTestMessage] = useState("")
  const [mangohudStatus, setMangohudStatus] = useState<{
    checked: boolean
    installed: boolean
    path: string
    version: string
  }>({ checked: false, installed: false, path: "", version: "" })
  const [configWritten, setConfigWritten] = useState(false)
  const [configStatus, setConfigStatus] = useState<{ message: string; isError: boolean } | null>(null)
  const [configVerified, setConfigVerified] = useState<{
    checked: boolean
    valid: boolean
    message: string
  }>({ checked: false, valid: false, message: "" })
  const [copiedLaunchOpt, setCopiedLaunchOpt] = useState(false)

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

  async function handleCheckMangohud() {
    const result = await checkMangohud()
    setMangohudStatus({
      checked: true,
      installed: result.installed,
      path: result.path,
      version: result.version,
    })
  }

  async function handleWriteConfig() {
    const result = await writeMangohudConfig()
    setConfigWritten(result.success)
  }

  async function handleVerifyConfig() {
    const result = await getMangohudConfig()
    if (!result.exists) {
      setConfigVerified({
        checked: true,
        valid: false,
        message: "No MangoHud config found. Write one first.",
      })
      return
    }
    const content = result.content
    const hasOutputFolder = content.includes("output_folder=/tmp")
    const hasOutputFile = content.includes("output_file=deckyvault-mangohud.log")
    const hasFps = content.includes("fps")
    const hasFrameTiming = content.includes("frame_timing")
    const hasGpuPower = content.includes("gpu_power")

    if (hasOutputFolder && hasOutputFile && hasFps) {
      setConfigVerified({
        checked: true,
        valid: true,
        message: "Config looks good — logging to /tmp/deckyvault-mangohud.log",
      })
    } else {
      const missing: string[] = []
      if (!hasOutputFolder) missing.push("output_folder=/tmp")
      if (!hasOutputFile) missing.push("output_file=deckyvault-mangohud.log")
      if (!hasFps) missing.push("fps")
      if (!hasFrameTiming) missing.push("frame_timing")
      if (!hasGpuPower) missing.push("gpu_power")
      setConfigVerified({
        checked: true,
        valid: false,
        message: `Missing: ${missing.join(", ")}. Write config again.`,
      })
    }
  }

  async function handleCopyLaunchOption() {
    try {
      await navigator.clipboard.writeText("mangohud %command%")
      setCopiedLaunchOpt(true)
      setTimeout(() => setCopiedLaunchOpt(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement("textarea")
      ta.value = "mangohud %command%"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopiedLaunchOpt(true)
      setTimeout(() => setCopiedLaunchOpt(false), 2000)
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

  return (
    <>
      {/* ── API Key ─────────────────────────────────────────────── */}
      <PanelSection title="DeckyVault Account">
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
            {keyTestStatus === "testing" ? "Testing..." : "Test Key"}
            {keyTestStatus === "valid" && <FaCheck style={{ color: "#2ecc71", marginLeft: "8px" }} />}
            {keyTestStatus === "invalid" && <FaTimes style={{ color: "#e74c3c", marginLeft: "8px" }} />}
          </ButtonItem>
        </PanelSectionRow>

        {keyTestMessage && (
          <PanelSectionRow>
            <div
              className={staticClasses.Text}
              style={{
                fontSize: "12px",
                color: keyTestStatus === "valid" ? "#2ecc71" : "#e74c3c",
                padding: "4px 0",
              }}
            >
              {keyTestMessage}
            </div>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, padding: "4px 0" }}>
            Get your API key from DeckyVault → Profile → Settings → API Keys
          </div>
        </PanelSectionRow>
      </PanelSection>

      {/* ── Export Path ─────────────────────────────────────────── */}
      <PanelSection title="Export">
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
      </PanelSection>

      {/* ── Config Export/Import ────────────────────────────────── */}
      <PanelSection title="Configuration">
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
            <div
              className={staticClasses.Text}
              style={{
                fontSize: "12px",
                padding: "4px 0",
                color: configStatus.isError ? "#e74c3c" : "#2ecc71",
              }}
            >
              {configStatus.isError ? <FaTimes /> : <FaCheck />} {configStatus.message}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* ── MangoHud Setup ──────────────────────────────────────── */}
      <PanelSection title="MangoHud Setup">
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
            <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "8px 0" }}>
              {mangohudStatus.installed ? (
                <>
                  <FaCheck style={{ color: "#2ecc71" }} /> MangoHud installed
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    Path: {mangohudStatus.path}
                    <br />
                    Version: {mangohudStatus.version}
                  </span>
                </>
              ) : (
                <>
                  <FaTimes style={{ color: "#e74c3c" }} /> MangoHud not found
                  <br />
                  <span style={{ opacity: 0.7 }}>See installation guide below</span>
                </>
              )}
            </div>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleWriteConfig}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaDownload />
              Write MangoHud Config
            </div>
          </ButtonItem>
        </PanelSectionRow>

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
            <div
              className={staticClasses.Text}
              style={{
                fontSize: "12px",
                padding: "4px 0",
                color: configVerified.valid ? "#2ecc71" : "#e74c3c",
              }}
            >
              {configVerified.valid ? <FaCheck /> : <FaTimes />} {configVerified.message}
            </div>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleCopyLaunchOption}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCopy />
              {copiedLaunchOpt ? "Copied!" : "Copy Launch Option"}
            </div>
          </ButtonItem>
        </PanelSectionRow>

        {configWritten && (
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "12px", color: "#2ecc71", padding: "4px 0" }}>
              <FaCheck /> Config written to ~/.config/MangoHud/MangoHud.conf
            </div>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px", lineHeight: "1.6" }}>
            <strong>Steam Deck (SteamOS):</strong>
            <br />
            MangoHud is pre-installed. Enable it per-game by adding
            <code style={{ display: "block", margin: "4px 0", padding: "4px", background: "rgba(255,255,255,0.1)" }}>
              mangohud %command%
            </code>
            to the game's Steam launch options (right-click game → Properties → Launch Options).

            <br /><br />
            <strong>Other Linux handhelds</strong> (ROG Ally, Legion Go):
            <br />
            Install via package manager:
            <code style={{ display: "block", margin: "4px 0", padding: "4px", background: "rgba(255,255,255,0.1)" }}>
              sudo apt install mangohud
            </code>
            or Flatpak:
            <code style={{ display: "block", margin: "4px 0", padding: "4px", background: "rgba(255,255,255,0.1)" }}>
              flatpak install flathub org.freedesktop.Platform.VulkanLayer.MangoHud
            </code>

            <br /><br />
            <strong>Manual build:</strong>
            <br />
            See{" "}
            <a href="https://github.com/flightlessmango/MangoHud" style={{ color: "#66c0f4" }}>
              github.com/flightlessmango/MangoHud
            </a>

            <br /><br />
            <strong>Troubleshooting:</strong>
            <br />
            • Log file empty? Check MangoHud is enabled for the game and the config was written.
            <br />
            • Wrong path? Ensure the plugin can write to /tmp/.
            <br />
            • Not attaching? Try adding <code>mangohud %command%</code> to Steam launch options explicitly.
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  )
}