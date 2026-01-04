// Platform detection
export {
  type Platform,
  type PlatformInfo,
  detectPlatform,
  getPlatformInfo,
  getPlatformPackageName,
  SUPPORTED_PLATFORMS,
} from './platform.js'

// Download utilities
export {
  type DownloadOptions,
  type DownloadResult,
  downloadFile,
  formatBytes,
  createProgressLogger,
} from './download.js'

// Extract utilities
export {
  type ExtractOptions,
  extractTarGz,
  extractZip,
  extractArchive,
  makeExecutable,
  makeDirectoryExecutable,
  getArchiveType,
} from './extract.js'

// Cache management
export {
  type CacheOptions,
  type CacheStats,
  getCacheDir,
  getArchiveCachePath,
  getCachedArchive,
  ensureCacheDir,
  clearCache,
  getCacheStats,
} from './cache.js'
