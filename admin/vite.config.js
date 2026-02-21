import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const normalizedId = id.replace(/\\/g, '/')

          if (normalizedId.includes('/antd/') || normalizedId.includes('/@ant-design/')) {
            return 'antd'
          }

          if (normalizedId.includes('/recharts/') || normalizedId.includes('/@ant-design/charts/')) {
            return 'charts'
          }

          if (normalizedId.includes('/quill/')) {
            return 'quill'
          }

          if (normalizedId.includes('/react-router')) {
            return 'router'
          }

          if (normalizedId.includes('/react-dom/') || normalizedId.includes('/react/')) {
            return 'react'
          }

          return 'vendor'
        },
      },
    },
  }
})

