import type { Platform } from '@host-db/core'

export type PlatformConfig = {
  url: string
  checksum: string
  type?: 'binary' | 'source'
  note?: string
}

export type VersionConfig = {
  fullVersion: string
  releaseDate: string
  lts: boolean
  platforms: Record<Platform, PlatformConfig>
  binaries: Record<string, string>
  directories?: Record<string, string>
  compilation?: {
    command: string
    dependencies: string[]
    note?: string
  }
}

export type DatabaseManifest = {
  database: string
  displayName: string
  latestLts: string
  note?: string
  versions: Record<string, VersionConfig>
}
