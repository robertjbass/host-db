import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  detectPlatform,
  getPlatformInfo,
  type Platform,
} from '@host-db/core'

export const DATABASE_NAME = 'postgresql'
export const DATABASE_DISPLAY_NAME = 'PostgreSQL'
export const DATABASE_VERSION = '16.6'
export const MAJOR_VERSION = '16'

const binaries = {
  "server": "bin/postgres",
  "client": "bin/psql",
  "dump": "bin/pg_dump",
  "restore": "bin/pg_restore",
  "initDb": "bin/initdb",
  "ctl": "bin/pg_ctl"
} as const

export type PostgreSQLPaths = {
  basedir: string
  bindir: string
  server: string
  client: string
  dump: string
  restore: string
  initDb: string
  ctl: string
}

const PLATFORM_PACKAGE_MAP: Record<Platform, string> = {
  'linux-x64': '@host-db/postgresql-16-linux-x64',
  'linux-arm64': '@host-db/postgresql-16-linux-arm64',
  'darwin-arm64': '@host-db/postgresql-16-darwin-arm64',
  'win32-x64': '@host-db/postgresql-16-win32-x64',
}

export async function getBinaryPaths(): Promise<PostgreSQLPaths> {
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
        `Try reinstalling: npm install @host-db/postgresql-16`,
    )
  }

  const binDir = join(basedir, 'bin')

  return {
    basedir,
    bindir: binDir,
  server: join(binDir, `${binaries.server}${ext}`),
  client: join(binDir, `${binaries.client}${ext}`),
  dump: join(binDir, `${binaries.dump}${ext}`),
  restore: join(binDir, `${binaries.restore}${ext}`),
  initDb: join(binDir, `${binaries.initDb}${ext}`),
  ctl: join(binDir, `${binaries.ctl}${ext}`),
  }
}
