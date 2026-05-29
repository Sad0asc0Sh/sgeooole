import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunks = [
  { name: 'vendor-react', packages: ['react', 'react-dom', 'react-router-dom'] },
  { name: 'vendor-antd', packages: ['antd', '@ant-design/icons', '@ant-design/cssinjs'] },
  { name: 'vendor-charts', packages: ['@ant-design/charts', 'recharts'] },
  { name: 'vendor-editor', packages: ['quill', 'react-quilljs'] },
  { name: 'vendor-date', packages: ['dayjs', 'jalaliday', 'react-multi-date-picker', 'react-date-object'] },
  { name: 'vendor-state', packages: ['zustand', '@tanstack/react-query', 'axios'] },
]

const getVendorChunk = (id) => {
  if (!id.includes('node_modules')) return undefined

  const normalizedId = id.replace(/\\/g, '/')
  const match = vendorChunks.find(({ packages }) =>
    packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`)),
  )

  return match?.name
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  build: {
    // Avoid keeping gzip/brotli size calculations in memory on small VPS builds.
    reportCompressedSize: false,
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: getVendorChunk,
      },
    },
  },
})
