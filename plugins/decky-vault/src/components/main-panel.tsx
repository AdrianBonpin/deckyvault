import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  staticClasses,
} from "@decky/ui"
import {
  FaPlay,
  FaStop,
  FaClock,
  FaGamepad,
} from "react-icons/fa"
import type { RecordingState, SessionData, RecentSession, PluginSettings } from "../lib/store"
import SessionForm from "./session-form"

interface MainPanelProps {
  recordingState: RecordingState
  session: SessionData
  recentSessions: RecentSession[]
  error: string
  settings: PluginSettings
  onStart: () => void
  onStop: () => void
  onUpdateSession: (updates: Partial<SessionData>) => void
  onAddToRecent: (sess: SessionData) => void
  onReset: () => void
  setError: (msg: string) => void
  setGameName: (name: string, appId?: number) => void
}

export default function MainPanel({
  recordingState,
  session,
  recentSessions,
  error,
  settings,
  onStart,
  onStop,
  onUpdateSession,
  onAddToRecent,
  onReset,
  setError,
  setGameName,
}: MainPanelProps) {
  const [elapsed, setElapsed] = useState(0)

  // Timer for recording state
  useEffect(() => {
    if (recordingState !== "recording") {
      setElapsed(0)
      return
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [recordingState, session.startedAt])

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  // ── Stopped state: show the session form ──────────────────────
  if (recordingState === "stopped") {
    return (
      <SessionForm
        session={session}
        error={error}
        settings={settings}
        onUpdateSession={onUpdateSession}
        onAddToRecent={onAddToRecent}
        onReset={onReset}
        setError={setError}
      />
    )
  }

  // ── Idle or Recording state ───────────────────────────────────
  return (
    <PanelSection title="Recording">
      {error && (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ color: "#e74c3c", padding: "8px" }}>
            {error}
          </div>
        </PanelSectionRow>
      )}

      <PanelSectionRow>
        {recordingState === "idle" ? (
          <ButtonItem layout="below" onClick={onStart}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaPlay />
              Start Recording
            </div>
          </ButtonItem>
        ) : (
          <ButtonItem layout="below" onClick={onStop} disabled={false}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaStop />
              Stop Recording
            </div>
          </ButtonItem>
        )}
      </PanelSectionRow>

      {recordingState === "recording" && (
        <>
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <FaClock />
                <strong>{formatTime(elapsed)}</strong>
              </div>
              <div>
                {session.gameName
                  ? `Recording: ${session.gameName}`
                  : "No game detected — recording anyway"}
              </div>
            </div>
          </PanelSectionRow>
        </>
      )}

      {recordingState === "idle" && (
        <>
          <PanelSectionRow>
            <TextField
              label="Game Name"
              value={session.gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Cyberpunk 2077"
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ padding: "8px 0", fontSize: "12px", opacity: 0.7 }}>
              Enable MangoHud for your game, then press Start Recording before launching.
              Configure MangoHud in the Settings tab.
            </div>
          </PanelSectionRow>
        </>
      )}

      {recentSessions.length > 0 && recordingState === "idle" && (
        <PanelSection title="Recent Recordings">
          {recentSessions.map((rs, i) => (
            <PanelSectionRow key={i}>
              <div className={staticClasses.Text} style={{ padding: "4px 0", fontSize: "13px" }}>
                <strong>{rs.gameName || "Unknown game"}</strong>
                <br />
                <span style={{ opacity: 0.6 }}>
                  {rs.fpsAvg ? `${rs.fpsAvg} FPS avg` : "No data"} ·{" "}
                  {new Date(rs.date).toLocaleDateString()}
                </span>
              </div>
            </PanelSectionRow>
          ))}
        </PanelSection>
      )}
    </PanelSection>
  )
}