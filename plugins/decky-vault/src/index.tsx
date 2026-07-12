import {
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from "@decky/ui"
import {
  definePlugin,
} from "@decky/api"
import { FaChartLine } from "react-icons/fa"
import MainPanel from "./components/main-panel"
import { useSettings, useSession, useGameDetection } from "./lib/store"
import {
  readAndParseMangohudLog,
  clearMangohudLog,
  deleteLogFile,
  findMangohudLog,
  startMangohudLogging,
  stopMangohudLogging,
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
    setGameName,
    setLastLogPath,
  } = useSession()

  // ── Game detection via polling ────────────────────────────────
  useGameDetection(setGameName, recordingState)

  // ── Handle start recording ────────────────────────────────────
  async function handleStart() {
    // Clear the previous session's specific log if we know it; else safe-clear.
    const prev = session.lastLogPath
    if (prev) {
      await deleteLogFile(prev)
    } else {
      await clearMangohudLog()
    }
    // Fire-and-forget: try to start MangoHud logging (retries until game launches)
    startMangohudLogging()
    startRecording()
  }

  // ── Handle stop recording: parse log + read system info ────────
  async function handleStop() {
    try {
      // Try to stop MangoHud logging (best-effort, may fail if game already closed)
      await stopMangohudLogging()
      stopRecording()

      // Find the most recent MangoHud log, parse it, remember its path
      const logPath = await findMangohudLog()
      const logResult = await readAndParseMangohudLog(logPath.path ?? undefined)
      if (logResult.error) {
        setError(logResult.error)
        setLastLogPath(null)
        return
      }
      setLastLogPath(logPath.path ?? null)

      // Read system info in parallel
      const [hwInfo, osVersion] = await Promise.all([
        getHardwareInfo(),
        getOsVersion(),
      ])

      // Read Proton version + launch options if we have an app ID
      let protonVersion = ""
      let launchOptions = ""
      const currentAppId = session.appId
      if (currentAppId) {
        try {
          const [pv, lo] = await Promise.all([
            getProtonVersion(currentAppId),
            getLaunchOptions(currentAppId),
          ])
          protonVersion = pv
          launchOptions = lo
        } catch {
          // Non-critical, continue without
        }
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
    } catch (e) {
      console.error("[DeckyVault] Error stopping recording:", e)
      setError("Failed to process recording. Check the MangoHud log.")
    }
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
        setGameName={setGameName}
        onUpdateSetting={updateSetting}
      />
    </>
  )
}

// ── DeckyVault icon (flat SVG) ────────────────────────────────
function DeckyVaultIcon() {
  return (
    <svg
      viewBox="0 0 2000 2000"
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        fillRule: "evenodd",
        clipRule: "evenodd",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: 1.5,
      }}
    >
      <g transform="matrix(1,0,0,1,0,37.09322)">
        <g transform="matrix(0.861784,0,0,0.861784,133.476373,498.392836)">
          <g transform="matrix(1.160384,0,0,1.160384,-154.883825,-621.369358)">
            <path
              d="M1729.5,1227.837L1729.5,1549.724C1729.5,1640.166 1656.072,1713.593 1565.63,1713.593L433.04,1713.593C343.332,1713.593 270.5,1640.762 270.5,1551.053L270.5,1228.241C270.5,1173.107 315.262,1128.345 370.396,1128.345L1630.008,1128.345C1684.919,1128.345 1729.5,1172.926 1729.5,1227.837ZM573.241,1362.037C573.241,1347.001 561.033,1334.793 545.996,1334.793L440.872,1334.793C425.835,1334.793 413.627,1347.001 413.627,1362.037L413.627,1467.162C413.627,1482.198 425.835,1494.406 440.872,1494.406L545.996,1494.406C561.033,1494.406 573.241,1482.198 573.241,1467.162L573.241,1362.037ZM506.173,1203.28C477.429,1203.28 454.093,1226.617 454.093,1255.361C454.093,1284.105 477.429,1307.441 506.173,1307.441C534.917,1307.441 558.253,1284.105 558.253,1255.361C558.253,1226.617 534.917,1203.28 506.173,1203.28ZM1371.919,1256.579C1371.919,1225.929 1347.036,1201.045 1316.386,1201.045L675.371,1201.045C644.721,1201.045 619.838,1225.929 619.838,1256.579L619.838,1593.602C619.838,1624.252 644.721,1649.136 675.371,1649.136L1316.386,1649.136C1347.036,1649.136 1371.919,1624.252 1371.919,1593.602L1371.919,1256.579ZM1629.368,1260.092C1619.752,1260.092 1611.946,1267.899 1611.946,1277.515C1611.946,1287.131 1619.752,1294.937 1629.368,1294.937C1638.984,1294.937 1646.791,1287.131 1646.791,1277.515C1646.791,1267.899 1638.984,1260.092 1629.368,1260.092ZM1629.368,1173.745C1619.752,1173.745 1611.946,1181.552 1611.946,1191.168C1611.946,1200.784 1619.752,1208.59 1629.368,1208.59C1638.984,1208.59 1646.791,1200.784 1646.791,1191.168C1646.791,1181.552 1638.984,1173.745 1629.368,1173.745ZM1671.673,1216.769C1662.057,1216.769 1654.25,1224.576 1654.25,1234.191C1654.25,1243.807 1662.057,1251.614 1671.673,1251.614C1681.288,1251.614 1689.095,1243.807 1689.095,1234.191C1689.095,1224.576 1681.288,1216.769 1671.673,1216.769ZM1586.56,1216.769C1576.944,1216.769 1569.137,1224.576 1569.137,1234.191C1569.137,1243.807 1576.944,1251.614 1586.56,1251.614C1596.176,1251.614 1603.983,1243.807 1603.983,1234.191C1603.983,1224.576 1596.176,1216.769 1586.56,1216.769ZM353.679,1252.925L353.679,1276.615C353.679,1282.358 358.341,1287.021 364.085,1287.021L380.656,1287.021C386.446,1287.021 391.147,1282.32 391.147,1276.53L391.147,1252.925L418.873,1252.925C422.388,1252.925 425.242,1250.071 425.242,1246.556L425.242,1221.853C425.242,1218.323 422.377,1215.457 418.847,1215.457L391.147,1215.457L391.147,1187.731C391.147,1184.216 388.293,1181.362 384.777,1181.362L360.074,1181.362C356.544,1181.362 353.679,1184.227 353.679,1187.757L353.679,1215.457L329.989,1215.457C324.246,1215.457 319.583,1220.12 319.583,1225.863L319.583,1242.434C319.583,1248.225 324.284,1252.925 330.074,1252.925L353.679,1252.925ZM1491.737,1203.28C1462.993,1203.28 1439.657,1226.617 1439.657,1255.361C1439.657,1284.105 1462.993,1307.441 1491.737,1307.441C1520.481,1307.441 1543.818,1284.105 1543.818,1255.361C1543.818,1226.617 1520.481,1203.28 1491.737,1203.28ZM1584.585,1362.037C1584.585,1347.001 1572.377,1334.793 1557.34,1334.793L1452.216,1334.793C1437.179,1334.793 1424.972,1347.001 1424.972,1362.037L1424.972,1467.162C1424.972,1482.198 1437.179,1494.406 1452.216,1494.406L1557.34,1494.406C1572.377,1494.406 1584.585,1482.198 1584.585,1467.162L1584.585,1362.037Z"
              fill="currentColor" stroke="currentColor" strokeWidth="1"
            />
          </g>
          <g transform="matrix(0.883612,0,0,0.904278,106.86691,103.779729)">
            <path
              d="M1975,773.67L1975,1186.72C1975,1302.777 1878.573,1397 1759.802,1397L272.452,1397C154.645,1397 59,1303.541 59,1188.426L59,774.189C59,703.439 117.783,646 190.187,646L1844.344,646C1916.455,646 1975,703.207 1975,773.67Z"
              fill="none" stroke="currentColor" strokeWidth="64.9"
            />
          </g>
        </g>
        <g transform="matrix(1,0,0,1,-0,-24.728814)">
          <path
            d="M323,1000L323,891.398C323,841.926 363.195,801.76 412.704,801.76L640.543,801.76L479.436,640.773C444.428,605.791 444.428,548.988 479.436,514.006L563.141,430.363C598.149,395.381 654.994,395.381 690.002,430.363L851.108,591.351L851.108,363.68C851.108,314.208 891.303,274.042 940.812,274.042L1059.188,274.042C1108.697,274.042 1148.892,314.208 1148.892,363.68L1148.892,591.351L1309.998,430.363C1345.006,395.381 1401.851,395.381 1436.859,430.363L1520.564,514.006C1555.572,548.988 1555.572,605.791 1520.564,640.773L1359.457,801.76L1587.296,801.76C1636.805,801.76 1677,841.926 1677,891.398L1677,1000L1180.034,1000C1184.251,984.222 1186.5,967.643 1186.5,950.542C1186.5,844.971 1100.789,759.26 995.218,759.26C889.646,759.26 803.935,844.971 803.935,950.542C803.935,967.643 806.184,984.222 810.401,1000L323,1000Z"
            fill="currentColor" stroke="currentColor" strokeWidth="50"
          />
          <path
            d="M323,1000L323,891.398C323,841.926 363.195,801.76 412.704,801.76L640.543,801.76L479.436,640.773C444.428,605.791 444.428,548.988 479.436,514.006L563.141,430.363C598.149,395.381 654.994,395.381 690.002,430.363L851.108,591.351L851.108,363.68C851.108,314.208 891.303,274.042 940.812,274.042L1059.188,274.042C1108.697,274.042 1148.892,314.208 1148.892,363.68L1148.892,591.351L1309.998,430.363C1345.006,395.381 1401.851,395.381 1436.859,430.363L1520.564,514.006C1555.572,548.988 1555.572,605.791 1520.564,640.773L1359.457,801.76L1587.296,801.76C1636.805,801.76 1677,841.926 1677,891.398L1677,1000L1180.034,1000C1184.251,984.222 1186.5,967.643 1186.5,950.542C1186.5,844.971 1100.789,759.26 995.218,759.26C889.646,759.26 803.935,844.971 803.935,950.542C803.935,967.643 806.184,984.222 810.401,1000L323,1000Z"
            fill="none" stroke="currentColor" strokeWidth="50"
          />
        </g>
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
    alwaysRender: true,
    onDismount() {
      console.log("[DeckyVault] Plugin unloading")
    },
  }
})