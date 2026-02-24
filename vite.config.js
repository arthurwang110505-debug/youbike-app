import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 本機開發用的 proxy，解決 CORS 問題
    proxy: {
      '/api/youbike': {
        target: 'https://tcgbusfs.blob.core.windows.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/youbike/, '/dotapp/youbike/v2/youbike_immediate.json'),
        secure: true,
      }
    }
  }
})
