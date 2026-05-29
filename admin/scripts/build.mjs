import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(viteBin)) {
  console.error('Vite CLI was not found. Run `npm install` inside the admin directory first.')
  process.exit(1)
}

// Defaults to 1536MB for small VPS builds; override with ADMIN_BUILD_MEMORY_MB when needed.
const DEFAULT_ADMIN_BUILD_MEMORY_MB = '1536'
const requestedHeapMb = process.env.ADMIN_BUILD_MEMORY_MB || DEFAULT_ADMIN_BUILD_MEMORY_MB
const currentNodeOptions = process.env.NODE_OPTIONS || ''
const hasHeapLimit = /--max-old-space-size(=|\s+)\d+/.test(currentNodeOptions)
const nodeOptions = hasHeapLimit
  ? currentNodeOptions
  : `${currentNodeOptions} --max-old-space-size=${requestedHeapMb}`.trim()

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
