# 🏷️ Hodor Version Information

## Current Version

**Version:** `0.1.0-dev`  
**Codename:** Pre-release (Aerys upcoming)  
**Status:** Development  
**Released:** Not yet released

---

## Version Naming Scheme

Hodor follows **Semantic Versioning 2.0.0** with Game of Thrones character codenames.

### Format

```
MAJOR.MINOR.PATCH[-prerelease]
```

- **MAJOR:** Incompatible API changes
- **MINOR:** Backward-compatible functionality additions
- **PATCH:** Backward-compatible bug fixes
- **Prerelease:** `-dev`, `-alpha`, `-beta`, `-rc` (release candidate)

### Codenames

Each **major version** receives a codename based on a Game of Thrones character, following alphabetical order:

| Version | Codename      | Character                         | Status     |
| ------- | ------------- | --------------------------------- | ---------- |
| 1.x.x   | **Aerys**     | Aerys II Targaryen (The Mad King) | 📋 Planned |
| 2.x.x   | **Barristan** | Barristan Selmy                   | 💭 Future  |
| 3.x.x   | **Catelyn**   | Catelyn Stark                     | 💭 Future  |
| 4.x.x   | **Daenerys**  | Daenerys Targaryen                | 💭 Future  |
| 5.x.x   | **Eddard**    | Eddard Stark                      | 💭 Future  |
| ...     | ...           | ...                               | ...        |

**Rules:**

- Only **major versions** get codenames
- Minor versions (1.1.0, 1.2.0) share the major's codename
- Patch versions (1.0.1, 1.0.2) don't get individual codenames
- Pre-release versions use the upcoming codename with suffix (e.g., "0.9.0-dev targeting Aerys")

---

## Version History

### 0.1.0-dev (Current)

**Released:** 2023-10-22  
**Codename:** Pre-release

**Changes:**

- Initial project setup
- Repository structure established
- Development workflow configured
- Core documentation created (README, ROADMAP, AGENTS)
- Monorepo with pnpm workspaces configured

**Next Steps:**

- Milestone 0.2.0: Core package implementation
- Milestone 0.3.0: Port-forward engine
- Target: 1.0.0-Aerys in Q1 2024

---

## Upcoming Releases

### 1.0.0 - Aerys (Q1 2024)

**Status:** 📋 Planned  
**Type:** Major Release

**Headline Features:**

- Complete Kubernetes port-forward management
- GUI (Electron + React) and CLI applications
- Template creation, management, and execution
- Multi-cluster support
- Secrets/ConfigMaps integration
- Import/Export functionality
- Light/Dark themes
- Multi-language support (EN, IT)
- Full test coverage
- Code signing and distribution

**Upgrade Notes:**

- First stable release
- No breaking changes (initial version)

---

## Determining Version Increments

### When to bump MAJOR (X.0.0)

- Breaking API changes
- Incompatible CLI command structure changes
- Template format breaking changes
- Removal of features
- Major architectural rewrites

### When to bump MINOR (1.X.0)

- New features (backward-compatible)
- New CLI commands
- New GUI pages or major UI features
- Performance improvements
- Deprecation notices (but not removal)

### When to bump PATCH (1.0.X)

- Bug fixes
- Security patches
- Documentation updates
- Performance fixes (no new features)
- Minor UI improvements

### Pre-release Suffixes

- `-dev`: Active development
- `-alpha.N`: Early testing (may be unstable)
- `-beta.N`: Feature complete, testing
- `-rc.N`: Release candidate (production-ready testing)

**Examples:**

- `0.9.0-dev` - Development towards 1.0.0
- `1.0.0-rc.1` - First release candidate for 1.0.0
- `1.0.0` - Stable release
- `1.0.1` - Bug fix
- `1.1.0` - New features
- `2.0.0` - Breaking changes

---

## Release Process

### Development Releases (0.x.x-dev)

1. Commit to `develop` branch
2. Manual version bump in package.json files
3. Update CHANGELOG.md
4. Tag with `v0.X.X-dev`
5. CI builds artifacts (no distribution)

### Stable Releases (X.Y.Z)

1. Create `release/X.Y.Z` branch from `develop`
2. Bump version in all package.json files
3. Update VERSION.md (this file)
4. Update CHANGELOG.md
5. Update ROADMAP.md
6. Run full test suite
7. Create PR to `main`
8. Merge to `main` after review
9. Tag with `vX.Y.Z`
10. GitHub Actions:
    - Builds all platform artifacts
    - Signs Windows binaries (Azure)
    - Creates GitHub Release
    - Publishes to package managers (future)
11. Merge `main` back to `develop`
12. Announce release

---

## Automated Version Management

### Scripts

```bash
# Bump version (updates all packages)
pnpm version:bump [major|minor|patch]

# Check version consistency across packages
pnpm version:check

# Generate changelog
pnpm changelog:generate
```

### GitHub Actions

- **On PR to develop:** Run tests, no version bump
- **On merge to develop:** Build and test
- **On PR to main:** Full release candidate build
- **On merge to main (tagged):** Full release pipeline

---

## Version Compatibility

### Kubernetes Versions

Hodor targets compatibility with:

- **Minimum:** Kubernetes 1.20
- **Tested:** Kubernetes 1.24, 1.25, 1.26, 1.27, 1.28
- **Maximum:** Latest stable Kubernetes

### Platform Support

- **macOS:** 11 (Big Sur) and later
- **Windows:** 10 (1809+) and later, Windows 11
- **Linux:** Major distributions (Ubuntu 20.04+, Fedora 35+, etc.)

### Node.js Runtime

- **Development:** Node.js 18+ (LTS)
- **Bundled (Electron):** Electron's Node.js version

---

_This file is automatically updated during the release process._

_Last Updated: 2023-10-22_
