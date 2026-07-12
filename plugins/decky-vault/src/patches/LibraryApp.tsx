import {
  afterPatch,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
} from "@decky/ui"
import { routerHook } from "@decky/api"
import type { ReactElement } from "react"
import LibraryAppPanel from "../components/LibraryAppPanel"

// Mirror of HLTB-for-Deck's patchAppPage, guarded so a Steam UI change
// degrades to "section not shown" instead of crashing Steam.
function isSteamGameType(appType: number) {
  return appType === 1 || appType === 8 // Game, Demo
}

// These are supplied by the plugin at registration time (read from settings).
let panelProps: { hardwareSlug: string | null; baseUrl: string } = { hardwareSlug: null, baseUrl: "https://deckyvault.xyz" }
export function setLibraryAppPanelProps(p: { hardwareSlug: string | null; baseUrl: string }) {
  panelProps = p
}

export function registerLibraryAppPatch() {
  return routerHook.addPatch("/library/app/:appid", (routerTree: any) => {
    try {
      const routeProps = findInReactTree(routerTree, (x: any) => x?.renderFunc)
      if (!routeProps) return routerTree

      const patchHandler = createReactTreePatcher(
        [
          (tree: any) => {
            const child = findInReactTree(
              tree,
              (x: any) => x?.props?.children?.props?.overview,
            )
            if (!child) return null
            const overview = child.props.children.props.overview
            if (!overview || !isSteamGameType(overview.app_type)) return null
            return child.props.children
          },
        ],
        (_: Record<string, unknown>[], ret: ReactElement) => {
          try {
            const container = findInReactTree(
              ret,
              (x: any) =>
                Array.isArray(x?.props?.children) &&
                x?.props?.className?.includes(appDetailsClasses.InnerContainer),
            )
            const arr = container?.props?.children
            if (!Array.isArray(arr)) {
              console.debug("[DeckyVault] app-details: no splicable container (non-game page?)")
              return ret
            }
            const idx = arr.findIndex((child: any) => {
              const p = child?.props
              return (
                p?.childFocusDisabled !== undefined &&
                p?.navRef !== undefined &&
                p?.children?.props?.details !== undefined &&
                p?.children?.props?.overview !== undefined &&
                p?.children?.props?.bFastRender !== undefined
              )
            })
            if (idx > -1) {
              const overview = arr[idx]?.props?.children?.props?.overview
              arr.splice(
                idx,
                0,
                <LibraryAppPanel
                  appId={overview?.appid}
                  title={overview?.display_name ?? ""}
                  hardwareSlug={panelProps.hardwareSlug}
                  baseUrl={panelProps.baseUrl}
                />,
              )
            } else {
              console.debug("[DeckyVault] app-details: splicing anchor not found")
            }
          } catch (err) {
            console.error("[DeckyVault] app-details splice failed:", err)
          }
          return ret
        },
      )

      afterPatch(routeProps, "renderFunc", patchHandler)
    } catch (err) {
      console.error("[DeckyVault] library patch failed (degraded):", err)
    }
    return routerTree
  })
}