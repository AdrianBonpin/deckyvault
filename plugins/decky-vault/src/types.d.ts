// Decky Loader API type declarations
// These mirror the APIs available in the Steam Deck game mode CEF context

declare global {
  const DeckyPlugin: {
    log: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }

  const SteamClient: {
    Apps: {
      GetAppData: (appId: number) => Promise<{
        strAppName: string
        strShortcutName: string
        strExePath: string
      }>
      RegisterForGameStarted: (
        callback: (appId: number) => void,
      ) => { unregister: () => void }
      RegisterForGameStopped: (
        callback: (appId: number) => void,
      ) => { unregister: () => void }
    }
    System: {
      GetOSVersion: () => Promise<string>
    }
  }
}

export {}