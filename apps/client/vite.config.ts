import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@devilsdice/shared'],
  },
  // Base path for deployment (can be overridden via env)
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    // Output directory
    outDir: 'dist',
    // Generate sourcemaps for production debugging
    sourcemap: true,
    // Chunk optimization
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-socket': ['socket.io-client'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
})
