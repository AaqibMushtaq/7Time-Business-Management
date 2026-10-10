import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
            // Core react runtime (first to prevent any leakage)
            if (
              norm.includes('/react/') || 
              norm.includes('/react-dom/') || 
              norm.includes('/react-router/') || 
              norm.includes('/react-router-dom/') || 
              norm.includes('/scheduler/')
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
            // TanStack Query
            if (norm.includes('/@tanstack/react-query/')) {
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
            // Charts (strictly isolated, only loaded when charts render)
            if (norm.includes('/recharts/') || norm.includes('/d3-')) {
              return 'vendor-charts'
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
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/**'],
  }
})

