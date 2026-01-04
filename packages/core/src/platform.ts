export type Platform =
  | 'linux-x64'
  | 'linux-arm64'
  | 'darwin-arm64'
  | 'win32-x64'

export type PlatformInfo = {
  platform: Platform
  os: NodeJS.Platform
  arch: NodeJS.Architecture
  isWindows: boolean
  executableExtension: string
}

export function detectPlatform(): Platform {
  const { platform, arch } = process

  if (platform === 'linux' && arch === 'x64') return 'linux-x64'
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64'
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'win32' && arch === 'x64') return 'win32-x64'

  throw new Error(
    `Unsupported platform: ${platform}-${arch}. ` +
      `Supported platforms: linux-x64, linux-arm64, darwin-arm64, win32-x64`,
  )
}

export function getPlatformInfo(): PlatformInfo {
  const platform = detectPlatform()
  const isWindows = platform.startsWith('win32')

  return {
    platform,
    os: process.platform,
    arch: process.arch,
    isWindows,
    executableExtension: isWindows ? '.exe' : '',
  }
}

export function getPlatformPackageName(options: {
  scope: string
  database: string
  version: string
}): string {
  const { scope, database, version } = options
  const platform = detectPlatform()
  return `${scope}/${database}-${version}-${platform}`
}

export const SUPPORTED_PLATFORMS: Platform[] = [
  'linux-x64',
  'linux-arm64',
  'darwin-arm64',
  'win32-x64',
]
