import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

const MAX_PRECACHE_BYTES = 6 * 1024 * 1024;
const TILE_CACHE_ENTRIES = 3000;
const TILE_CACHE_SECONDS = 60 * 60 * 24 * 30;

export default defineConfig({
  plugins: [
    varlockVitePlugin({ ssrInjectMode: "auto-load" }),
    tailwindcss(),
    tanstackRouter({
      autoCodeSplitting: true,
      target: "react",
    }),
    react(),
    VitePWA({
      injectRegister: false,
      manifest: {
        background_color: "#F4F3EC",
        description:
          "Inventario forestal de bosque seco: registro en campo sin conexión y gestión en escritorio.",
        display: "standalone",
        icons: [
          { sizes: "192x192", src: "/pwa-192.png", type: "image/png" },
          { sizes: "512x512", src: "/pwa-512.png", type: "image/png" },
          {
            purpose: "maskable",
            sizes: "512x512",
            src: "/pwa-maskable-512.png",
            type: "image/png",
          },
        ],
        lang: "es",
        name: "Inventario Forestal AIDER",
        scope: "/",
        short_name: "Inventario",
        start_url: "/",
        theme_color: "#245237",
      },
      registerType: "prompt",
      workbox: {
        cleanupOutdatedCaches: true,
        globIgnores: ["**/maplibre-gl-*.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/trpc\//],
        runtimeCaching: [
          {
            handler: "CacheFirst",
            options: {
              cacheableResponse: { statuses: [0, 200] },
              cacheName: "map-tiles",
              expiration: {
                maxAgeSeconds: TILE_CACHE_SECONDS,
                maxEntries: TILE_CACHE_ENTRIES,
              },
            },
            urlPattern: /^https:\/\/[a-c]?\.?tile\.openstreetmap\.org\/.*/i,
          },
        ],
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3001,
  },
  worker: {
    format: "es",
  },
});
