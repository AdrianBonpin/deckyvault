// Steam Deck CEF context globals — these are Valve's internal APIs,
// available in the Steam Deck game mode browser context.
// Not part of @decky/api; accessed directly from the global scope.

declare global {
  const SteamClient: {
    Apps: {
      RegisterForGameActionStart: (
        callback: (gameActionId: number, appId: string, action: string, source: number) => void,
      ) => { unregister: () => void }
      RegisterForGameActionEnd: (
        callback: (gameActionId: number) => void,
      ) => { unregister: () => void }
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