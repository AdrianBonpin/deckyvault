import { useEffect, useState, useRef } from "react"
import { PanelSectionRow, DialogButtonPrimary, staticClasses } from "@decky/ui"
import { Router } from "@decky/ui"
import {
  fetchPluginGame,
  setPluginApiBaseUrl,
  type PluginGameResponse,
} from "../lib/plugin-api"
import { getHardwareInfo } from "../lib/api"

interface Props {
  appId: number
  title: string
  hardwareSlug: string | null      // detected device (from settings, may be null)
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
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string>("")
  const [detectedSlug, setDetectedSlug] = useState<string | null>(hardwareSlug ?? null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    setPluginApiBaseUrl(baseUrl)
    let cancelled = false
    const id = ++reqIdRef.current
    async function load() {
      setLoading(true)
      try {
        // Detect hardware if not set in settings
        let slug = hardwareSlug ?? null
        if (!slug) {
          try {
            const hw = await getHardwareInfo()
            if (hw.slug && hw.slug !== "unknown") slug = hw.slug
          } catch {
            // Fall back to global
          }
          if (!cancelled) setDetectedSlug(slug)
        }

        const d = await fetchPluginGame(appId, slug, 3)
        if (cancelled || id !== reqIdRef.current) return
        setFetchError(d.error && !d.game ? d.error : "")
        setData(d)
        setLoading(false)
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
  }, [appId, baseUrl])  // re-fetch only when app changes

  const gameUrl = data?.game?.steamAppId
    ? `${baseUrl}/game/${data.game.steamAppId}`
    : `${baseUrl}/games`

  if (loading) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ padding: "8px 16px", fontSize: "12px", opacity: 0.5, textAlign: "center" }}>
          DeckyVault loading…
        </div>
      </PanelSectionRow>
    )
  }

  if (fetchError) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 16px", opacity: 0.5, color: "#e74c3c", textAlign: "center" }}>
          DeckyVault: {fetchError}
        </div>
      </PanelSectionRow>
    )
  }

  if (!data || !data.game) {
    return (
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "8px 16px", opacity: 0.5, textAlign: "center" }}>
          Not on DeckyVault — <a href={`${baseUrl}/games`}>add it</a>
        </div>
      </PanelSectionRow>
    )
  }

  return (
    <PanelSectionRow>
      <div className={staticClasses.Text} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 16px", fontSize: "13px" }}>
        {/* Stats */}
        <span style={{ flex: 1 }}>
          {data.estFps ? (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 8px" }}>
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
          {/* Device scope badge */}
          <span style={{ fontSize: "10px", opacity: 0.4, marginLeft: "4px" }}>
            {detectedSlug ? detectedSlug : <span style={{ color: "#e0a030" }}>⚠ global</span>}
          </span>
        </span>
        {/* View Details — constrained width */}
        <div style={{ flexShrink: 0, width: "130px" }}>
          <DialogButtonPrimary onClick={() => openExternalUrl(gameUrl)}>
            View Details
          </DialogButtonPrimary>
        </div>
      </div>
    </PanelSectionRow>
  )
}