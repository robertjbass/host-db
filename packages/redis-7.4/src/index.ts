import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  detectPlatform,
  getPlatformInfo,
  type Platform,
} from '@host-db/core'

export const DATABASE_NAME = 'redis'
export const DATABASE_DISPLAY_NAME = 'Redis'
export const DATABASE_VERSION = '7.4.1'
export const MAJOR_VERSION = '7.4'

const binaries = {
  "server": "src/redis-server",
  "client": "src/redis-cli",
  "benchmark": "src/redis-benchmark",
  "checkAof": "src/redis-check-aof",
  "checkRdb": "src/redis-check-rdb"
} as const

export type RedisPaths = {
  basedir: string
  bindir: string
  server: string
  client: string
  benchmark: string
  checkAof: string
  checkRdb: string
}

const PLATFORM_PACKAGE_MAP: Record<Platform, string> = {
  'linux-x64': '@host-db/redis-7.4-linux-x64',
  'linux-arm64': '@host-db/redis-7.4-linux-arm64',
  'darwin-arm64': '@host-db/redis-7.4-darwin-arm64',
  'win32-x64': '@host-db/redis-7.4-win32-x64',
}

export async function getBinaryPaths(): Promise<RedisPaths> {
  const platform = detectPlatform()
  const { executableExtension: ext } = getPlatformInfo()
  const packageName = PLATFORM_PACKAGE_MAP[platform]

  // Try to resolve the platform package
  let basedir: string
  try {
    const require = createRequire(import.meta.url)
    const packagePath = require.resolve(packageName)
    basedir = join(packagePath.replace(/[\\/]package\.json$/, ''), 'bin')
  } catch {
    throw new Error(
      `Platform package ${packageName} not found. ` +
        `This usually means the package failed to install for your platform (${platform}). ` +
        `Try reinstalling: npm install @host-db/redis-7.4`,
    )
  }

  const binDir = join(basedir, 'bin')

  return {
    basedir,
    bindir: binDir,
  server: join(binDir, `${binaries.server}${ext}`),
  client: join(binDir, `${binaries.client}${ext}`),
  benchmark: join(binDir, `${binaries.benchmark}${ext}`),
  checkAof: join(binDir, `${binaries.checkAof}${ext}`),
  checkRdb: join(binDir, `${binaries.checkRdb}${ext}`),
  }
}
