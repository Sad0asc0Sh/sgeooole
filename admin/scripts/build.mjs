import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

const runPnpm = (argsArray) => {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm ${argsArray.join(' ')}`], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
  }
  return spawnSync('pnpm', argsArray, {
    cwd: projectRoot,
    stdio: 'inherit',
  })
}

const pkgJsonPath = resolve(projectRoot, 'package.json')
let declaredPackages = []
if (existsSync(pkgJsonPath)) {
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  declaredPackages = [
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
  ]
}

const missingPackages = declaredPackages.filter(
  (pkgName) => !existsSync(resolve(projectRoot, 'node_modules', ...pkgName.split('/'))),
)

if (missingPackages.length > 0 || !existsSync(viteBin)) {
  console.log(
    `Installing admin dependencies (${missingPackages.length > 0 ? `missing: ${missingPackages.join(', ')}` : 'vite CLI missing'})...`,
  )
  let installResult = runPnpm(['install', '--frozen-lockfile', '--prod=false'])
  if ((installResult.status ?? 1) !== 0) {
    installResult = runPnpm(['install', '--prod=false'])
  }
  if (installResult.error) {
    console.error('Failed to execute pnpm install:', installResult.error)
  }
}

if (!existsSync(viteBin)) {
  console.error('Vite CLI was not found. Run `pnpm install` inside the admin directory first.')
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

// ── Post-build mirror: dist/ → dist2/ ────────────────
// Some deployment targets (nginx roots, CDN upload
// scripts, PM2 static servers) point at `dist2/`
// instead of vite's default `dist/`. Mirroring after
// every successful build guarantees that whichever
// folder the web server serves is always the freshest.
const distDir = resolve(projectRoot, 'dist')
const dist2Dir = resolve(projectRoot, 'dist2')
if (result.status === 0 && existsSync(distDir)) {
  try {
    rmSync(dist2Dir, { recursive: true, force: true })
    cpSync(distDir, dist2Dir, { recursive: true })
    console.log('✓ Mirrored dist/ → dist2/')
  } catch (err) {
    console.warn('⚠ Could not mirror dist/ → dist2/:', err?.message)
  }
}

process.exit(result.status ?? 1)
