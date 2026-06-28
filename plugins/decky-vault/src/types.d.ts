// Steam Deck CEF context globals — these are Valve's internal APIs,
// available in the Steam Deck game mode browser context.
// Not part of @decky/api; accessed directly from the global scope.

declare global {
  const SteamClient: {
    Apps: {
      RegisterForGameStarted: (
        callback: (appId: number) => void,
      ) => { unregister: () => void }
      RegisterForGameStopped: (
        callback: (appId: number) => void,
      ) => { unregister: () => void }
      GetCurrentGameInfo: () => Promise<{
        appId: number
        strAppName: string
      }>
    }
    System: {
      GetOSVersion: () => Promise<string>
    }
    UI: {
      GetUIMode: () => Promise<number>
    }
  }
}

export {}