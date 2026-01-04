#!/usr/bin/env node
// @ts-check
// Generated platform package installer
// Database: PostgreSQL 16.6
// Platform: win32-x64

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
import { chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONFIG = {
  database: 'postgresql',
  displayName: 'PostgreSQL',
  version: '16.6',
  majorVersion: '16',
  platform: 'win32-x64',
  downloadUrl: 'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip',
  checksum: 'sha256:PLACEHOLDER',
  binaries: [
    "bin\\\\postgres.exe",
    "bin\\\\psql.exe",
    "bin\\\\pg_dump.exe",
    "bin\\\\pg_restore.exe",
    "bin\\\\initdb.exe",
    "bin\\\\pg_ctl.exe"
],
}

async function main() {
  const binDir = join(__dirname, 'bin')
  const serverBinary = join(binDir, 'bin/postgres.exe')

  if (existsSync(serverBinary)) {
    console.log(`[host-db] ${CONFIG.displayName} ${CONFIG.version} already installed`)
    return
  }

  console.log(`[host-db] Installing ${CONFIG.displayName} ${CONFIG.version} for ${CONFIG.platform}...`)

  const {
    downloadFile,
    extractArchive,
    getCacheDir,
    getCachedArchive,
    makeExecutable,
    getArchiveType,
  } = await import('@host-db/core')

  const archiveExt = CONFIG.downloadUrl.endsWith('.zip') ? '.zip' : '.tar.gz'

  let archivePath = await getCachedArchive({
    database: CONFIG.database,
    version: CONFIG.version,
    platform: CONFIG.platform,
  })

  // Adjust cache path for correct extension
  if (archivePath && !archivePath.endsWith(archiveExt)) {
    archivePath = archivePath.replace(/\.(tar\.gz|zip)$/, archiveExt)
  }

  if (!archivePath || !existsSync(archivePath)) {
    const cacheDir = getCacheDir()
    archivePath = join(cacheDir, CONFIG.database, CONFIG.version, `${CONFIG.platform}${archiveExt}`)

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
  await extractArchive({
    archivePath,
    destination: binDir,
    stripComponents: 1,
  })

  // Make binaries executable (Unix only)
  if (!CONFIG.platform.startsWith('win32')) {
    for (const binary of CONFIG.binaries) {
      const binaryPath = join(binDir, binary)
      if (existsSync(binaryPath)) {
        await makeExecutable(binaryPath)
      }
    }
  }

  console.log(`[host-db] ${CONFIG.displayName} ${CONFIG.version} installed successfully`)
}

main().catch((error) => {
  console.error('[host-db] Installation failed:', error.message)
  process.exit(1)
})
