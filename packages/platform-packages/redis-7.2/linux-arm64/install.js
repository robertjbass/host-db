#!/usr/bin/env node
// @ts-check
// Generated platform package installer
// Database: Redis 7.2.7
// Platform: linux-arm64
// Type: Source (requires compilation)

// Skip installation if HOST_DB_SKIP_INSTALL is set
if (process.env.HOST_DB_SKIP_INSTALL === '1') {
  console.log('[host-db] Skipping install (HOST_DB_SKIP_INSTALL=1)')
  process.exit(0)
}

// Check if we're in a workspace/development context by looking for workspace marker
import { existsSync as existsSyncPreamble } from 'node:fs'
import { join as joinPreamble, dirname as dirnamePreamble } from 'node:path'
import { fileURLToPath as fileURLToPathPreamble } from 'node:url'
const __dirnamePreamble = dirnamePreamble(fileURLToPathPreamble(import.meta.url))
// If we can find pnpm-workspace.yaml going up, we're in dev mode
function isWorkspaceContext() {
  let dir = __dirnamePreamble
  for (let i = 0; i < 10; i++) {
    if (existsSyncPreamble(joinPreamble(dir, 'pnpm-workspace.yaml'))) return true
    const parent = dirnamePreamble(dir)
    if (parent === dir) break
    dir = parent
  }
  return false
}
if (isWorkspaceContext()) {
  console.log('[host-db] Skipping install in workspace context')
  process.exit(0)
}

import { existsSync } from 'node:fs'
import { chmod, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONFIG = {
  database: 'redis',
  displayName: 'Redis',
  version: '7.2.7',
  majorVersion: '7.2',
  platform: 'linux-arm64',
  downloadUrl: 'https://download.redis.io/releases/redis-7.2.7.tar.gz',
  checksum: 'sha256:PLACEHOLDER',
  binaries: [
    "src/redis-server",
    "src/redis-cli",
    "src/redis-benchmark",
    "src/redis-check-aof",
    "src/redis-check-rdb"
],
}

async function main() {
  const binDir = join(__dirname, 'bin')
  const serverBinary = join(binDir, 'src/redis-server')

  if (existsSync(serverBinary)) {
    console.log(`[host-db] ${CONFIG.displayName} ${CONFIG.version} already installed`)
    return
  }

  console.log(`[host-db] Installing ${CONFIG.displayName} ${CONFIG.version} for ${CONFIG.platform}...`)
  console.log('[host-db] This version requires compilation from source.')

  const {
    downloadFile,
    extractTarGz,
    getCacheDir,
    getCachedArchive,
    makeExecutable,
  } = await import('@host-db/core')

  let archivePath = await getCachedArchive({
    database: CONFIG.database,
    version: CONFIG.version,
    platform: CONFIG.platform,
  })

  if (!archivePath) {
    const cacheDir = getCacheDir()
    archivePath = join(cacheDir, CONFIG.database, CONFIG.version, `${CONFIG.platform}.tar.gz`)

    console.log(`[host-db] Downloading from ${CONFIG.downloadUrl}...`)

    await downloadFile({
      url: CONFIG.downloadUrl,
      destination: archivePath,
      expectedChecksum: CONFIG.checksum !== 'sha256:PLACEHOLDER' ? CONFIG.checksum : undefined,
      onProgress: (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
        process.stdout.write(`\r[host-db] Downloading... ${percent}%`)
      },
    })
    console.log('')
  } else {
    console.log('[host-db] Using cached archive')
  }

  console.log('[host-db] Extracting...')
  await extractTarGz({
    archivePath,
    destination: binDir,
    stripComponents: 1,
  })

  console.log('[host-db] Compiling (this may take a few minutes)...')
  try {
    execSync('make', {
      cwd: binDir,
      stdio: 'inherit',
    })
  } catch (error) {
    console.error('[host-db] Compilation failed. Make sure you have build tools installed:')
    console.error('[host-db]   - On macOS: xcode-select --install')
    console.error('[host-db]   - On Linux: apt-get install build-essential')
    throw error
  }

  // Make binaries executable
  for (const binary of CONFIG.binaries) {
    const binaryPath = join(binDir, binary)
    if (existsSync(binaryPath)) {
      await makeExecutable(binaryPath)
    }
  }

  console.log(`[host-db] ${CONFIG.displayName} ${CONFIG.version} installed successfully`)
}

main().catch((error) => {
  console.error('[host-db] Installation failed:', error.message)
  process.exit(1)
})
