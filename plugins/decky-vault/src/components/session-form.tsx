import { useState } from "react"
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Field,
  DropdownItem,
  staticClasses,
} from "@decky/ui"
import {
  FaFileExport,
  FaCloudUploadAlt,
  FaCheck,
  FaTimes,
} from "react-icons/fa"
import type { SessionData } from "../lib/store"
import { buildImportPayload } from "../lib/store"
import type { PluginSettings } from "../lib/store"
import { exportToFile, uploadToDeckyvault } from "../lib/api"

interface SessionFormProps {
  session: SessionData
  error: string
  settings?: PluginSettings
  onUpdateSession: (updates: Partial<SessionData>) => void
  onAddToRecent: (sess: SessionData) => void
  onReset: () => void
  setError: (msg: string) => void
}

const UPSCALER_OPTIONS = [
  { label: "None", value: "none" },
  { label: "FSR", value: "fsr" },
  { label: "DLSS", value: "dlss" },
  { label: "XeSS", value: "xess" },
  { label: "LSFG", value: "lsfg" },
  { label: "Other", value: "other" },
]

const FRAME_GEN_OPTIONS = [
  { label: "None", value: "none" },
  { label: "FSR FG", value: "fsr_fg" },
  { label: "DLSS FG", value: "dlss_fg" },
  { label: "LSFG", value: "lsfg" },
  { label: "Other", value: "other" },
]

export default function SessionForm({
  session,
  error,
  settings,
  onUpdateSession,
  onAddToRecent,
  onReset,
  setError,
}: SessionFormProps) {
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle")
  const [uploadStatus, setUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  async function handleExport() {
    if (!settings) return
    setError("")
    setExportStatus("idle")
    const payload = buildImportPayload(session)
    const gameSlug = session.gameName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "unknown"
    const date = new Date().toISOString().slice(0, 10)
    const filename = `${gameSlug}-${date}.deckyvault.json`
    const fullPath = `${settings.exportPath}/${filename}`

    const result = await exportToFile(payload as unknown as Record<string, unknown>, fullPath)
    if (result.success) {
      setExportStatus("success")
      setStatusMessage(`Saved to ${result.path}`)
      onAddToRecent(session)
    } else {
      setExportStatus("error")
      setStatusMessage(result.error || "Export failed")
    }
  }

  async function handleUpload() {
    if (!settings) return
    if (!settings.apiKey) {
      setError("No API key configured. Set one in the Settings tab.")
      return
    }
    setError("")
    setUploadStatus("loading")
    setStatusMessage("")

    const payload = buildImportPayload(session)
    const result = await uploadToDeckyvault(
      payload as unknown as Record<string, unknown>,
      settings.apiKey,
      settings.baseUrl,
    )

    if (result.success) {
      setUploadStatus("success")
      setStatusMessage(`Uploaded! Entry ID: ${result.data?.id}`)
      onAddToRecent(session)
    } else {
      setUploadStatus("error")
      setStatusMessage(result.error || "Upload failed")
      if (result.status === 404) {
        setStatusMessage("This game isn't in DeckyVault yet. Submit it on the website first, or export to file.")
      }
    }
  }

  return (
    <PanelSection title="Session Results">
      {/* ── Auto-captured summary ──────────────────────────────── */}
      <PanelSection title="Captured Metrics">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "4px 0" }}>
            <strong>Game:</strong> {session.gameName || "Unknown"}<br />
            {session.appId && <><strong>App ID:</strong> {session.appId}<br /></>}
            <strong>FPS:</strong> {session.fpsAvg ?? "—"} avg / {session.fpsLow ?? "—"} min / {session.fpsOnePercentLow ?? "—"} 1% low / {session.fpsHigh ?? "—"} max<br />
            <strong>TDP:</strong> {session.tdpWatts ? `${session.tdpWatts}W` : "—"}<br />
            <strong>Hardware:</strong> {session.hardwareName || session.hardwareSlug || "—"}<br />
            <strong>OS:</strong> {session.osVersion || "—"}<br />
            <strong>Proton:</strong> {session.protonVersion || "—"}
          </div>
        </PanelSectionRow>
      </PanelSection>

      {/* ── Manual inputs ──────────────────────────────────────── */}
      <PanelSection title="Additional Details">
        <PanelSectionRow>
          <DropdownItem
            label="Upscaler"
            rgOptions={UPSCALER_OPTIONS}
            selectedOption={session.upscalerType}
            onChange={(opt) => onUpdateSession({ upscalerType: opt.data as string })}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="Upscaler Version" bottomSeparator="none">
            <input
              type="text"
              value={session.upscalerVersion}
              onChange={(e) => onUpdateSession({ upscalerVersion: e.target.value })}
              placeholder="e.g. 2.4"
              style={{ width: "100%", padding: "4px 8px" }}
            />
          </Field>
        </PanelSectionRow>

        <PanelSectionRow>
          <DropdownItem
            label="Frame Generation"
            rgOptions={FRAME_GEN_OPTIONS}
            selectedOption={session.frameGenMethod}
            onChange={(opt) => onUpdateSession({ frameGenMethod: opt.data as string })}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="In-game Settings" bottomSeparator="none">
            <textarea
              value={session.settingsJson}
              onChange={(e) => onUpdateSession({ settingsJson: e.target.value })}
              placeholder="e.g. High preset, 1280x800, TAA"
              rows={3}
              style={{ width: "100%", padding: "4px 8px", resize: "vertical" }}
            />
          </Field>
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="Load Time - SSD (seconds)" bottomSeparator="none">
            <input
              type="number"
              value={session.loadTimeSsd}
              onChange={(e) => onUpdateSession({ loadTimeSsd: e.target.value })}
              placeholder="e.g. 12.5"
              style={{ width: "100%", padding: "4px 8px" }}
            />
          </Field>
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="Load Time - SD Card (seconds)" bottomSeparator="none">
            <input
              type="number"
              value={session.loadTimeSd}
              onChange={(e) => onUpdateSession({ loadTimeSd: e.target.value })}
              placeholder="e.g. 25.0"
              style={{ width: "100%", padding: "4px 8px" }}
            />
          </Field>
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="Launch Options" bottomSeparator="none">
            <input
              type="text"
              value={session.launchOptions}
              onChange={(e) => onUpdateSession({ launchOptions: e.target.value })}
              placeholder="e.g. mangohud %command%"
              style={{ width: "100%", padding: "4px 8px" }}
            />
          </Field>
        </PanelSectionRow>

        <PanelSectionRow>
          <Field label="Notes" bottomSeparator="none">
            <textarea
              value={session.userNotes}
              onChange={(e) => onUpdateSession({ userNotes: e.target.value })}
              placeholder="Any observations about performance..."
              rows={3}
              maxLength={5000}
              style={{ width: "100%", padding: "4px 8px", resize: "vertical" }}
            />
          </Field>
        </PanelSectionRow>
      </PanelSection>

      {/* ── Error display ──────────────────────────────────────── */}
      {error && (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ color: "#e74c3c", padding: "8px" }}>
            {error}
          </div>
        </PanelSectionRow>
      )}

      {/* ── Status messages ────────────────────────────────────── */}
      {statusMessage && (
        <PanelSectionRow>
          <div
            className={staticClasses.Text}
            style={{
              padding: "8px",
              color: exportStatus === "success" || uploadStatus === "success" ? "#2ecc71" : "#e74c3c",
            }}
          >
            {exportStatus === "success" && <FaCheck />}{" "}
            {exportStatus === "error" && <FaTimes />}{" "}
            {uploadStatus === "success" && <FaCheck />}{" "}
            {uploadStatus === "error" && <FaTimes />}{" "}
            {statusMessage}
          </div>
        </PanelSectionRow>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleExport} disabled={false}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaFileExport />
            Export to File
          </div>
        </ButtonItem>
      </PanelSectionRow>

      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleUpload}
          disabled={uploadStatus === "loading"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaCloudUploadAlt />
            {uploadStatus === "loading" ? "Uploading..." : "Upload to DeckyVault"}
          </div>
        </ButtonItem>
      </PanelSectionRow>

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onReset} disabled={false}>
          New Recording
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  )
}