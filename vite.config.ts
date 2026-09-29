import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['penguin-logo.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: "Penko Reader",
        short_name: "Reader",
        description: "An offline-first, privacy-respecting reading app: cozy book reader, RSVP speed reader, training drills and dictionary.",
        categories: ["books", "education", "productivity"],
        start_url: "./",
        display: "standalone",
        background_color: "#FAF9F6",
        theme_color: "#C2571A",
        icons: [
          {
            src: "./penguin-logo.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "./pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "./pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        // Everything the app needs is bundled; precache it all (fonts, pdf worker, dictionaries).
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,wasm,bin,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html'
      }
    })
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Only React is split by hand. pdf.js and JSZip must stay in their own lazy chunks:
        // naming them here lets Rollup park shared helpers inside them, which drags them
        // into the startup bundle.
        manualChunks: {
          react: ['react', 'react-dom']
        }
      }
    }
  },
  base: './'
});