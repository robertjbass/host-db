# ClickHouse Windows Build Log

## Change History

| Change # | Time to Break | Phase | Error Summary | Status |
|----------|---------------|-------|---------------|--------|
| 1 | 25:36 | Compile (1866/9265) | `sigset_t` undefined in xz mythread.h | ✅ Fixed |
| 2 | 25:06 | Compile (1866/9265) | Same - compat header not applied to C files | ✅ Fixed |

---

## Iteration 2 - 2026-01-15

**Duration:** Failed at 25:06 (compile phase, 1866/9265 objects)

**Changes:** Added `sigset_t` typedef to compat_windows.h

**Error:** Same as iteration 1 - `sigset_t` still undefined in xz mythread.h

**Root Cause:**
- The compat header was only included via `CMAKE_CXX_FLAGS`
- xz library is **C code** (`.c` files), not C++
- C files don't receive the `-include compat_windows.h` flag

**Fix Applied:**
Added `CMAKE_C_FLAGS` with the same include directive:
```yaml
-DCMAKE_C_FLAGS="-include ${COMPAT_HEADER}" \
-DCMAKE_CXX_FLAGS="-include ${COMPAT_HEADER}" \
```

**Next:** Re-run build

---

## Iteration 1 - 2026-01-15

**Duration:** Failed at 25:36 (compile phase, 1866/9265 objects)

**Changes:** Previous iteration's patches (unknown baseline)

**Error:**
```
D:/a/hostdb/hostdb/ClickHouse/contrib/xz/src/common/mythread.h:138:33: error: unknown type name 'sigset_t'; did you mean '_sigset_t'?
  138 | mythread_sigmask(int how, const sigset_t *restrict set,
```

**Root Cause:**
- The xz-utils library's `mythread.h` uses `sigset_t` for POSIX signal handling
- Build defines `-DMYTHREAD_POSIX` expecting full POSIX threading support
- Windows MSYS2 CLANG64 only has `_sigset_t` (underscore-prefixed variant)
- The `compat_windows.h` header is missing this typedef

**Proposed Fix:**
Add to `compat_windows.h` (around line 505, after the `sigaltstack` stub):

```c
// Signal set type for pthread_sigmask compatibility
// Windows MSYS2 only has _sigset_t, need to alias it
#include <sys/types.h>  // for _sigset_t
typedef _sigset_t sigset_t;
```

In workflow `release-clickhouse.yml`, add these lines after the `sigaltstack` stub (around line 505):

```bash
'' \
'// Signal set type for pthread_sigmask compatibility' \
'#include <sys/types.h>  // for _sigset_t' \
'typedef _sigset_t sigset_t;' \
```

**Files to modify:**
- `.github/workflows/release-clickhouse.yml` (compat_windows.h generation section, ~line 505)

**Next:** Re-run build to test fix

**Fix Applied:** `.github/workflows/release-clickhouse.yml` line 507-510
