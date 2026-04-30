import { Elysia } from "elysia";
import { db } from "@/lib/db/index";
import {
  games,
  performanceEntries,
  reports,
  communitySuggestions,
  user,
} from "@/lib/db/schema";
import { eq, count, sql, gte, and, desc } from "drizzle-orm";
import { requireContributorOrAdmin } from "@/lib/auth/guard";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" }).get(
  "/stats",
  async ({ request, set }) => {
    const guard = await requireContributorOrAdmin(request.headers);
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalGames,
      totalBenchmarks,
      totalUsers,
      pendingReports,
      pendingSuggestions,
      recentBenchmarks,
      recentGames,
      topContributors,
      syncHealth,
      gamesBySource,
      playabilityDistribution,
    ] = await Promise.all([
      // Total games
      db.select({ count: count() }).from(games),

      // Total benchmarks
      db
        .select({ count: count() })
        .from(performanceEntries)
        .where(eq(performanceEntries.isRemoved, false)),

      // Total users
      db.select({ count: count() }).from(user),

      // Pending reports
      db
        .select({ count: count() })
        .from(reports)
        .where(eq(reports.status, "open")),

      // Pending suggestions
      db
        .select({ count: count() })
        .from(communitySuggestions)
        .where(eq(communitySuggestions.status, "pending")),

      // Benchmarks in last 30 days
      db
        .select({ count: count() })
        .from(performanceEntries)
        .where(
          and(
            eq(performanceEntries.isRemoved, false),
            gte(performanceEntries.createdAt, thirtyDaysAgo),
          ),
        ),

      // Games added in last 30 days
      db
        .select({ count: count() })
        .from(games)
        .where(gte(games.createdAt, thirtyDaysAgo)),

      // Top contributors
      db
        .select({
          userId: performanceEntries.userId,
          userName: user.name,
          entryCount: count(),
        })
        .from(performanceEntries)
        .leftJoin(user, eq(performanceEntries.userId, user.id))
        .where(eq(performanceEntries.isRemoved, false))
        .groupBy(performanceEntries.userId, user.name)
        .orderBy(desc(count()))
        .limit(10),

      // Sync health
      db
        .select({
          status: games.syncStatus,
          count: count(),
        })
        .from(games)
        .where(sql`${games.steamAppId} IS NOT NULL`)
        .groupBy(games.syncStatus),

      // Games by source
      db
        .select({
          source: games.source,
          count: count(),
        })
        .from(games)
        .groupBy(games.source),

      // Playability distribution
      db
        .select({
          status: games.playabilityStatus,
          count: count(),
        })
        .from(games)
        .where(sql`${games.playabilityStatus} IS NOT NULL`)
        .groupBy(games.playabilityStatus),
    ]);

    return {
      overview: {
        totalGames: totalGames[0]?.count ?? 0,
        totalBenchmarks: totalBenchmarks[0]?.count ?? 0,
        totalUsers: totalUsers[0]?.count ?? 0,
        pendingReports: pendingReports[0]?.count ?? 0,
        pendingSuggestions: pendingSuggestions[0]?.count ?? 0,
      },
      recent: {
        benchmarksLast30Days: recentBenchmarks[0]?.count ?? 0,
        gamesLast30Days: recentGames[0]?.count ?? 0,
      },
      topContributors: topContributors.map((c) => ({
        userId: c.userId,
        name: c.userName ?? "Anonymous",
        count: c.entryCount,
      })),
      syncHealth: syncHealth.reduce(
        (acc, s) => {
          acc[s.status ?? "unknown"] = s.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      gamesBySource: gamesBySource.reduce(
        (acc, s) => {
          acc[s.source ?? "unknown"] = s.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      playabilityDistribution: playabilityDistribution.reduce(
        (acc, p) => {
          acc[p.status ?? "unknown"] = p.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  },
);