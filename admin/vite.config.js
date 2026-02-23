import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0'
  },
  build: {
    // manualChunks حذف شد - علت circular dependency بین chunk‌ها بود
    // Vite خودش به صورت هوشمند code splitting انجام میده
    // بدون ایجاد وابستگی دایره‌ای
  }
})

