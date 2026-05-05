import type { PrecacheEntry } from "@serwist/precaching";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "@serwist/strategies";
import { ExpirationPlugin } from "@serwist/expiration";
import { Serwist } from "serwist";

declare global {
  interface Window {
    __SW_MANIFEST: (string | PrecacheEntry)[];
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // Game detail pages: stale-while-revalidate, 24h max age
    {
      matcher: /\/game\/[\w-]+$/,
      handler: new StaleWhileRevalidate({
        cacheName: "game-pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
    // Game listing page: network-first (filters matter)
    {
      matcher: /\/games(\?.*)?$/,
      handler: new NetworkFirst({
        cacheName: "games-listing",
        plugins: [
          new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 5 * 60 }),
        ],
      }),
    },
    // Steam CDN images: cache-first, 30 days
    {
      matcher: /^https:\/\/cdn\.akamai\.steamstatic\.com\//,
      handler: new CacheFirst({
        cacheName: "steam-images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    // SteamGridDB images: cache-first, 30 days
    {
      matcher: /^https:\/\/cdn\d?\.steamgriddb\.com\//,
      handler: new CacheFirst({
        cacheName: "steamgrid-images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    // API responses: network-first (live data critical)
    {
      matcher: /\/api\//,
      handler: new NetworkFirst({
        cacheName: "api-responses",
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }),
        ],
      }),
    },
    // Navigation fallback: offline.html for uncached pages
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigation",
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
