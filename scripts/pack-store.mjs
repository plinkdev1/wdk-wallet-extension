#!/usr/bin/env node
/**
 * Pack the built extension into a Chrome Web Store upload zip.
 *
 * Usage: pnpm pack:store   (runs `pnpm build` first, then zips apps/extension/dist)
 *
 * Output: dist-store/wdk-wallet-extension-v<version>.zip (source maps excluded).
 * The zip's ROOT must be manifest.json (Chrome rejects a nested folder), which is
 * why we zip the *contents* of dist/, not the dist/ folder itself.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'apps', 'extension', 'dist')
const outDir = join(root, 'dist-store')

const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'))
const version = manifest.version
const outFile = join(outDir, `wdk-wallet-extension-v${version}.zip`)

mkdirSync(outDir, { recursive: true })
rmSync(outFile, { force: true })

try {
  // -r recurse, -q quiet; exclude source maps from the published package.
  execFileSync('zip', ['-rq', outFile, '.', '-x', '*.map'], { cwd: distDir, stdio: 'inherit' })
  console.log(`✓ Packed ${outFile}`)
} catch {
  console.error(
    '\n`zip` CLI not found. Zip the *contents* of apps/extension/dist manually so\n' +
    'manifest.json is at the archive root. On Windows PowerShell:\n\n' +
    `  Compress-Archive -Path apps/extension/dist/* -DestinationPath ${outFile}\n`
  )
  process.exit(1)
}
