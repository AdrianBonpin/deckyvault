import { useEffect, useState, useRef } from "react"
import { PanelSectionRow, DropdownItem, staticClasses } from "@decky/ui"
import {
  fetchPluginGame,
  fetchPluginDevices,
  setPluginApiBaseUrl,
  type PluginGameResponse,
  type PluginDeviceRow,
} from "../lib/plugin-api"

interface Props {
  appId: number
  title: string
  hardwareSlug: string | null      // detected device
  baseUrl: string
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
        setFetchError(d.error && !d.game ? d.error : "")
        setData(d)
        setLoading(false)
        const devs = await fetchPluginDevices(appId)
        if (!cancelled && id === reqIdRef.current) setDevices(devs)
      } catch {
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

  const deviceOptions = [
    { label: "All devices", data: "" },
    ...(hardwareSlug ? [{ label: `Your device (${hardwareSlug})`, data: hardwareSlug }] : []),
    ...devices
      .filter((d) => d.slug !== hardwareSlug)
      .map((d) => ({ label: `${d.name} (${d.count})`, data: d.slug })),
  ]

  // Minimal single-row stats — no header, no entry cards
  if (loading) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ padding: "8px 0", fontSize: "12px", opacity: 0.5 }}>
          DeckyVault loading…
        </div>
      </PanelSectionRow>
    )
  }

  if (fetchError) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 0", opacity: 0.5, color: "#e74c3c" }}>
          DeckyVault: {fetchError}
        </div>
      </PanelSectionRow>
    )
  }

  if (!data || !data.game) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 0", opacity: 0.5 }}>
          Not on DeckyVault — <a href={`${baseUrl}/games`}>add it</a>
        </div>
      </PanelSectionRow>
    )
  }

  return (
    <>
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "4px 0" }}>
          {device && data.estFps ? (
            <>
              <span style={{ opacity: 0.6 }}>DeckyVault est FPS:</span>
              <strong>{data.estFps.avg}</strong>
              <span style={{ opacity: 0.4, fontSize: "11px" }}>avg · {data.estFps.low ?? "—"} low · {data.estFps.high ?? "—"} high · {data.estFps.count} entries</span>
            </>
          ) : (
            <span style={{ opacity: 0.5, fontSize: "12px" }}>
              {device
                ? "No entries for this device yet"
                : "Select a device to see estimated FPS"}
            </span>
          )}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <DropdownItem
          rgOptions={deviceOptions}
          selectedOption={device}
          onChange={(opt) => setDevice(opt.data as string)}
        />
      </PanelSectionRow>
    </>
  )
}