# host-db

NPM packages for embedding database binaries in Node.js projects. Binaries are downloaded on-demand during installation.

## Supported Databases

| Database | Versions | Platforms |
|----------|----------|-----------|
| MariaDB | 11.4, 10.11 | linux-x64, linux-arm64, darwin-arm64, win32-x64 |
| MySQL | 8.4, 8.0 | linux-x64, linux-arm64, darwin-arm64, win32-x64 |
| PostgreSQL | 17, 16 | linux-x64, linux-arm64, darwin-arm64, win32-x64 |
| Redis | 7.4, 7.2 | linux-x64, linux-arm64, darwin-arm64, win32-x64 |

## Installation

```bash
# Install latest LTS version
npm install @host-db/mariadb

# Or install specific version
npm install @host-db/mariadb-11.4
```

## Usage

```typescript
import { getBinaryPaths } from '@host-db/mariadb-11.4'

const paths = await getBinaryPaths()

console.log(paths.mariadbd)    // /path/to/mariadbd
console.log(paths.mariadb)     // /path/to/mariadb (client)
console.log(paths.mariadbDump) // /path/to/mariadb-dump
```

## How It Works

1. When you install a package like `@host-db/mariadb-11.4`, npm automatically installs the correct platform-specific package for your OS/architecture
2. The platform package downloads the official database binaries during `postinstall`
3. Binaries are cached in `~/.cache/host-db` to avoid re-downloading on reinstall
4. Use `getBinaryPaths()` to get the paths to all executables

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HOST_DB_CACHE_DIR` | Override the default cache directory |
| `HOST_DB_SKIP_INSTALL` | Set to `1` to skip binary download during install |

## TODOs

- [ ] Create `@host-db` organization on npmjs.com
- [ ] Configure OIDC trusted publishing for each package:
  1. Go to package settings → Publishing access → Add trusted publisher
  2. Repository owner: `robertjbass`
  3. Repository name: `host-db`
  4. Workflow filename: `publish.yml`
- [ ] Update manifest checksums with actual SHA256 values
- [ ] Verify download URLs are correct for all database versions
- [ ] Test binary downloads on all supported platforms
- [ ] Add MongoDB support (pending SSPL license review)

## License

MIT
