import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png'],
      manifest: {
        id: 'ir.navanegar.radif',
        name: 'نوانگار — استودیوی جامع آموزش ردیف و موسیقی اصیل ایرانی',
        short_name: 'نوانگار',
        description:
          'آموزش تعاملی ۱۲ دستگاه و آواز ایرانی (۱۷۳ گوشه)، تیونر و DSP ربع‌پرده کُرُن و سُری، سنتز فیزیکی تار/سه‌تار/سنتور/نی و مترونوم ایرانی.',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#0d9488',
        categories: ['music', 'education'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font' || request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'navanegar-static-assets',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
            },
          },
          {
            urlPattern: ({ url }) => /\/samples\/.*\.(wav|json)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'navanegar-real-acoustic-samples-v2',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 180,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/firestore'],
          icons: ['lucide-react'],
          'radif-data': ['./src/data/radifData.ts', './src/data/persianPoetry.ts', './src/data/classicalPieces.ts'],
          'audio-dsp': ['./src/audio/karplusStrong.ts', './src/audio/sampleEngine.ts', './src/audio/instrumentBodyIR.ts', './src/audio/ornamentEngine.ts', './src/audio/dsp.ts'],
        },
      },
    },
  },
});
