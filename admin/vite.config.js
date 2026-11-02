import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunks = [
  { name: 'vendor-react', packages: ['react', 'react-dom', 'react-router-dom', '@remix-run/router', 'scheduler'] },
  { name: 'vendor-antd', packages: ['antd', '@ant-design/icons', '@ant-design/cssinjs', '@ant-design/colors', '@ant-design/fast-color', '@rc-component/'] },
  { name: 'vendor-charts', packages: ['@ant-design/charts', 'recharts', 'd3-'] },
  { name: 'vendor-editor', packages: ['quill', 'react-quilljs', 'parchment'] },
  { name: 'vendor-date', packages: ['dayjs', 'jalaliday', 'react-multi-date-picker', 'react-date-object'] },
  { name: 'vendor-state', packages: ['zustand', '@tanstack/react-query', 'axios'] },
]

const getVendorChunk = (id) => {
  if (!id.includes('node_modules')) return undefined

  const normalizedId = id.replace(/\\/g, '/')
  for (const { name, packages } of vendorChunks) {
    if (
      packages.some((pkg) =>
        pkg.endsWith('/') || pkg.endsWith('-')
          ? normalizedId.includes(`/node_modules/${pkg}`)
          : normalizedId.includes(`/node_modules/${pkg}/`),
      )
    ) {
      return name
    }
  }

  return undefined
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
