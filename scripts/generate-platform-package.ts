#!/usr/bin/env tsx
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Platform } from '@host-db/core'
import type { DatabaseManifest, PlatformConfig } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const MANIFESTS_DIR = join(ROOT_DIR, 'manifests')
const PACKAGES_DIR = join(ROOT_DIR, 'packages')
const PLATFORM_PACKAGES_DIR = join(PACKAGES_DIR, 'platform-packages')

const PLATFORMS: Platform[] = [
  'linux-x64',
  'linux-arm64',
  'darwin-arm64',
  'win32-x64',
]

type GenerateOptions = {
  database?: string
  version?: string
  dryRun?: boolean
}

async function loadManifest(database: string): Promise<DatabaseManifest> {
  const manifestPath = join(MANIFESTS_DIR, `${database}.json`)
  const content = await readFile(manifestPath, 'utf-8')
  return JSON.parse(content) as DatabaseManifest
}

async function loadAllManifests(): Promise<DatabaseManifest[]> {
  const files = await readdir(MANIFESTS_DIR)
  const manifests: DatabaseManifest[] = []

  for (const file of files) {
    if (file.endsWith('.json')) {
      const database = file.replace('.json', '')
      manifests.push(await loadManifest(database))
    }
  }

  return manifests
}

function getPlatformOsCpu(platform: Platform): { os: string; cpu: string } {
  const [os, cpu] = platform.split('-')
  return {
    os: os === 'darwin' ? 'darwin' : os === 'win32' ? 'win32' : 'linux',
    cpu: cpu === 'x64' ? 'x64' : 'arm64',
  }
}

function generateInstallScript(options: {
  database: string
  displayName: string
  fullVersion: string
  majorVersion: string
  platform: Platform
  config: PlatformConfig
  binaries: Record<string, string>
  isSource: boolean
}): string {
  const {
    database,
    displayName,
    fullVersion,
    majorVersion,
    platform,
    config,
    binaries,
    isSource,
  } = options

  const isWindows = platform.startsWith('win32')
  const binaryList = Object.values(binaries).map((b) =>
    isWindows ? b.replace(/\//g, '\\\\') + '.exe' : b,
  )

  // Common preamble to detect workspace context and skip
  const preamble = `
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
`

  if (isSource) {
    return `#!/usr/bin/env node
// @ts-check
// Generated platform package installer
// Database: ${displayName} ${fullVersion}
// Platform: ${platform}
// Type: Source (requires compilation)
${preamble}
import { existsSync } from 'node:fs'
import { chmod, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONFIG = {
  database: '${database}',
  displayName: '${displayName}',
  version: '${fullVersion}',
  majorVersion: '${majorVersion}',
  platform: '${platform}',
  downloadUrl: '${config.url}',
  checksum: '${config.checksum}',
  binaries: ${JSON.stringify(binaryList, null, 4)},
}

async function main() {
  const binDir = join(__dirname, 'bin')
  const serverBinary = join(binDir, '${binaries['server'] || binaries['client']}')

  if (existsSync(serverBinary)) {
    console.log(\`[host-db] \${CONFIG.displayName} \${CONFIG.version} already installed\`)
    return
  }

  console.log(\`[host-db] Installing \${CONFIG.displayName} \${CONFIG.version} for \${CONFIG.platform}...\`)
  console.log('[host-db] This version requires compilation from source.')

  const {
    downloadFile,
    extractTarGz,
    getCacheDir,
    getCachedArchive,
    makeExecutable,
  } = await import('@host-db/core')

  let archivePath = await getCachedArchive({
    database: CONFIG.database,
    version: CONFIG.version,
    platform: CONFIG.platform,
  })

  if (!archivePath) {
    const cacheDir = getCacheDir()
    archivePath = join(cacheDir, CONFIG.database, CONFIG.version, \`\${CONFIG.platform}.tar.gz\`)

    console.log(\`[host-db] Downloading from \${CONFIG.downloadUrl}...\`)

    await downloadFile({
      url: CONFIG.downloadUrl,
      destination: archivePath,
      expectedChecksum: CONFIG.checksum !== 'sha256:PLACEHOLDER' ? CONFIG.checksum : undefined,
      onProgress: (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
        process.stdout.write(\`\\r[host-db] Downloading... \${percent}%\`)
      },
    })
    console.log('')
  } else {
    console.log('[host-db] Using cached archive')
  }

  console.log('[host-db] Extracting...')
  await extractTarGz({
    archivePath,
    destination: binDir,
    stripComponents: 1,
  })

  console.log('[host-db] Compiling (this may take a few minutes)...')
  try {
    execSync('make', {
      cwd: binDir,
      stdio: 'inherit',
    })
  } catch (error) {
    console.error('[host-db] Compilation failed. Make sure you have build tools installed:')
    console.error('[host-db]   - On macOS: xcode-select --install')
    console.error('[host-db]   - On Linux: apt-get install build-essential')
    throw error
  }

  // Make binaries executable
  for (const binary of CONFIG.binaries) {
    const binaryPath = join(binDir, binary)
    if (existsSync(binaryPath)) {
      await makeExecutable(binaryPath)
    }
  }

  console.log(\`[host-db] \${CONFIG.displayName} \${CONFIG.version} installed successfully\`)
}

main().catch((error) => {
  console.error('[host-db] Installation failed:', error.message)
  process.exit(1)
})
`
  }

  return `#!/usr/bin/env node
// @ts-check
// Generated platform package installer
// Database: ${displayName} ${fullVersion}
// Platform: ${platform}
${preamble}
import { existsSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONFIG = {
  database: '${database}',
  displayName: '${displayName}',
  version: '${fullVersion}',
  majorVersion: '${majorVersion}',
  platform: '${platform}',
  downloadUrl: '${config.url}',
  checksum: '${config.checksum}',
  binaries: ${JSON.stringify(binaryList, null, 4)},
}

async function main() {
  const binDir = join(__dirname, 'bin')
  const serverBinary = join(binDir, '${binaries['server'] || binaries['client']}${isWindows ? '.exe' : ''}')

  if (existsSync(serverBinary)) {
    console.log(\`[host-db] \${CONFIG.displayName} \${CONFIG.version} already installed\`)
    return
  }

  console.log(\`[host-db] Installing \${CONFIG.displayName} \${CONFIG.version} for \${CONFIG.platform}...\`)

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
    archivePath = archivePath.replace(/\\.(tar\\.gz|zip)$/, archiveExt)
  }

  if (!archivePath || !existsSync(archivePath)) {
    const cacheDir = getCacheDir()
    archivePath = join(cacheDir, CONFIG.database, CONFIG.version, \`\${CONFIG.platform}\${archiveExt}\`)

    console.log(\`[host-db] Downloading from \${CONFIG.downloadUrl}...\`)

    await downloadFile({
      url: CONFIG.downloadUrl,
      destination: archivePath,
      expectedChecksum: CONFIG.checksum !== 'sha256:PLACEHOLDER' ? CONFIG.checksum : undefined,
      onProgress: (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
        process.stdout.write(\`\\r[host-db] Downloading... \${percent}%\`)
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

  console.log(\`[host-db] \${CONFIG.displayName} \${CONFIG.version} installed successfully\`)
}

main().catch((error) => {
  console.error('[host-db] Installation failed:', error.message)
  process.exit(1)
})
`
}

function generatePlatformPackageJson(options: {
  database: string
  majorVersion: string
  fullVersion: string
  platform: Platform
  description: string
}): object {
  const { database, majorVersion, fullVersion, platform, description } = options
  const { os, cpu } = getPlatformOsCpu(platform)
  const packageName = `@host-db/${database}-${majorVersion}-${platform}`

  return {
    name: packageName,
    version: '0.1.0',
    description,
    type: 'module',
    author: 'Bob Bass',
    license: 'MIT',
    os: [os],
    cpu: [cpu],
    engines: { node: '>=20' },
    preferUnplugged: true,
    scripts: { postinstall: 'node install.js' },
    files: ['install.js', 'bin'],
    dependencies: { '@host-db/core': 'workspace:*' },
    publishConfig: {
      access: 'public',
      provenance: true,
    },
  }
}

function generateVersionPackageJson(options: {
  database: string
  majorVersion: string
  fullVersion: string
  displayName: string
}): object {
  const { database, majorVersion, fullVersion, displayName } = options
  const packageName = `@host-db/${database}-${majorVersion}`

  const optionalDependencies: Record<string, string> = {}
  for (const platform of PLATFORMS) {
    optionalDependencies[`@host-db/${database}-${majorVersion}-${platform}`] =
      '0.1.0'
  }

  return {
    name: packageName,
    version: '0.1.0',
    description: `${displayName} ${majorVersion} binaries for all platforms`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    author: 'Bob Bass',
    license: 'MIT',
    exports: {
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    },
    files: ['dist'],
    scripts: {
      build: 'tsc',
    },
    dependencies: {
      '@host-db/core': 'workspace:*',
    },
    optionalDependencies,
    devDependencies: {
      typescript: '^5.7.0',
    },
    publishConfig: {
      access: 'public',
      provenance: true,
    },
  }
}

function generateVersionPackageIndex(options: {
  database: string
  majorVersion: string
  fullVersion: string
  displayName: string
  binaries: Record<string, string>
}): string {
  const { database, majorVersion, fullVersion, displayName, binaries } = options

  const binaryPaths = Object.entries(binaries)
    .map(([name, path]) => {
      const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      return `  ${camelName}: join(binDir, \`\${binaries.${name}}\${ext}\`),`
    })
    .join('\n')

  const binaryTypes = Object.keys(binaries)
    .map((name) => {
      const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      return `  ${camelName}: string`
    })
    .join('\n')

  return `import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  detectPlatform,
  getPlatformInfo,
  type Platform,
} from '@host-db/core'

export const DATABASE_NAME = '${database}'
export const DATABASE_DISPLAY_NAME = '${displayName}'
export const DATABASE_VERSION = '${fullVersion}'
export const MAJOR_VERSION = '${majorVersion}'

const binaries = ${JSON.stringify(binaries, null, 2)} as const

export type ${displayName.replace(/\s+/g, '')}Paths = {
  basedir: string
  bindir: string
${binaryTypes}
}

const PLATFORM_PACKAGE_MAP: Record<Platform, string> = {
  'linux-x64': '@host-db/${database}-${majorVersion}-linux-x64',
  'linux-arm64': '@host-db/${database}-${majorVersion}-linux-arm64',
  'darwin-arm64': '@host-db/${database}-${majorVersion}-darwin-arm64',
  'win32-x64': '@host-db/${database}-${majorVersion}-win32-x64',
}

export async function getBinaryPaths(): Promise<${displayName.replace(/\s+/g, '')}Paths> {
  const platform = detectPlatform()
  const { executableExtension: ext } = getPlatformInfo()
  const packageName = PLATFORM_PACKAGE_MAP[platform]

  // Try to resolve the platform package
  let basedir: string
  try {
    const require = createRequire(import.meta.url)
    const packagePath = require.resolve(packageName)
    basedir = join(packagePath.replace(/[\\\\/]package\\.json$/, ''), 'bin')
  } catch {
    throw new Error(
      \`Platform package \${packageName} not found. \` +
        \`This usually means the package failed to install for your platform (\${platform}). \` +
        \`Try reinstalling: npm install @host-db/${database}-${majorVersion}\`,
    )
  }

  const binDir = join(basedir, 'bin')

  return {
    basedir,
    bindir: binDir,
${binaryPaths}
  }
}
`
}

function generateVersionPackageTsconfig(): object {
  return {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  }
}

function generateAgnosticPackageJson(options: {
  database: string
  displayName: string
  latestLts: string
}): object {
  const { database, displayName, latestLts } = options

  return {
    name: `@host-db/${database}`,
    version: '0.1.0',
    description: `${displayName} binaries - always points to latest LTS (currently ${latestLts})`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    author: 'Bob Bass',
    license: 'MIT',
    exports: {
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
    },
    files: ['dist'],
    scripts: {
      build: 'tsc',
    },
    dependencies: {
      [`@host-db/${database}-${latestLts}`]: 'workspace:*',
    },
    devDependencies: {
      typescript: '^5.7.0',
    },
    publishConfig: {
      access: 'public',
      provenance: true,
    },
  }
}

function generateAgnosticPackageIndex(options: {
  database: string
  latestLts: string
}): string {
  const { database, latestLts } = options

  return `// Re-export everything from the latest LTS version
export * from '@host-db/${database}-${latestLts}'
`
}

async function generatePlatformPackage(options: {
  manifest: DatabaseManifest
  majorVersion: string
  platform: Platform
  dryRun: boolean
}): Promise<void> {
  const { manifest, majorVersion, platform, dryRun } = options
  const versionConfig = manifest.versions[majorVersion]

  if (!versionConfig) {
    throw new Error(
      `Version ${majorVersion} not found in ${manifest.database} manifest`,
    )
  }

  const platformConfig = versionConfig.platforms[platform]
  if (!platformConfig) {
    console.log(
      `  Skipping ${platform} - not available for ${manifest.database} ${majorVersion}`,
    )
    return
  }

  const packageDir = join(
    PLATFORM_PACKAGES_DIR,
    `${manifest.database}-${majorVersion}`,
    platform,
  )

  const packageJson = generatePlatformPackageJson({
    database: manifest.database,
    majorVersion,
    fullVersion: versionConfig.fullVersion,
    platform,
    description: `${manifest.displayName} ${versionConfig.fullVersion} binaries for ${platform}`,
  })

  const installScript = generateInstallScript({
    database: manifest.database,
    displayName: manifest.displayName,
    fullVersion: versionConfig.fullVersion,
    majorVersion,
    platform,
    config: platformConfig,
    binaries: versionConfig.binaries,
    isSource: platformConfig.type === 'source',
  })

  if (dryRun) {
    console.log(`  Would create: ${packageDir}`)
    return
  }

  await mkdir(packageDir, { recursive: true })
  await mkdir(join(packageDir, 'bin'), { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )
  await writeFile(join(packageDir, 'install.js'), installScript)
  await writeFile(join(packageDir, 'bin', '.gitkeep'), '')

  console.log(`  Created: @host-db/${manifest.database}-${majorVersion}-${platform}`)
}

async function generateVersionPackage(options: {
  manifest: DatabaseManifest
  majorVersion: string
  dryRun: boolean
}): Promise<void> {
  const { manifest, majorVersion, dryRun } = options
  const versionConfig = manifest.versions[majorVersion]

  if (!versionConfig) {
    throw new Error(
      `Version ${majorVersion} not found in ${manifest.database} manifest`,
    )
  }

  const packageDir = join(PACKAGES_DIR, `${manifest.database}-${majorVersion}`)

  const packageJson = generateVersionPackageJson({
    database: manifest.database,
    majorVersion,
    fullVersion: versionConfig.fullVersion,
    displayName: manifest.displayName,
  })

  const indexTs = generateVersionPackageIndex({
    database: manifest.database,
    majorVersion,
    fullVersion: versionConfig.fullVersion,
    displayName: manifest.displayName,
    binaries: versionConfig.binaries,
  })

  const tsconfig = generateVersionPackageTsconfig()

  if (dryRun) {
    console.log(`  Would create: ${packageDir}`)
    return
  }

  await mkdir(join(packageDir, 'src'), { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )
  await writeFile(join(packageDir, 'src', 'index.ts'), indexTs)
  await writeFile(
    join(packageDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2),
  )

  console.log(`  Created: @host-db/${manifest.database}-${majorVersion}`)
}

async function generateAgnosticPackage(options: {
  manifest: DatabaseManifest
  dryRun: boolean
}): Promise<void> {
  const { manifest, dryRun } = options
  const packageDir = join(PACKAGES_DIR, manifest.database)

  const packageJson = generateAgnosticPackageJson({
    database: manifest.database,
    displayName: manifest.displayName,
    latestLts: manifest.latestLts,
  })

  const indexTs = generateAgnosticPackageIndex({
    database: manifest.database,
    latestLts: manifest.latestLts,
  })

  const tsconfig = generateVersionPackageTsconfig()

  if (dryRun) {
    console.log(`  Would create: ${packageDir}`)
    return
  }

  await mkdir(join(packageDir, 'src'), { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )
  await writeFile(join(packageDir, 'src', 'index.ts'), indexTs)
  await writeFile(
    join(packageDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2),
  )

  console.log(`  Created: @host-db/${manifest.database}`)
}

async function generateAll(options: GenerateOptions = {}): Promise<void> {
  const { database, version, dryRun = false } = options

  console.log(
    dryRun ? 'Dry run - no files will be created\n' : 'Generating packages...\n',
  )

  const manifests = database
    ? [await loadManifest(database)]
    : await loadAllManifests()

  for (const manifest of manifests) {
    console.log(`\n${manifest.displayName}:`)

    const versions = version
      ? [version]
      : Object.keys(manifest.versions)

    for (const majorVersion of versions) {
      console.log(`\n  Version ${majorVersion}:`)

      // Generate platform packages
      for (const platform of PLATFORMS) {
        await generatePlatformPackage({
          manifest,
          majorVersion,
          platform,
          dryRun,
        })
      }

      // Generate version package
      await generateVersionPackage({
        manifest,
        majorVersion,
        dryRun,
      })
    }

    // Generate agnostic package
    console.log(`\n  Agnostic package:`)
    await generateAgnosticPackage({ manifest, dryRun })
  }

  console.log('\nDone!')
}

// CLI
const args = process.argv.slice(2)
const options: GenerateOptions = {}

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--database' || arg === '-d') {
    options.database = args[++i]
  } else if (arg === '--version' || arg === '-v') {
    options.version = args[++i]
  } else if (arg === '--dry-run' || arg === '-n') {
    options.dryRun = true
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: generate-platform-package.ts [options]

Options:
  -d, --database <name>  Generate packages for specific database only
  -v, --version <ver>    Generate packages for specific version only
  -n, --dry-run          Show what would be created without writing files
  -h, --help             Show this help message

Examples:
  # Generate all packages for all databases
  tsx scripts/generate-platform-package.ts

  # Generate packages for MariaDB only
  tsx scripts/generate-platform-package.ts --database mariadb

  # Generate packages for MariaDB 11.4 only
  tsx scripts/generate-platform-package.ts --database mariadb --version 11.4

  # Dry run to see what would be created
  tsx scripts/generate-platform-package.ts --dry-run
`)
    process.exit(0)
  }
}

generateAll(options).catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
