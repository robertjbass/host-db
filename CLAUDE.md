# host-db

NPM monorepo for hosting database binaries with on-demand downloading.

## Project Structure

```
host-db/
├── packages/
│   ├── core/                      # @host-db/core - shared utilities
│   ├── mariadb/                   # @host-db/mariadb - latest LTS
│   ├── mariadb-11.4/              # @host-db/mariadb-11.4 - version entry
│   ├── platform-packages/         # Generated platform-specific packages
│   │   └── mariadb-11.4/
│   │       ├── darwin-arm64/      # @host-db/mariadb-11.4-darwin-arm64
│   │       ├── linux-x64/
│   │       └── ...
│   └── ...
├── manifests/                     # Database version manifests (URLs, checksums)
├── scripts/                       # Package generation scripts
└── .github/workflows/             # CI/CD
```

## Commands

```bash
# Install dependencies
pnpm install

# Generate all platform packages from manifests
pnpm run generate:platform-packages

# Generate for specific database/version
pnpm run generate:platform-packages -- --database mariadb --version 11.4

# Build all packages
pnpm run build

# Lint
pnpm run lint
```

## Adding a New Database Version

1. Update the manifest in `manifests/<database>.json` with the new version
2. Run `pnpm run generate:platform-packages`
3. Build and test: `pnpm run build`
4. Commit and push - CI will publish new packages

## Package Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Core | `@host-db/core` | `@host-db/core` |
| Agnostic | `@host-db/<db>` | `@host-db/mariadb` |
| Version | `@host-db/<db>-<major>` | `@host-db/mariadb-11.4` |
| Platform | `@host-db/<db>-<major>-<platform>` | `@host-db/mariadb-11.4-darwin-arm64` |

## Supported Platforms

- `linux-x64`
- `linux-arm64`
- `darwin-arm64`
- `win32-x64`

## How It Works

1. User installs `@host-db/mariadb-11.4`
2. npm resolves the correct platform package via `optionalDependencies`
3. Platform package's `postinstall` downloads binaries from official sources
4. Binaries cached in `~/.cache/host-db` to avoid re-downloading
5. User imports `getBinaryPaths()` to get paths to executables

## Development Notes

- Platform packages skip download during workspace development (detects `pnpm-workspace.yaml`)
- Set `HOST_DB_SKIP_INSTALL=1` to skip downloads manually
- Manifests contain placeholder checksums - update with real SHA256 values before publishing
