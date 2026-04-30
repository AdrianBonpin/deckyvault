"use client";

import { useState, useEffect } from "react";
import {
  Gamepad2,
  BarChart3,
  Users,
  AlertTriangle,
  MessageSquarePlus,
  TrendingUp,
  Shield,
  ShieldX,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStats {
  overview: {
    totalGames: number;
    totalBenchmarks: number;
    totalUsers: number;
    pendingReports: number;
    pendingSuggestions: number;
  };
  recent: {
    benchmarksLast30Days: number;
    gamesLast30Days: number;
  };
  topContributors: Array<{
    userId: string;
    name: string;
    count: number;
  }>;
  syncHealth: Record<string, number>;
  gamesBySource: Record<string, number>;
  playabilityDistribution: Record<string, number>;
}

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 rounded-lg bg-zinc-800" />;
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Games",
      value: stats.overview.totalGames,
      icon: Gamepad2,
      color: "text-blue-400",
    },
    {
      label: "Total Benchmarks",
      value: stats.overview.totalBenchmarks,
      icon: BarChart3,
      color: "text-green-400",
    },
    {
      label: "Total Users",
      value: stats.overview.totalUsers,
      icon: Users,
      color: "text-purple-400",
    },
    {
      label: "Pending Reports",
      value: stats.overview.pendingReports,
      icon: AlertTriangle,
      color: "text-red-400",
      highlight: stats.overview.pendingReports > 0,
    },
    {
      label: "Pending Suggestions",
      value: stats.overview.pendingSuggestions,
      icon: MessageSquarePlus,
      color: "text-amber-400",
      highlight: stats.overview.pendingSuggestions > 0,
    },
    {
      label: "Benchmarks (30d)",
      value: stats.recent.benchmarksLast30Days,
      icon: TrendingUp,
      color: "text-emerald-400",
    },
    {
      label: "New Games (30d)",
      value: stats.recent.gamesLast30Days,
      icon: Gamepad2,
      color: "text-cyan-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={cn(
                "rounded-lg border bg-zinc-900 p-4",
                card.highlight ? "border-amber-500/30" : "border-zinc-800"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn("h-4 w-4", card.color)} />
                <span className="text-xs text-zinc-500">{card.label}</span>
              </div>
              <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      {/* Grid: Top Contributors + Playability Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Contributors */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-4 font-semibold">Top Contributors</h3>
          <div className="space-y-2">
            {stats.topContributors.slice(0, 5).map((contributor, i) => (
              <div
                key={contributor.userId}
                className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-500">#{i + 1}</span>
                  <span className="text-sm">{contributor.name}</span>
                </div>
                <span className="text-sm font-medium text-zinc-400">
                  {contributor.count} entries
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Playability Distribution */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-4 font-semibold">Playability Distribution</h3>
          <div className="space-y-2">
            {Object.entries(stats.playabilityDistribution).map(([status, count]) => {
              const config: Record<string, { label: string; color: string }> = {
                great: { label: "Plays Great", color: "bg-emerald-500" },
                playable: { label: "Playable", color: "bg-blue-500" },
                needs_tweaks: { label: "Needs Tweaks", color: "bg-amber-500" },
                unplayable: { label: "Unplayable", color: "bg-red-500" },
                unknown: { label: "Unknown", color: "bg-zinc-500" },
              };
              const c = config[status] ?? config.unknown;

              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full", c.color)} />
                  <span className="flex-1 text-sm">{c.label}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sync Health */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-4 font-semibold">Steam Sync Health</h3>
        <div className="flex gap-4">
          {Object.entries(stats.syncHealth).map(([status, count]) => {
            const icons: Record<string, typeof Shield> = {
              synced: ShieldCheck,
              failed: ShieldX,
              pending: Shield,
            };
            const colors: Record<string, string> = {
              synced: "text-green-400",
              failed: "text-red-400",
              pending: "text-yellow-400",
            };
            const Icon = icons[status] ?? Shield;
            const color = colors[status] ?? "text-zinc-400";

            return (
              <div key={status} className="flex items-center gap-2">
                <Icon className={cn("h-5 w-5", color)} />
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs capitalize text-zinc-500">{status}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
