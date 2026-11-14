import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    disable: process.env.VITE_BUILD_TARGET === 'mobile',
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'MapAI — Khám phá Đà Nẵng', short_name: 'MapAI', lang: 'vi',
      description: 'Bản đồ, địa điểm và chỉ đường Đà Nẵng dùng cả khi mất mạng.',
      theme_color: '#0F172A', background_color: '#0A0A0A', display: 'standalone',
      start_url: '/offline', scope: '/',
      icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json,pmtiles,pbf,webp,txt}'],
      maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true, clientsClaim: true,
      // No runtime caching of authenticated API responses or cloud AI requests.
    },
  })],
})
