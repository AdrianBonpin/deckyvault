import { useEffect, useState, useRef } from "react"
import { PanelSection, PanelSectionRow, DropdownItem, staticClasses } from "@decky/ui"
import { FaCheck, FaTimes, FaChartLine } from "react-icons/fa"
import {
  fetchPluginGame,
  fetchPluginDevices,
  setPluginApiBaseUrl,
  type PluginGameResponse,
  type PluginDeviceRow,
  type PluginEntry,
} from "../lib/plugin-api"

interface Props {
  appId: number
  title: string
  hardwareSlug: string | null      // detected device
  baseUrl: string
}

function EntryCard({ e }: { e: PluginEntry }) {
  const [expanded, setExpanded] = useState(false)
  const settingsCount = Array.isArray(e.settingsJson)
    ? (e.settingsJson as Array<{ settings: unknown[] }>).reduce((s, c) => s + (c.settings?.length ?? 0), 0)
    : 0
  const label = e.isPinned ? "Pinned" : e.upvotes > 0 ? `${e.upvotes}👍` : "Recent"
  return (
    <PanelSectionRow>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}
      >
        <div className={staticClasses.Text} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <strong>{e.fpsAvg} FPS avg</strong>
          <span style={{ opacity: 0.7 }}>{label}</span>
        </div>
        <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, marginTop: 2 }}>
          {e.fpsLow ?? "—"} low · {e.fpsOnePercentLow ?? "—"} 1% · {e.fpsHigh ?? "—"} high
          {e.tdpWatts ? ` · ${e.tdpWatts}W` : ""}
          {e.upscalerType && e.upscalerType !== "none" ? ` · ${e.upscalerType}` : ""}
          {e.protonVersion ? ` · Proton ${e.protonVersion}` : ""}
        </div>
        {expanded && (
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.7, marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6 }}>
            <div>By {e.userName ?? "unknown"} · {new Date(e.createdAt).toLocaleDateString()}</div>
            <div>{settingsCount} settings</div>
            {e.osVersion && <div>OS: {e.osVersion}</div>}
          </div>
        )}
      </div>
    </PanelSectionRow>
  )
}

export default function LibraryAppPanel({ appId, title, hardwareSlug, baseUrl }: Props) {
  const [data, setData] = useState<PluginGameResponse | null>(null)
  const [devices, setDevices] = useState<PluginDeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [device, setDevice] = useState<string>(hardwareSlug ?? "")  // "" = all devices
  const [fetchError, setFetchError] = useState<string>("")
  const reqIdRef = useRef(0)

  useEffect(() => {
    setPluginApiBaseUrl(baseUrl)
    let cancelled = false
    const id = ++reqIdRef.current
    async function load() {
      setLoading(true)
      try {
        const d = await fetchPluginGame(appId, device || null, 3)
        if (cancelled || id !== reqIdRef.current) return
        if (d.error && !d.game) {
          setFetchError(d.error)
        } else {
          setFetchError("")
        }
        setData(d)
        setLoading(false)
        const devs = await fetchPluginDevices(appId)
        if (!cancelled && id === reqIdRef.current) setDevices(devs)
      } catch (e) {
        if (!cancelled && id === reqIdRef.current) {
          setData(null)
          setFetchError("Request failed")
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [appId, device, baseUrl])

  if (loading) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ padding: "8px 0", fontSize: "12px", opacity: 0.6 }}>Loading DeckyVault…</div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  const deviceOptions = [
    { label: "All devices", data: "" },
    ...(hardwareSlug ? [{ label: `Your device (${hardwareSlug})`, data: hardwareSlug }] : []),
    ...devices
      .filter((d) => d.slug !== hardwareSlug)
      .map((d) => ({ label: `${d.name} (${d.count})`, data: d.slug })),
  ]

  if (fetchError) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "6px 0", opacity: 0.7, color: "#e74c3c" }}>
            <FaTimes /> Could not load DeckyVault data. Please try again later.
          </div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  if (!data || !data.game) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "6px 0", opacity: 0.7 }}>
            <FaTimes /> Not in DeckyVault yet. Open <strong>{title}</strong> on{" "}
            <a href={`${baseUrl}/games`}>deckyvault.xyz</a> to add it.
          </div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="DeckyVault">
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <FaCheck style={{ color: "#2ecc71" }} /> In DeckyVault
        </div>
      </PanelSectionRow>

      {/* Est FPS */}
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <FaChartLine /> Est FPS
        </div>
      </PanelSectionRow>
      {data.estFps ? (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "0 0 6px 0" }}>
            <strong>{data.estFps.avg}</strong> avg · {data.estFps.low ?? "—"} low · {data.estFps.onePct ?? "—"} 1% · {data.estFps.high ?? "—"} high
            <span style={{ opacity: 0.5, fontSize: "11px" }}> · {data.estFps.count} entries</span>
          </div>
        </PanelSectionRow>
      ) : (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", opacity: 0.6, padding: "0 0 6px 0" }}>
            No entries for this device yet — be the first: open the DeckyVault plugin and record.
          </div>
        </PanelSectionRow>
      )}

      {/* Device switcher */}
      <PanelSectionRow>
        <DropdownItem
          label="Device"
          rgOptions={deviceOptions}
          selectedOption={device}
          onChange={(opt) => setDevice(opt.data as string)}
        />
      </PanelSectionRow>

      {/* Top entries */}
      {data.topEntries.length > 0 && (
        <>
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "8px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Top entries
            </div>
          </PanelSectionRow>
          {data.topEntries.map((e) => <EntryCard key={e.id} e={e} />)}
        </>
      )}
    </PanelSection>
  )
}