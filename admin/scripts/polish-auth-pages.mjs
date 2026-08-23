/**
 * One-off polish for auth pages (login / forgot / reset):
 * - Fluid card width (100% up to maxWidth)
 * - New brand gradient + primary color
 * Preserves UTF-8. Usage: node scripts/polish-auth-pages.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const dir = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..',
  'src',
  'pages',
)

const replacements = [
  // Old purple gradient → brand indigo gradient
  [
    "background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'",
    "background:\n          'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #312e81 100%)'",
  ],
  // Fixed-width login card → fluid with max width
  [
    "style={{ width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}",
    "style={{\n          width: '100%',\n          maxWidth: 420,\n          boxShadow: '0 20px 50px rgba(2, 6, 23, 0.35)',\n          borderRadius: 18,\n        }}",
  ],
  // Old antd blue → brand indigo
  [/color='#1890ff'/g, "color='#4f46e5'"],
  [/color="#1890ff"/g, 'color="#4f46e5"'],
  [/#1890ff/g, '#4f46e5'],
]

for (const name of [
  'LoginPage.jsx',
  'ForgotPasswordPage.jsx',
  'ResetPasswordPage.jsx',
]) {
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) continue
  let src = fs.readFileSync(file, 'utf8')
  const before = src

  // minHeight: '100vh' → '100dvh' in auth wrappers
  src = src.replace("minHeight: '100vh'", "minHeight: '100dvh'")

  for (const [from, to] of replacements) {
    src = src.replaceAll(from, to)
  }

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8')
    console.log(`Updated: ${name}`)
  } else {
    console.log(`No change: ${name}`)
  }
}
