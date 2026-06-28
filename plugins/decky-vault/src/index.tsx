import { useEffect, useRef } from "react"
import {
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from "@decky/ui"
import {
  definePlugin,
} from "@decky/api"
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
      <SettingsPanel
        settings={settings}
        onUpdateSetting={updateSetting}
      />
    </>
  )
}

// ── DeckyVault icon (flat SVG) ────────────────────────────────
function DeckyVaultIcon() {
  return (
    <svg
      viewBox="0 0 1509 1478"
      width="24"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="matrix(0.12,0,0,0.12,50,50)">
        <path
          d="M1729.5,1227.837L1729.5,1549.724C1729.5,1640.166 1656.072,1713.593 1565.63,1713.593L433.04,1713.593C343.332,1713.593 270.5,1640.762 270.5,1551.053L270.5,1228.241C270.5,1173.107 315.262,1128.345 370.396,1128.345L1630.008,1128.345C1684.919,1128.345 1729.5,1172.926 1729.5,1227.837Z"
          fill="white"
        />
        <path
          d="M323,1000L323,891.398C323,841.926 363.195,801.76 412.704,801.76L640.543,801.76L479.436,640.773C444.428,605.791 444.428,548.988 479.436,514.006L563.141,430.363C598.149,395.381 654.994,395.381 690.002,430.363L851.108,591.351L851.108,363.68C851.108,314.208 891.303,274.042 940.812,274.042L1059.188,274.042C1108.697,274.042 1148.892,314.208 1148.892,363.68L1148.892,591.351L1309.998,430.363C1345.006,395.381 1401.851,395.381 1436.859,430.363L1520.564,514.006C1555.572,548.988 1555.572,605.791 1520.564,640.773L1359.457,801.76L1587.296,801.76C1636.805,801.76 1677,841.926 1677,891.398L1677,1000Z"
          fill="white"
        />
      </g>
    </svg>
  )
}

export default definePlugin(() => {
  return {
    name: "DeckyVault",
    titleView: <div className={staticClasses.Title}>DeckyVault</div>,
    content: <Content />,
    icon: <DeckyVaultIcon />,
    alwaysRender: false,
    onDismount() {
      console.log("[DeckyVault] Plugin unloading")
    },
  }
})