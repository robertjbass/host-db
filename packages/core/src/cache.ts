import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, access, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export type CacheOptions = {
  cacheDir?: string
}

export function getCacheDir(options: CacheOptions = {}): string {
  if (options.cacheDir) {
    return options.cacheDir
  }

  if (process.env['HOST_DB_CACHE_DIR']) {
    return process.env['HOST_DB_CACHE_DIR']
  }

  // Follow XDG Base Directory Specification on Unix
  if (process.platform !== 'win32' && process.env['XDG_CACHE_HOME']) {
    return join(process.env['XDG_CACHE_HOME'], 'host-db')
  }

  // Default locations
  if (process.platform === 'win32') {
    return join(
      process.env['LOCALAPPDATA'] || join(homedir(), 'AppData', 'Local'),
      'host-db',
      'cache',
    )
  }

  return join(homedir(), '.cache', 'host-db')
}

export function getArchiveCachePath(options: {
  database: string
  version: string
  platform: string
  cacheDir?: string
}): string {
  const { database, version, platform, cacheDir } = options
  const cache = getCacheDir({ cacheDir })
  return join(cache, database, version, `${platform}.tar.gz`)
}

export async function getCachedArchive(options: {
  database: string
  version: string
  platform: string
  cacheDir?: string
}): Promise<string | null> {
  const archivePath = getArchiveCachePath(options)

  try {
    await access(archivePath)
    return archivePath
  } catch {
    return null
  }
}

export async function ensureCacheDir(options: CacheOptions = {}): Promise<string> {
  const cacheDir = getCacheDir(options)
  await mkdir(cacheDir, { recursive: true })
  return cacheDir
}

export async function clearCache(options: {
  database?: string
  version?: string
  cacheDir?: string
} = {}): Promise<void> {
  const { database, version, cacheDir } = options
  const cache = getCacheDir({ cacheDir })

  let targetPath = cache

  if (database) {
    targetPath = join(cache, database)
    if (version) {
      targetPath = join(targetPath, version)
    }
  }

  if (existsSync(targetPath)) {
    await rm(targetPath, { recursive: true, force: true })
  }
}

export type CacheStats = {
  totalSize: number
  databases: Record<string, { versions: string[]; size: number }>
}

export async function getCacheStats(
  options: CacheOptions = {},
): Promise<CacheStats> {
  const cacheDir = getCacheDir(options)
  const stats: CacheStats = {
    totalSize: 0,
    databases: {},
  }

  if (!existsSync(cacheDir)) {
    return stats
  }

  async function calculateDirSize(dir: string): Promise<number> {
    let size = 0
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          size += await calculateDirSize(fullPath)
        } else {
          const fileStat = await stat(fullPath)
          size += fileStat.size
        }
      }
    } catch {
      // Directory might not exist or be accessible
    }
    return size
  }

  try {
    const databases = await readdir(cacheDir, { withFileTypes: true })

    for (const dbEntry of databases) {
      if (!dbEntry.isDirectory()) continue

      const dbPath = join(cacheDir, dbEntry.name)
      const versions = await readdir(dbPath, { withFileTypes: true })
      const versionNames = versions
        .filter((v) => v.isDirectory())
        .map((v) => v.name)

      const size = await calculateDirSize(dbPath)
      stats.databases[dbEntry.name] = {
        versions: versionNames,
        size,
      }
      stats.totalSize += size
    }
  } catch {
    // Cache directory might not exist
  }

  return stats
}
