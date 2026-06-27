"use client"

import { useState, useCallback } from "react"
import { RefreshCwIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from "lucide-react"

interface StrategyResult {
  strategy: string
  versionString: string | null
  buildId: string | null
  success: boolean
  error: string | null
}

export default function TestVersionFetchersPage() {
  const [appId, setAppId] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<StrategyResult[] | null>(null)
  const [best, setBest] = useState<StrategyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTest = useCallback(async (id?: string) => {
    const targetId = id ?? appId
    if (!targetId.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)
    setBest(null)

    try {
      // Use the standalone endpoint — no DB lookup needed
      const testRes = await fetch(`/api/version-test?steamAppId=${encodeURIComponent(targetId)}`)
      if (!testRes.ok) {
        const errData = await testRes.json().catch(() => ({}))
        setError(errData.error || `API error: ${testRes.status}`)
        setLoading(false)
        return
      }
      const testData = await testRes.json()

      if (testData.error) {
        setError(testData.error)
        setLoading(false)
        return
      }

      setResults(testData.results)
      setBest(testData.best)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [appId])

  const handleQuickTest = useCallback((id: string) => {
    setAppId(id)
    runTest(id)
  }, [runTest])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Version Fetcher — Strategy Comparison</h1>
      <p className="text-sm text-text/60 mb-8">
        Enter a <strong>Steam App ID</strong> to test all version-fetching strategies.
        The best result (priority: named version &gt; build ID) will be highlighted.
      </p>

      {/* Input */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="Steam App ID (e.g., 730 for CS2)"
          className="flex-1 px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && runTest()}
        />
        <button
          onClick={() => runTest()}
          disabled={loading || !appId.trim()}
          className="px-6 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <RefreshCwIcon className="h-4 w-4 animate-spin" />
          ) : (
            "Test All"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-8">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Best Result */}
          {best ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                <h3 className="text-sm font-semibold text-green-400">
                  Best Result: {best.strategy}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text/40">Version String</p>
                  <p className="text-lg font-mono text-text">
                    {best.versionString || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text/40">Build ID</p>
                  <p className="text-lg font-mono text-text">
                    {best.buildId || "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                <p className="text-sm text-yellow-400">
                  No strategy found version data for this game.
                </p>
              </div>
            </div>
          )}

          {/* All Strategy Results */}
          <h3 className="text-sm font-semibold text-text mt-6 mb-3">
            All Strategy Results
          </h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  r.success
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/10 bg-red-500/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {r.success ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium text-text">
                      {r.strategy}
                    </span>
                  </div>
                  {r.error && (
                    <span className="text-xs text-red-400">{r.error}</span>
                  )}
                </div>
                {r.success && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div>
                      <span className="text-xs text-text/40">Version: </span>
                      <span className="text-sm font-mono text-text">
                        {r.versionString || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-text/40">Build: </span>
                      <span className="text-sm font-mono text-text">
                        {r.buildId || "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Test Buttons */}
      <div className="mt-8 p-4 rounded-lg border border-border bg-text/2">
        <h3 className="text-xs font-semibold text-text/40 mb-3">
          Quick Test (known Steam App IDs)
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "730", label: "CS2" },
            { id: "440", label: "TF2" },
            { id: "570", label: "Dota 2" },
            { id: "271590", label: "GTA V" },
            { id: "1174180", label: "RDR2" },
            { id: "1086940", label: "BG3" },
            { id: "1245620", label: "Elden Ring" },
            { id: "292030", label: "Witcher 3" },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => handleQuickTest(g.id)}
              className="px-3 py-1.5 rounded-md border border-border bg-text/5 text-xs text-text/60 hover:text-text hover:border-primary/50 transition-colors"
            >
              {g.label} ({g.id})
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
