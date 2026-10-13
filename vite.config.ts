import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const appVersion = '1.2.0'
const buildTime = new Date().toISOString()

function versionPlugin(): Plugin {
  return {
    name: 'generate-version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: appVersion,
          buildTime,
          builtAt: Date.now()
        }, null, 2)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), tailwindcss(), versionPlugin()],
  base: '/7Time-Business-Management/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/')
          if (norm.includes('/node_modules/')) {
            // Recharts, d3, redux-toolkit, immer, etc. must remain 100% dynamic (loaded only on chart routes)
            if (
              norm.includes('/recharts/') || 
              norm.includes('/d3-') || 
              norm.includes('/victory-vendor/') ||
              norm.includes('/decimal.js-light/') ||
              norm.includes('/internmap/') ||
              norm.includes('/redux') ||
              norm.includes('/immer/') ||
              norm.includes('/reselect/') ||
              norm.includes('/es-toolkit/') ||
              norm.includes('/eventemitter3/')
            ) {
              return undefined
            }
            // Core react runtime
            if (
              norm.includes('/react/') || 
              norm.includes('/react-dom/') || 
              norm.includes('/react-router/') || 
              norm.includes('/react-router-dom/') || 
              norm.includes('/scheduler/') ||
              norm.includes('/use-sync-external-store/') ||
              norm.includes('/react-is/')
            ) {
              return 'vendor-react'
            }
            // Shared styling utilities
            if (
              norm.includes('/clsx/') || 
              norm.includes('/tailwind-merge/') || 
              norm.includes('/class-variance-authority/')
            ) {
              return 'vendor-utils'
            }
            // TanStack Query runtime & core
            if (norm.includes('/@tanstack/')) {
              return 'vendor-query'
            }
            // Supabase client SDK
            if (norm.includes('/@supabase/')) {
              return 'vendor-supabase'
            }
            // UI & Icons
            if (norm.includes('/lucide-react/')) {
              return 'vendor-icons'
            }
            if (norm.includes('/@radix-ui/')) {
              return 'vendor-ui'
            }
            return 'vendor-misc'
          }
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
    testTimeout: 10000,
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/**'],
  }
})

