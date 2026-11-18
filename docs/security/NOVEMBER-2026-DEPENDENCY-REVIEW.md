# November 2026 dependency review

Reviewed 18 November 2026 on Node 24.18.0 and npm 11.16.0. This candidate updates existing application and contract build dependencies. The runtime audits are clear. Full audit gates still block promotion.

| Lockfile | Before, critical / high / moderate / low | After, critical / high / moderate / low | After, production only |
| --- | --- | --- | --- |
| Application | 1 / 14 / 6 / 0 | 0 / 14 / 0 / 0 | 0 |
| Contracts | 0 / 11 / 3 / 1 | 0 / 7 / 0 / 0 | 0 |

Next.js and its ESLint configuration move together to 16.4.6. The framework update includes matching SWC binaries. Sharp 0.35.5 and its optional platform packages update the SVG image processing path. Runtime overrides also cover source map processing and validation. No new direct dependency is required. [Next release](https://github.com/vercel/next.js/releases/tag/v16.4.6) · [Sharp advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)

The contract test environment updates archive handling, glob matching, serialization, HTTP parsing and YAML parsing. Glob 14 uses minimatch 11 and adds one transitive package, `@isaacs/nonrecursive-glob-match@1.1.0`. The matcher changes pattern semantics, is pure JavaScript and has zero runtime dependencies. Its archive contains 36 files and 426,992 unpacked bytes. npm identifies isaacs as publisher and includes a registry signature. The package metadata omits a repository URL and provenance attestation. The maintainer's minimatch repository documents the dependency. Its prepare script is `tshy && bash scripts/build.sh`. The packaged distribution works with lifecycle scripts disabled. [Maintainer's changelog](https://github.com/isaacs/minimatch/blob/main/changelog.md)

The two direct pins already existed. Next runs application, filesystem, network and build code. Its ESLint configuration loads lint plugins in CI. Neither needs credentials during installation or testing. These updates avoid replacing the framework or contract test runner. The source-map-js and YAML overrides use patched point releases. The application pins minimatch 11.0.8 only for TypeScript ESLint’s typescript-estree 8.66.0. Its one runtime call uses the retained minimatch function to match default-project files. The scope excludes other ESLint consumers, which retain minimatch 3.1.5.

### Verification

All selected releases cleared seven full days. The newest selected release was minimatch 11.0.8, published 11 November at 09:50 UTC. npm generated both locks from the official registry. Each changed tarball's SHA-512 matched its lock entry. Archive members, package identity, native-file counts and declared install and prepare hooks were inspected. Existing licenses stayed the same. The new matcher is BlueOak-1.0.0. Version metadata lists one fewer maintainer for @swc/helpers and replaces owlstronaut with martinrrm in semver's existing npm team.

Clean immutable installs used `npm ci --ignore-scripts` in both workspaces without credentials. No dependency lifecycle scripts ran. The locks flag install hooks for unrs-resolver 1.12.2, esbuild 0.28.1 and fsevents 2.3.3. Published prepare hooks remain inert during these installs. Both production-only audits returned zero. Signature verification validated 551 application packages and 107 attestations, plus 141 contract packages and 53 attestations on macOS ARM64. The application production build and 282 application tests passed on the dependency branch, as did 50 contract tests. The release workflow must repeat these checks on its Linux platform.

The scoped minimatch override crosses the parser’s declared major range. On clean installs, minimatch 10.2.6 and 11.0.8 both passed the TypeScript project-service tests for an included file, an explicitly allowed dotfile, and an excluded file. Full ESLint output covered 285 paths with identical diagnostics after normalizing checkout paths. The new application transitive matcher and minimatch release have the same SHA-512 integrity and registry origin as the previously reviewed contracts graph. npm resolved no other new package name. [Upstream API changes](https://github.com/isaacs/minimatch/blob/main/changelog.md)

### Open advisories

- Frontend development tooling still resolves picomatch through fast-glob, micromatch, fdir and tinyglobby. The registry lists no patched release. The minimatch advisory was removed from the application. npm now attributes 14 entries to the remaining high picomatch advisory. The preceding lock reported nine high and six moderate entries across two underlying advisories. Lint and build inputs in CI remain relevant. [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- Hardhat, its ethers and Mocha plugins, and its Zod utility still declare Zod 3. The advisory names 4.6.6 as the first patch. Hardhat 3.21.2, the newest version past the seven-day hold at review time, still declares Zod ^3.23.8. Its installed validation helper uses error.errors.map. A benign invalid field confirmed that Zod 3.25.76 returns that array and Zod 4.6.7 omits the property. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

Accept these updates for review. Promotion remains blocked on applicable high findings. No advisories were suppressed and no release-age or lifecycle exception was applied. The dependency branch changes no GitHub Action or workflow.

### Exact lockfile changes

The tables include optional packages for other platforms. A dash in the old-version column marks a new package. The registry signature was present for every changed tarball. Provenance in this table records published metadata. The signature command above verified the installed platform.


#### package-lock.json

| Package | Old | New | Published UTC | License | Native files | Provenance |
| --- | --- | --- | --- | --- | ---: | --- |
| @isaacs/nonrecursive-glob-match | — | 1.1.0 | 2026-11-05 | BlueOak-1.0.0 | 0 | unavailable |
| minimatch (typescript-estree only) | 10.2.6 | 11.0.8 | 2026-11-11 | BlueOak-1.0.0 | 0 | yes |
| @img/sharp-darwin-arm64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-darwin-x64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-freebsd-wasm32 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 0 | yes |
| @img/sharp-libvips-darwin-arm64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-darwin-x64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-arm | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-arm64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-ppc64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-riscv64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-s390x | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linux-x64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linuxmusl-arm64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-libvips-linuxmusl-x64 | 1.3.2 | 1.3.4 | 2026-09-27 | LGPL-3.0-or-later | 1 | yes |
| @img/sharp-linux-arm | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linux-arm64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linux-ppc64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linux-riscv64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linux-s390x | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linux-x64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linuxmusl-arm64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-linuxmusl-x64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 1 | yes |
| @img/sharp-wasm32 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 | yes |
| @img/sharp-webcontainers-wasm32 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 0 | yes |
| @img/sharp-win32-arm64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 AND LGPL-3.0-or-later | 3 | yes |
| @img/sharp-win32-ia32 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 AND LGPL-3.0-or-later | 3 | yes |
| @img/sharp-win32-x64 | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 AND LGPL-3.0-or-later | 3 | yes |
| @next/env | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 0 | yes |
| @next/eslint-plugin-next | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 0 | yes |
| @next/swc-darwin-arm64 | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-darwin-x64 | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-linux-arm64-gnu | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-linux-arm64-musl | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-linux-x64-gnu | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-linux-x64-musl | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-win32-arm64-msvc | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @next/swc-win32-x64-msvc | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 1 | yes |
| @swc/helpers | 0.5.15 | 0.5.23 | 2026-05-27 | Apache-2.0 | 0 | yes |
| brace-expansion | 5.0.9 | 5.0.12 | 2026-09-14 | MIT | 0 | unavailable |
| brace-expansion | 1.1.18 | 1.1.21 | 2026-09-14 | MIT | 0 | unavailable |
| eslint-config-next | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 0 | yes |
| fastq | 1.20.1 | 1.20.3 | 2026-08-29 | ISC | 0 | yes |
| js-yaml | 4.3.1 | 4.3.2 | 2026-08-26 | MIT | 0 | unavailable |
| next | 16.3.0 | 16.4.6 | 2026-11-09 | MIT | 4 | yes |
| sharp | 0.35.3 | 0.35.5 | 2026-09-27 | Apache-2.0 | 0 | yes |
| semver | 7.8.5 | 7.8.6 | 2026-11-02 | ISC | 0 | yes |
| source-map-js | 1.2.1 | 1.2.2 | 2026-09-30 | BSD-3-Clause | 0 | unavailable |
| zod | 4.4.3 | 4.6.7 | 2026-10-12 | MIT | 0 | yes |

Removed lock entries: none.

#### contracts/package-lock.json

| Package | Old | New | Published UTC | License | Native files | Provenance |
| --- | --- | --- | --- | --- | ---: | --- |
| @isaacs/nonrecursive-glob-match | — | 1.1.0 | 2026-11-05 | BlueOak-1.0.0 | 0 | unavailable |
| adm-zip | 0.6.0 | 0.6.1 | 2026-09-11 | MIT | 0 | unavailable |
| brace-expansion | 2.1.4 | 2.1.7 | 2026-09-14 | MIT | 0 | unavailable |
| glob | 13.0.6 | 14.0.4 | 2026-11-06 | BlueOak-1.0.0 | 0 | unavailable |
| js-yaml | 4.3.1 | 4.3.2 | 2026-08-26 | MIT | 0 | unavailable |
| lru-cache | 11.5.2 | 11.5.3 | 2026-09-18 | BlueOak-1.0.0 | 0 | unavailable |
| minimatch | 10.2.6 | 11.0.8 | 2026-11-11 | BlueOak-1.0.0 | 0 | yes |
| path-scurry | 2.0.2 | 3.0.0 | 2026-10-27 | BlueOak-1.0.0 | 0 | unavailable |
| serialize-javascript | 7.0.5 | 7.1.4 | 2026-10-23 | BSD-3-Clause | 0 | yes |
| undici | 6.28.0 | 6.29.1 | 2026-10-15 | MIT | 0 | yes |

Removed lock entries: none.
