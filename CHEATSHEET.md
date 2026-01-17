# hostdb Cheatsheet

## CLI Commands

Query database binaries from hostdb releases.

```bash
# List available databases
hostdb list
hostdb list --json

# Filter by database (with aliases)
hostdb list mysql
hostdb list postgres              # alias for postgresql
hostdb list pg                    # alias for postgresql
hostdb list mongo                 # alias for mongodb
hostdb list maria                 # alias for mariadb
hostdb list ch                    # alias for clickhouse

# Filter by platform (with aliases)
hostdb list mac                   # darwin-arm64, darwin-x64
hostdb list windows               # win32-x64
hostdb list linux                 # linux-x64, linux-arm64
hostdb list m1                    # darwin-arm64 (also m2, m3, m4)
hostdb list arm64                 # linux-arm64, darwin-arm64

# Combined filters
hostdb list mysql mac             # MySQL versions for macOS
hostdb list postgres linux arm64  # PostgreSQL for Linux ARM64
hostdb list pg 17.7.0             # Platforms for PostgreSQL 17.7.0
hostdb list mysql 8.4.3 mac       # MySQL 8.4.3 for macOS

# JSON output (works with any filter)
hostdb list --json
hostdb list mysql --json
hostdb list postgres linux --json

# Legacy commands (also support aliases)
hostdb versions pg                # List PostgreSQL versions
hostdb platforms maria 11.8.5    # List platforms for MariaDB 11.8.5

# Get download URL (useful for scripting)
hostdb url mysql 8.4.3 darwin-arm64
hostdb url pg 17.7.0 m1           # Uses aliases

# Get full release info as JSON (URL, sha256, size)
hostdb info mysql 8.4.3 darwin-arm64
hostdb info pg 17.7.0 m1          # Uses aliases
```

### Platform Aliases

| Alias | Resolves to |
|-------|-------------|
| `mac`, `macos`, `darwin`, `osx`, `apple` | darwin-arm64, darwin-x64 |
| `m1`, `m2`, `m3`, `m4` | darwin-arm64 |
| `mac-intel` | darwin-x64 |
| `win`, `windows`, `win32`, `win64` | win32-x64 |
| `linux`, `ubuntu`, `debian` | linux-x64, linux-arm64 |
| `arm64`, `arm`, `aarch64` | linux-arm64, darwin-arm64 |
| `x64`, `amd64` | linux-x64, darwin-x64, win32-x64 |

### Database Aliases

| Alias | Resolves to |
|-------|-------------|
| `postgres`, `pg` | postgresql |
| `mongo` | mongodb |
| `maria` | mariadb |
| `ch` | clickhouse |

### Platforms

- `linux-x64` - Linux x86_64
- `linux-arm64` - Linux ARM64
- `darwin-x64` - macOS Intel
- `darwin-arm64` - macOS Apple Silicon
- `win32-x64` - Windows x64

## Development Commands

```bash
# Pre-commit preparation
# Runs: type-check, lint, sync versions, checksums, reconcile releases, discrepancy check
pnpm prep
pnpm prep --fix        # Auto-fix lint/format issues
pnpm prep --check      # Check only (for CI)

# List databases
pnpm dbs               # Show in-progress databases
pnpm dbs --all         # Show all databases
pnpm dbs --pending     # Show pending only

# Download binaries locally (for testing)
pnpm download:mysql -- --version 8.4.3
pnpm download:mysql -- --version 8.4.3 --all-platforms
pnpm download:postgresql -- --version 17.7.0 --platform linux-x64

# Scaffold a new database
pnpm add:engine redis
pnpm add:engine duckdb

# Sync workflow version dropdowns with databases.json
pnpm sync:versions
pnpm sync:versions mysql
pnpm sync:versions --check

# Populate missing SHA256 checksums in sources.json
pnpm checksums:populate mysql
pnpm checksums:populate postgresql

# Reconcile releases.json with GitHub releases
pnpm reconcile:releases
pnpm reconcile:releases --dry-run

# Repair incomplete checksums.txt files on GitHub releases
pnpm repair:checksums                    # Fix all releases with missing checksums
pnpm repair:checksums --dry-run          # Show what would be fixed
pnpm repair:checksums --release valkey-9.0.1  # Fix specific release

# Fetch EDB Windows file IDs for PostgreSQL
pnpm edb:fileids
pnpm edb:fileids -- --update

# Linting and formatting
pnpm lint
pnpm format
```

### What `pnpm prep` Checks

1. **Type checking** - `tsc --noEmit`
2. **Linting** - ESLint (with `--fix` if using `pnpm prep --fix`)
3. **Formatting** - Prettier (only with `--fix`)
4. **Workflow sync** - Ensures GitHub Actions dropdowns match databases.json
5. **Checksums** - Detects/populates missing SHA256 checksums
6. **Reconcile releases** - Syncs releases.json with GitHub releases
7. **Discrepancy check** - Compares databases.json and releases.json:
   - Missing releases (enabled in databases.json but not released)
   - Orphaned releases (released but not in databases.json)

## Local Docker Builds

Build from source for platforms without official binaries.

```bash
# MariaDB
./builds/mariadb/build-local.sh --version 11.8.5 --platform linux-arm64

# PostgreSQL
./builds/postgresql/build-local.sh --version 17.7.0 --platform linux-arm64

# Redis
./builds/redis/build-local.sh --version 8.4.0 --platform darwin-arm64

# SQLite
./builds/sqlite/build-local.sh --version 3.51.2 --platform linux-arm64

# Valkey
./builds/valkey/build-local.sh --version 9.0.1 --platform darwin-arm64
```

## GitHub Actions

### Release a specific database version

1. Go to Actions tab
2. Select `Release <database>` workflow
3. Click "Run workflow"
4. Select version from dropdown
5. Choose platforms (all or specific)

### Build all missing releases

1. Go to Actions tab
2. Select `Build Missing Releases` workflow
3. Click "Run workflow"
4. Choose action:
   - `check-only` - Report what's missing without building
   - `build-missing` - Trigger builds for all missing releases
5. Optionally filter to a specific database

The workflow will:
- Compare `databases.json` with `releases.json` to find discrepancies
- Trigger the appropriate release workflows
- Wait for all builds to complete (up to 4 hours)
- Repair any missing checksums
- Update `releases.json` with the new releases

## Querying releases.json

```bash
# Raw URL for releases.json
curl -s https://raw.githubusercontent.com/robertjbass/hostdb/main/releases.json

# Get all MySQL versions
curl -s https://raw.githubusercontent.com/robertjbass/hostdb/main/releases.json | jq '.databases.mysql | keys'

# Get download URL for specific version/platform
curl -s https://raw.githubusercontent.com/robertjbass/hostdb/main/releases.json | jq -r '.databases.mysql["8.4.3"].platforms["darwin-arm64"].url'
```
