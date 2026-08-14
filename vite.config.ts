import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'TarihHub',
        short_name: 'TarihHub',
        description:
          'TarihHub — Қазақстан тарихын тірі оқыту: тарихи тұлғалармен AI арқылы сөйлесу, викториналар, уақыт сызығы және карта.',
        theme_color: '#F7F3EA',
        background_color: '#F7F3EA',
        display: 'standalone',
        start_url: '/',
        lang: 'kk',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Default cap is 2 MiB; the course content (60+ bilingual lessons and
        // their quiz pools) pushes the main bundle past that. Raised well
        // above the current size so it doesn't need revisiting as more
        // lessons land.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-shell-cache',
            },
          },
        ],
      },
    }),
  ],
})
