import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Geliştirmede /ws isteklerini Spring Boot'a yönlendirir.
// Build çıktısı backend'in static klasörüne yazılır; böylece Spring Boot tek başına her şeyi sunar.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true,
    // Phaser tek başına ~1.2 MB; tek sayfalık oyun için sorun değil.
    chunkSizeWarningLimit: 2000,
  },
})
