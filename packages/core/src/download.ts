import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

export type DownloadOptions = {
  url: string
  destination: string
  expectedChecksum?: string
  checksumAlgorithm?: 'sha256' | 'sha512' | 'md5'
  onProgress?: (downloaded: number, total: number) => void
}

export type DownloadResult = {
  path: string
  size: number
  checksum: string
}

export async function downloadFile(
  options: DownloadOptions,
): Promise<DownloadResult> {
  const {
    url,
    destination,
    expectedChecksum,
    checksumAlgorithm = 'sha256',
    onProgress,
  } = options

  await mkdir(dirname(destination), { recursive: true })

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'host-db/0.1.0',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    )
  }

  if (!response.body) {
    throw new Error(`No response body received from ${url}`)
  }

  const total = Number(response.headers.get('content-length')) || 0
  let downloaded = 0

  const hash = createHash(checksumAlgorithm)
  const fileStream = createWriteStream(destination)

  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      hash.update(value)
      fileStream.write(value)
      downloaded += value.length
      onProgress?.(downloaded, total)
    }

    fileStream.end()

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })
  } catch (error) {
    fileStream.destroy()
    await unlink(destination).catch(() => {})
    throw error
  }

  const actualChecksum = hash.digest('hex')

  if (expectedChecksum) {
    const expected = expectedChecksum.includes(':')
      ? expectedChecksum.split(':')[1]
      : expectedChecksum

    if (actualChecksum !== expected) {
      await unlink(destination).catch(() => {})
      throw new Error(
        `Checksum mismatch for ${url}. ` +
          `Expected: ${expected}, got: ${actualChecksum}`,
      )
    }
  }

  return {
    path: destination,
    size: downloaded,
    checksum: `${checksumAlgorithm}:${actualChecksum}`,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function createProgressLogger(options: { prefix?: string } = {}): (
  downloaded: number,
  total: number,
) => void {
  const { prefix = '' } = options
  let lastPercent = -1

  return (downloaded: number, total: number) => {
    const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0

    if (percent !== lastPercent) {
      lastPercent = percent
      const downloadedStr = formatBytes(downloaded)
      const totalStr = total > 0 ? formatBytes(total) : 'unknown'
      process.stdout.write(
        `\r${prefix}Downloading... ${percent}% (${downloadedStr}/${totalStr})`,
      )
    }
  }
}
