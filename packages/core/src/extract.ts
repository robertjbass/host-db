import { mkdir, chmod, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { extract as tarExtract } from 'tar'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export type ExtractOptions = {
  archivePath: string
  destination: string
  stripComponents?: number
  filter?: (path: string) => boolean
}

export async function extractTarGz(options: ExtractOptions): Promise<void> {
  const { archivePath, destination, stripComponents = 1, filter } = options

  await mkdir(destination, { recursive: true })

  await tarExtract({
    file: archivePath,
    cwd: destination,
    strip: stripComponents,
    filter: filter ? (path) => filter(path) : undefined,
  })
}

export async function extractZip(options: ExtractOptions): Promise<void> {
  const { archivePath, destination, stripComponents = 1 } = options

  await mkdir(destination, { recursive: true })

  // Use system unzip command - more reliable than JS implementations
  // for large archives and handles permissions correctly
  if (process.platform === 'win32') {
    // PowerShell Expand-Archive on Windows
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destination}' -Force"`,
    )
  } else {
    await execAsync(`unzip -o -q "${archivePath}" -d "${destination}"`)
  }

  // Handle strip components manually for zip
  if (stripComponents > 0) {
    const entries = await readdir(destination)
    if (entries.length === 1) {
      const singleDir = join(destination, entries[0]!)
      const stats = await stat(singleDir)
      if (stats.isDirectory()) {
        // Move contents up
        const contents = await readdir(singleDir)
        for (const item of contents) {
          await execAsync(`mv "${join(singleDir, item)}" "${destination}/"`)
        }
        await execAsync(`rmdir "${singleDir}"`)
      }
    }
  }
}

export async function makeExecutable(filePath: string): Promise<void> {
  if (process.platform !== 'win32') {
    await chmod(filePath, 0o755)
  }
}

export async function makeDirectoryExecutable(
  dirPath: string,
): Promise<void> {
  if (process.platform === 'win32') return

  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isFile()) {
      await chmod(fullPath, 0o755)
    } else if (entry.isDirectory()) {
      await makeDirectoryExecutable(fullPath)
    }
  }
}

export function getArchiveType(
  filename: string,
): 'tar.gz' | 'zip' | 'unknown' {
  if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
    return 'tar.gz'
  }
  if (filename.endsWith('.zip')) {
    return 'zip'
  }
  return 'unknown'
}

export async function extractArchive(options: ExtractOptions): Promise<void> {
  const archiveType = getArchiveType(options.archivePath)

  switch (archiveType) {
    case 'tar.gz':
      return extractTarGz(options)
    case 'zip':
      return extractZip(options)
    default:
      throw new Error(
        `Unknown archive type for ${options.archivePath}. ` +
          `Supported formats: .tar.gz, .tgz, .zip`,
      )
  }
}
