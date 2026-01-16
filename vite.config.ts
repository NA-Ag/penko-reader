import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: command === 'build' ? './' : '/',
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
            icons: [
              {
                src: 'penguin-reader-logo.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: 'penguin-reader-logo.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              }
            ]
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
