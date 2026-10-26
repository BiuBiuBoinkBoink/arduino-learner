import { defineConfig } from 'vite'

// The help chat calls /api/tutor; the tutor server (npm run tutor) answers it.
const proxy = { '/api': 'http://localhost:7300' }

export default defineConfig({
  server: { proxy },
  preview: { proxy }
})
