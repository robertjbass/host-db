import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  detectPlatform,
  getPlatformInfo,
  type Platform,
} from '@host-db/core'

export const DATABASE_NAME = 'mariadb'
export const DATABASE_DISPLAY_NAME = 'MariaDB'
export const DATABASE_VERSION = '10.11.11'
export const MAJOR_VERSION = '10.11'

const binaries = {
  "server": "bin/mariadbd",
  "client": "bin/mariadb",
  "dump": "bin/mariadb-dump",
  "check": "bin/mariadb-check",
  "installDb": "scripts/mariadb-install-db",
  "printDefaults": "bin/my_print_defaults"
} as const

export type MariaDBPaths = {
  basedir: string
  bindir: string
  server: string
  client: string
  dump: string
  check: string
  installDb: string
  printDefaults: string
}

const PLATFORM_PACKAGE_MAP: Record<Platform, string> = {
  'linux-x64': '@host-db/mariadb-10.11-linux-x64',
  'linux-arm64': '@host-db/mariadb-10.11-linux-arm64',
  'darwin-arm64': '@host-db/mariadb-10.11-darwin-arm64',
  'win32-x64': '@host-db/mariadb-10.11-win32-x64',
}

export async function getBinaryPaths(): Promise<MariaDBPaths> {
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
        `Try reinstalling: npm install @host-db/mariadb-10.11`,
    )
  }

  const binDir = join(basedir, 'bin')

  return {
    basedir,
    bindir: binDir,
  server: join(binDir, `${binaries.server}${ext}`),
  client: join(binDir, `${binaries.client}${ext}`),
  dump: join(binDir, `${binaries.dump}${ext}`),
  check: join(binDir, `${binaries.check}${ext}`),
  installDb: join(binDir, `${binaries.installDb}${ext}`),
  printDefaults: join(binDir, `${binaries.printDefaults}${ext}`),
  }
}
