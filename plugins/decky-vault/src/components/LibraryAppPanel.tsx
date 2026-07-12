import { useEffect, useState, useRef } from "react"
import { PanelSectionRow, DropdownItem, ButtonItem, staticClasses } from "@decky/ui"
import { Router } from "@decky/ui"
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

function openExternalUrl(url: string) {
  try {
    if (Router?.NavigateToExternalWeb) {
      Router.NavigateToExternalWeb(url)
      return
    }
  } catch (e) {
    console.error("[DeckyVault] NavigateToExternalWeb failed:", e)
  }
  try {
    window.open(url, "_blank")
  } catch (e) {
    console.error("[DeckyVault] window.open failed:", e)
  }
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

  const gameUrl = data?.game?.slug
    ? `${baseUrl}/games/${data.game.slug}`
    : `${baseUrl}/games`

  if (loading) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ padding: "8px 0", fontSize: "12px", opacity: 0.5, textAlign: "center" }}>
          DeckyVault loading…
        </div>
      </PanelSectionRow>
    )
  }

  if (fetchError) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 0", opacity: 0.5, color: "#e74c3c", textAlign: "center" }}>
          DeckyVault: {fetchError}
        </div>
      </PanelSectionRow>
    )
  }

  if (!data || !data.game) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 0", opacity: 0.5, textAlign: "center" }}>
          Not on DeckyVault — <a href={`${baseUrl}/games`}>add it</a>
        </div>
      </PanelSectionRow>
    )
  }

  return (
    <>
      {/* Centered stats row */}
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ padding: "4px 0", fontSize: "13px", textAlign: "center" }}>
          {data.estFps ? (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 10px", justifyContent: "center" }}>
              <span><strong>{data.estFps.avg}</strong> <span style={{ opacity: 0.4 }}>avg</span></span>
              {data.estFps.onePct != null && <span><strong>{data.estFps.onePct}</strong> <span style={{ opacity: 0.4 }}>1% low</span></span>}
              {data.estFps.low != null && <span><strong>{data.estFps.low}</strong> <span style={{ opacity: 0.4 }}>min</span></span>}
              {data.estFps.high != null && <span><strong>{data.estFps.high}</strong> <span style={{ opacity: 0.4 }}>max</span></span>}
              {data.estFps.tdpAvg != null && <span><strong>{data.estFps.tdpAvg}W</strong> <span style={{ opacity: 0.4 }}>TDP</span></span>}
              <span style={{ opacity: 0.4 }}>({data.estFps.count})</span>
            </span>
          ) : (
            <span style={{ opacity: 0.4, fontSize: "12px" }}>No data yet</span>
          )}
        </div>
      </PanelSectionRow>

      {/* Device dropdown */}
      <PanelSectionRow>
        <DropdownItem
          rgOptions={deviceOptions}
          selectedOption={device}
          onChange={(opt) => setDevice(opt.data as string)}
        />
      </PanelSectionRow>

      {/* View Details button */}
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => openExternalUrl(gameUrl)}>
          View Details
        </ButtonItem>
      </PanelSectionRow>
    </>
  )
}