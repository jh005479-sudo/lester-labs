# November 2026 dependency review

## Final tooling migration on PR 97

Both unrestricted npm audits and both production-only audits returned zero findings on 18 November 2026. The previous application lock had 14 high entries attributed to picomatch. The previous contracts lock had seven attributed to Zod. The full audit, signature, lint, build and test gates and all GitHub Action pins are intact. [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

### Why the consumers changed

Oxlint 1.93.0 replaces eslint-config-next 16.4.6 and its glob-dependent TypeScript and import-resolution tooling. Current age-eligible Next and TypeScript ESLint packages still depend on fast-glob and tinyglobby respectively. Their upgrade would retain picomatch. The replacement has a native TypeScript parser, can load the existing React rule implementations and covers Next, import and accessibility checks. ESLint 9.39.4 supplies the plugins’ declared peer. The MIT-licensed Next 16.4.6 relative-navigation rule is retained in source because Oxlint lacks it. Its ESLint scope helper remains pinned. Seven existing hook directives now reference the plugin under its Oxlint name. A previously missed internal anchor now uses Next Link. [Oxlint release](https://github.com/oxc-project/oxc/tree/oxlint_v1.93.0) · [Upstream navigation rule](https://github.com/vercel/next.js/blob/v16.4.6/packages/eslint-plugin-next/src/rules/no-location-assign-relative-destination.ts)

The contracts lock changes only Zod 3.25.76 to 4.6.7. Both Hardhat 3.11.1 and the eligible upgrade 3.21.2 declare Zod 3. The repository’s Hardhat config redirects the public validation helper for four pinned Hardhat packages. The adapter re-exports the upstream schemas and implements the two migrations for error paths and incompatible fields with Zod 4.6.7. It executes the patched v4 parser. The original registry files and Hardhat CLI remain byte-for-byte intact. The trusted build producer and verifier both bind the adapter as an input. Recheck the adapter, native plugin APIs and complete lint configuration on future upstream upgrades. [Zod migration guide](https://zod.dev/v4/changelog) · [Hardhat source](https://github.com/NomicFoundation/hardhat)

### Exact direct dependency review

All entries use signed tarballs from https://registry.npmjs.org, are MIT-licensed, and passed the seven-day hold. These are development-only dependencies. The closure column counts distinct locked dependencies, including optional platforms, excluding peers. Existing plugin closures overlap. Sizes are unpacked bytes. “Attested” denotes registry provenance in addition to the registry signature.

| Package and version | Published UTC | Owner and source | Bytes | Direct / closure | Attested | Accepted purpose |
| --- | --- | --- | ---: | ---: | --- | --- |
| oxlint 1.93.0 | 2026-11-09 | [Oxc project](https://github.com/oxc-project/oxc), boshen | 2,436,426 | 0 + 19 platform / 19 | yes | Replace glob-dependent lint tooling |
| eslint-plugin-react 7.37.5 | 2025-04-03 | [jsx-eslint](https://github.com/jsx-eslint/eslint-plugin-react), ljharb and yannickcr | 937,569 | 18 / 123 | no | Retain React deprecation and JSX usage rules |
| eslint-plugin-react-hooks 7.1.1 | 2026-04-17 | [Meta React](https://github.com/facebook/react), react-bot | 4,095,735 | 5 / 43 | no | Retain the React Compiler and Hooks diagnostics |
| @eslint-community/eslint-utils 4.9.1 | 2025-12-31 | [ESLint Community](https://github.com/eslint-community/eslint-utils) | 506,000 | 1 / 1 | yes | Resolve scopes and constant expressions in the retained Next rule |
| @nomicfoundation/hardhat-zod-utils 3.0.5 | 2026-05-20 | [Nomic Foundation](https://github.com/NomicFoundation/hardhat), GitHub trusted publisher | 60,345 | 2 / 16 | yes | Reuse the pinned Hardhat schemas in the adapter |
| zod 4.6.7 | 2026-10-12 | [Colin McDonnell](https://github.com/colinhacks/zod) | 6,148,944 | 0 / 0 | yes | Validate Hardhat settings and RPC values with the patched parser |

Only Oxlint and its 19 exact native platform bindings introduce new package names. The application lock removes 101 entries and adds 20. The five other direct tools above were already present transitively across the two projects. The contracts lock adds zero package entries. All six direct tarballs and all 19 binding archives were inspected for identity, integrity, files and lifecycle scripts. Oxlint ships prebuilt native code for the selected platform. Its optional Vite and type-aware peers are absent. The other five entries are JavaScript. Zod declares a publish-only hook. The lockfiles flag install hooks only for contracts esbuild 0.28.1 and fsevents 2.3.3. None of these hooks ran. Published maintainer sets were consistent with the preceding stable releases. The two legacy React plugin releases have registry signatures without a provenance attestation. Their already locked bytes were retained.

The tools read project sources and configuration while linting, building and testing. They execute with the Node process’s filesystem, environment and process privileges. Native binaries and JS lint plugins are trusted build inputs. They require no wallet credentials. The build verifier hashes the dependency tree. Replacing Hardhat would also change the contract runtime, compiler and attestation boundaries. The narrow adapter retains those parts of the release process.

### Verification

On Node 24.18.0 and npm 11.16.0, clean installs used credential-free homes and disabled lifecycle scripts. Locally, 478 application and 141 contracts package signatures verified, with 82 and 53 provenance attestations respectively. The lint migration retained every previously scanned source file, all 73 warning occurrences at the same paths and lines, and all previous configured rule severities. The production build, 282 application tests and 52 contract tests passed. Two forced compilations produced identical locker artifacts. Contract regressions exercise invalid network, compiler and Mocha configurations and both accepted and rejected RPC parameters.

## Earlier dependency review, before the tooling migration

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
