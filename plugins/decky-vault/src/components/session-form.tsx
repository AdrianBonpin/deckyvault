import { useState, useEffect } from "react"
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  DropdownItem,
  TextField,
  staticClasses,
} from "@decky/ui"
import {
  FaFileExport,
  FaCloudUploadAlt,
  FaCheck,
  FaTimes,
  FaImages,
  FaPlus,
  FaTrash,
  FaSpinner,
} from "react-icons/fa"
import type { SessionData } from "../lib/store"
import { buildImportPayload } from "../lib/store"
import type { PluginSettings } from "../lib/store"
import {
  exportToFile,
  uploadToDeckyvault,
  listScreenshots,
  readScreenshot,
  uploadScreenshots,
} from "../lib/api"

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
  { label: "None", data: "none" },
  { label: "FSR", data: "fsr" },
  { label: "DLSS", data: "dlss" },
  { label: "XeSS", data: "xess" },
  { label: "LSFG", data: "lsfg" },
  { label: "Other", data: "other" },
]

const FRAME_GEN_OPTIONS = [
  { label: "None", data: "none" },
  { label: "FSR FG", data: "fsr_fg" },
  { label: "DLSS FG", data: "dlss_fg" },
  { label: "LSFG", data: "lsfg" },
  { label: "Other", data: "other" },
]

const MAX_SCREENSHOTS = 2

interface ScreenshotFile {
  path: string
  name: string
  mtime: number
  size: number
}

function formatShotTime(mtime: number): string {
  const d = new Date(mtime * 1000)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return isToday ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Thumbnail({ src, size = 56 }: { src?: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: "6px",
          flexShrink: 0,
          background: "#000",
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "6px",
        flexShrink: 0,
        background: "rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FaImages style={{ opacity: 0.4 }} />
    </div>
  )
}

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

  // ── Screenshot picker state ──────────────────────────────
  const [selectedShots, setSelectedShots] = useState<ScreenshotFile[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [availableShots, setAvailableShots] = useState<ScreenshotFile[]>([])
  const [shotsLoading, setShotsLoading] = useState(false)
  const [shotsError, setShotsError] = useState("")
  // path → base64 data URL thumbnail for preview display
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  async function openPicker() {
    if (selectedShots.length >= MAX_SCREENSHOTS) return
    setPickerOpen(true)
    setShotsLoading(true)
    setShotsError("")
    const result = await listScreenshots(12)
    setShotsLoading(false)
    if (result.error) {
      setShotsError(result.error)
    }
    // Filter out already-selected paths
    const list = result.screenshots.filter((s) => !selectedShots.some((sel) => sel.path === s.path))
    setAvailableShots(list)
    // Load thumbnails for the list (and any selected shots not yet loaded)
    loadThumbnails([...list, ...selectedShots])
  }

  async function loadThumbnails(shots: ScreenshotFile[]) {
    for (const shot of shots) {
      if (thumbnails[shot.path]) continue // already loaded
      const res = await readScreenshot(shot.path, 320)
      if (res.dataUrl) {
        setThumbnails((prev) => ({ ...prev, [shot.path]: res.dataUrl }))
      }
    }
  }

  // Load thumbnails for any selected shots without one yet
  useEffect(() => {
    if (selectedShots.length > 0) {
      loadThumbnails(selectedShots)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShots.map((s) => s.path).join(",")])

  function addShot(shot: ScreenshotFile) {
    if (selectedShots.length >= MAX_SCREENSHOTS) return
    setSelectedShots((prev) => [...prev, shot])
    setAvailableShots((prev) => prev.filter((s) => s.path !== shot.path))
    if (selectedShots.length + 1 >= MAX_SCREENSHOTS) {
      setPickerOpen(false)
    }
  }

  function removeShot(shot: ScreenshotFile) {
    setSelectedShots((prev) => prev.filter((s) => s.path !== shot.path))
    setAvailableShots((prev) => [...prev, shot].sort((a, b) => b.mtime - a.mtime))
  }

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
    setStatusMessage("Uploading entry…")

    const payload = buildImportPayload(session)
    const result = await uploadToDeckyvault(
      payload as unknown as Record<string, unknown>,
      settings.apiKey,
      settings.baseUrl,
    )

    if (!result.success) {
      setUploadStatus("error")
      setStatusMessage(result.error || "Upload failed")
      if (result.status === 404) {
        setStatusMessage("This game isn't in DeckyVault yet. Submit it on the website first, or export to file.")
      }
      return
    }

    const entryId = result.data?.id

    // ── Upload screenshots if any are selected ───────────────
    if (selectedShots.length > 0 && entryId) {
      setStatusMessage(`Entry uploaded. Adding ${selectedShots.length} screenshot${selectedShots.length > 1 ? "s" : ""}…`)
      const shotResult = await uploadScreenshots(
        entryId,
        selectedShots.map((s) => s.path),
        settings.apiKey,
        settings.baseUrl,
      )
      if (shotResult.success) {
        setUploadStatus("success")
        const n = shotResult.uploaded ?? selectedShots.length
        setStatusMessage(`Uploaded! Entry + ${n} screenshot${n > 1 ? "s" : ""}`)
      } else {
        // Entry succeeded but screenshots failed — still a partial success
        setUploadStatus("success")
        setStatusMessage(`Entry uploaded (ID: ${entryId}). Screenshots failed: ${shotResult.error}`)
      }
    } else {
      setUploadStatus("success")
      setStatusMessage(`Uploaded! Entry ID: ${entryId}`)
    }

    onAddToRecent(session)
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
          <TextField
            label="Upscaler Version"
            value={session.upscalerVersion}
            onChange={(e) => onUpdateSession({ upscalerVersion: e.target.value })}
            placeholder="e.g. 2.4"
          />
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
          <TextField
            label="Load Time - SSD (seconds)"
            value={session.loadTimeSsd}
            onChange={(e) => onUpdateSession({ loadTimeSsd: e.target.value })}
            placeholder="e.g. 12.5"
            mustBeNumeric
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <TextField
            label="Load Time - SD Card (seconds)"
            value={session.loadTimeSd}
            onChange={(e) => onUpdateSession({ loadTimeSd: e.target.value })}
            placeholder="e.g. 25.0"
            mustBeNumeric
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <TextField
            label="Launch Options"
            value={session.launchOptions}
            onChange={(e) => onUpdateSession({ launchOptions: e.target.value })}
            placeholder="e.g. mangohud %command%"
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <TextField
            label="Notes"
            value={session.userNotes}
            onChange={(e) => onUpdateSession({ userNotes: e.target.value })}
            placeholder="Any observations about performance..."
          />
        </PanelSectionRow>
      </PanelSection>

      {/* ── Screenshots (max 2) ────────────────────────────────── */}
      <PanelSection title={`Screenshots${selectedShots.length > 0 ? ` (${selectedShots.length}/${MAX_SCREENSHOTS})` : ""}`}>
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "2px 0", opacity: 0.6, lineHeight: 1.4 }}>
            Attach up to {MAX_SCREENSHOTS} Steam Deck screenshots (Steam + R1). They upload with your entry.
          </div>
        </PanelSectionRow>

        {/* Selected screenshots */}
        {selectedShots.map((shot) => (
          <PanelSectionRow key={shot.path}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}>
              <Thumbnail src={thumbnails[shot.path]} />
              <div className={staticClasses.Text} style={{ flex: 1, minWidth: 0, fontSize: "12px" }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shot.name}
                </div>
                <div style={{ opacity: 0.5, fontSize: "11px" }}>
                  {formatShotTime(shot.mtime)} · {formatSize(shot.size)}
                </div>
              </div>
              <button
                onClick={() => removeShot(shot)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#e74c3c",
                  padding: "4px",
                  flexShrink: 0,
                }}
                title="Remove"
              >
                <FaTrash />
              </button>
            </div>
          </PanelSectionRow>
        ))}

        {/* Add button (hidden when at max) */}
        {selectedShots.length < MAX_SCREENSHOTS && !pickerOpen && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={openPicker}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <FaPlus />
                Add Screenshot
              </div>
            </ButtonItem>
          </PanelSectionRow>
        )}

        {/* Picker: list of recent Steam screenshots */}
        {pickerOpen && (
          <>
            <PanelSectionRow>
              <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Recent screenshots
              </div>
            </PanelSectionRow>

            {shotsLoading && (
              <PanelSectionRow>
                <div className={staticClasses.Text} style={{ padding: "8px 0", textAlign: "center", fontSize: "13px", opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <FaSpinner className="fa-spin" /> Loading…
                </div>
              </PanelSectionRow>
            )}

            {shotsError && !shotsLoading && (
              <PanelSectionRow>
                <div className={staticClasses.Text} style={{ fontSize: "12px", color: "#e74c3c", padding: "4px 0" }}>
                  {shotsError}
                </div>
              </PanelSectionRow>
            )}

            {!shotsLoading && !shotsError && availableShots.length === 0 && (
              <PanelSectionRow>
                <div className={staticClasses.Text} style={{ fontSize: "12px", opacity: 0.5, padding: "8px 0", textAlign: "center" }}>
                  No screenshots found. Take one with Steam + R1.
                </div>
              </PanelSectionRow>
            )}

            {!shotsLoading && availableShots.map((shot) => (
              <PanelSectionRow key={shot.path}>
                <ButtonItem layout="below" onClick={() => addShot(shot)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Thumbnail src={thumbnails[shot.path]} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatShotTime(shot.mtime)}
                      </div>
                      <div style={{ fontSize: "11px", opacity: 0.6 }}>
                        {formatSize(shot.size)}
                      </div>
                    </div>
                    <FaPlus style={{ opacity: 0.7, flexShrink: 0 }} />
                  </div>
                </ButtonItem>
              </PanelSectionRow>
            ))}

            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setPickerOpen(false)}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <FaTimes />
                  Cancel
                </div>
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
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