import { useState, useEffect, useRef } from "react"
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  staticClasses,
} from "@decky/ui"
import {
  definePlugin,
} from "@decky/api"
import { FaDatabase } from "react-icons/fa"
import MainPanel from "./components/main-panel"
import SettingsPanel from "./components/settings-panel"
import { useSettings, useSession } from "./lib/store"
import {
  readAndParseMangohudLog,
  clearMangohudLog,
  getHardwareInfo,
  getOsVersion,
  getProtonVersion,
  getLaunchOptions,
} from "./lib/api"

function Content() {
  const { settings, updateSetting, loaded } = useSettings()
  const {
    recordingState,
    session,
    recentSessions,
    error,
    setError,
    startRecording,
    stopRecording,
    updateSession,
    addToRecent,
    reset,
    onGameStart,
    onGameStop,
  } = useSession()
  const [activeTab, setActiveTab] = useState<"main" | "settings">("main")
  const gameStartedUnregRef = useRef<{ unregister: () => void } | null>(null)
  const gameStoppedUnregRef = useRef<{ unregister: () => void } | null>(null)

  // ── Register SteamClient game events ──────────────────────────
  useEffect(() => {
    try {
      const startedReg = SteamClient.Apps.RegisterForGameStarted(async (appId: number) => {
        let gameName = `App ${appId}`
        try {
          const info = await SteamClient.Apps.GetCurrentGameInfo()
          if (info.appId === appId) {
            gameName = info.strAppName
          }
        } catch {
          // GetCurrentGameInfo may not be available in all contexts
        }
        onGameStart(appId, gameName)
      })
      gameStartedUnregRef.current = startedReg

      const stoppedReg = SteamClient.Apps.RegisterForGameStopped((_appId: number) => {
        onGameStop()
      })
      gameStoppedUnregRef.current = stoppedReg
    } catch (e) {
      console.warn("[DeckyVault] SteamClient event registration failed:", e)
    }

    return () => {
      try {
        gameStartedUnregRef.current?.unregister()
        gameStoppedUnregRef.current?.unregister()
      } catch {
        // ignore
      }
    }
  }, [onGameStart, onGameStop])

  // ── Handle start recording ────────────────────────────────────
  async function handleStart() {
    // Clear any previous log file
    await clearMangohudLog()
    startRecording()
  }

  // ── Handle stop recording: parse log + read system info ────────
  async function handleStop() {
    stopRecording()

    // Parse the MangoHud log
    const logResult = await readAndParseMangohudLog()
    if (logResult.error) {
      setError(logResult.error)
      // Still transition to stopped state so user can see the error + manual fields
      return
    }

    // Read system info in parallel
    const [hwInfo, osVersion] = await Promise.all([
      getHardwareInfo(),
      getOsVersion(),
    ])

    // Read Proton version + launch options if we have an app ID
    let protonVersion = ""
    let launchOptions = ""
    if (session.appId) {
      const [pv, lo] = await Promise.all([
        getProtonVersion(session.appId),
        getLaunchOptions(session.appId),
      ])
      protonVersion = pv
      launchOptions = lo
    }

    // Use settings hardware override if set, otherwise auto-detected
    const hardwareSlug = settings.hardwareSlug || hwInfo.slug

    updateSession({
      fpsAvg: logResult.fpsAvg ?? null,
      fpsLow: logResult.fpsLow ?? null,
      fpsHigh: logResult.fpsHigh ?? null,
      fpsOnePercentLow: logResult.fpsOnePercentLow ?? null,
      tdpWatts: logResult.tdpWatts ?? null,
      hardwareSlug,
      hardwareName: hwInfo.name,
      osVersion,
      protonVersion,
      launchOptions,
    })
  }

  if (!loaded) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ padding: "16px", textAlign: "center" }}>
            Loading...
          </div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  return (
    <>
      {/* ── Tab navigation ──────────────────────────────────────── */}
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => setActiveTab("main")}
          >
            {activeTab === "main" ? "▶ Record" : "Record"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => setActiveTab("settings")}
          >
            {activeTab === "settings" ? "▶ Settings" : "Settings"}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {activeTab === "main" ? (
        <MainPanel
          recordingState={recordingState}
          session={session}
          recentSessions={recentSessions}
          error={error}
          settings={settings}
          onStart={handleStart}
          onStop={handleStop}
          onUpdateSession={updateSession}
          onAddToRecent={addToRecent}
          onReset={reset}
          setError={setError}
        />
      ) : (
        <SettingsPanel
          settings={settings}
          onUpdateSetting={updateSetting}
        />
      )}
    </>
  )
}

export default definePlugin(() => {
  return {
    name: "DeckyVault",
    titleView: <div className={staticClasses.Title}>DeckyVault</div>,
    content: <Content />,
    icon: <FaDatabase />,
    alwaysRender: false,
    onDismount() {
      console.log("[DeckyVault] Plugin unloading")
    },
  }
})