import { DeckyVaultImportV1 } from "@deckyvault/shared"

interface PluginSettings {
  apiKey: string
  autoRecord: boolean
  exportPath: string
}

let settings: PluginSettings = {
  apiKey: "",
  autoRecord: false,
  exportPath: "/home/deck/Downloads",
}

export default {
  name: "DeckyVault",
  content: () => {
    // Main plugin UI — will be implemented in a future phase
    return <div>DeckyVault Plugin</div>
  },
  onSettingUpdate: (newSettings: Partial<PluginSettings>) => {
    settings = { ...settings, ...newSettings }
  },
  onGameSessionStart: (appId: number) => {
    DeckyPlugin.log(`[DeckyVault] Game started: ${appId}`)
    // Future: start MangoHud monitoring
  },
  onGameSessionEnd: (appId: number) => {
    DeckyPlugin.log(`[DeckyVault] Game stopped: ${appId}`)
    // Future: stop monitoring, prompt export/upload
  },
}