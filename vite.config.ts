import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['penguin-reader-logo.svg', 'dicts/*.bin'],
          manifest: {
            name: 'Penko Reader',
            short_name: 'PenkoReader',
            description: 'Accessibility-focused offline reading tool',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: '/',
            scope: '/',
            orientation: 'any',
            icons: [
              {
                src: 'penguin-reader-logo.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,bin}'],
            navigateFallback: '/index.html',
            // Increase cache limit to 10MB to ensure dictionaries are cached
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
          }
        })
      ],
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext',
          supported: { 'top-level-await': true }
        }
      },
      build: {
        target: ['es2022', 'firefox78', 'safari14', 'edge88']
      },
      esbuild: {
        supported: {
          'top-level-await': true
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
