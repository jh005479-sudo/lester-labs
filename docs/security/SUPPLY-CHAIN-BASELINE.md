# Supply-Chain Baseline

This record documents the security controls introduced during the August 2026 post-compromise review. It is not a claim that the current dependency graph or deployment is vulnerability-free. Refresh it in a dependency-only pull request whenever a package manager, dependency, action, lockfile, or build tool changes.

## Package-manager pin

| Field | Reviewed value |
| --- | --- |
| Package | `npm` |
| Exact version | `11.16.0` |
| Official registry publication | 2026-05-27T20:45:38.286Z |
| Repository | `https://github.com/npm/cli.git` |
| Licence | Artistic-2.0 |
| Node engine | `^20.17.0 || >=22.9.0` |
| Registry integrity | `sha512-A74XL8OxmcegZDMWPkWb5bEQppg8HdYwW3rBD2sPoS4UQHVajfaxBkqyzLeJ3wR0kZ+5xoTjItxXaF7eIXUsyw==` |
| Registry signature | Present; key ID `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U` |
| Registry attestations field | Not present |
| Unpacked size / file count | 12,007,318 bytes / 1,933 files |
| Runtime pairing | Node.js `24.18.0` LTS, released 2026-06-23, officially bundles npm `11.16.0` |
| Release-age decision | Accepted; both versions were older than seven days on 2026-08-04 |

`min-release-age` was introduced in npm `11.10.0`; the selected npm version supports it. CI checks the exact Node.js and npm versions before installation.

The npm package has development and release scripts in its published manifest, including `prepack`, but CI does not install npm as a project dependency or execute those scripts. The selected Node.js distribution supplies it. Node.js publishes signed SHASUMS for the pinned release.

## GitHub Action pins

| Action | Immutable commit | Release | Release date | Purpose and decision |
| --- | --- | --- | --- | --- |
| `actions/checkout` | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` | `v6.0.2` | 2026-01-09 | Required to access the reviewed revision; accepted with persisted credentials disabled. |
| `actions/setup-node` | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` | `v6.4.0` | 2026-04-20 | Required to provision exact Node.js; accepted with automatic package-manager caching disabled. |
| `github/codeql-action` | `7211b7c8077ea37d8641b6271f6a365a22a5fbfa` | `v4.36.0` | 2026-05-22 | Required for GitHub CodeQL static analysis; accepted with only `contents: read` and `security-events: write`. The immutable annotated release tag resolves to this commit. |
| `actions/dependency-review-action` | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` | `v5.0.0` | 2026-05-08 | Required to reject pull requests introducing high/critical dependency vulnerabilities; accepted with read-only repository permission and no PR comment permission. |
| `actions/attest-build-provenance` | `0f67c3f4856b2e3261c31976d6725780e5e4c373` | `v4.1.1` | 2026-06-26 | Required to sign exact release and recovery evidence subjects; accepted only in the specific jobs granted `id-token: write` and `attestations: write`, with repository contents otherwise read-only. |
| `actions/download-artifact` | `018cc2cf5baa6db3ef3c5f8a56943fffe632ef53` | `v6.0.0` | 2025-10-24 | Required to retrieve exact run-ID/run-attempt-qualified evidence packages; accepted only in jobs with `actions: read` and `contents: read`, with cross-run downloads bound to the recovered repository and validated originating run. |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | `v4.6.2` | 2025-03-19 | Required to retain explicit evidence directories; accepted with missing-file failure, bounded retention, no wildcard workspace upload, and no additional repository write permission. |

The original four releases and upstream Git references were checked on
2026-08-04; the three release-evidence actions were checked on 2026-08-11.
GitHub displayed verified signatures for the reviewed releases, and every
selected release was older than seven days at its review date. Action code
executes on the CI runner and may access the network; pinning limits mutation
risk but does not eliminate trust in GitHub, the runner image, action code, or
downloaded analysis/runtime artifacts.

## Dependency metadata result

- Application: 22 direct dependency/dev-dependency entries are pinned to exact versions (14 runtime and 8 development); `use-sync-external-store` remains exactly overridden to `1.6.0`.
- Contracts: the final Hardhat 3 graph has 2 runtime and 13 development entries, all exact, plus four exact overrides. The lock contains 165 package entries.
- The application lock was intentionally rewritten for the dedicated remediation recorded in `APPLICATION-DEPENDENCY-REMEDIATION.md`; it contains 634 package nodes. The contract lock was intentionally regenerated for the reviewed Hardhat 3 migration. Their resulting package nodes, versions, registry URLs and integrity values are part of the final-lock evidence rather than the earlier baselines.
- Publication age was rechecked across all 623 unique registry package/version selections in the final application lock and for the selected contract graph. No seven-day release-age exception was approved or used.
- Both lockfiles use lockfile version 3. Every locked tarball with a `resolved` field uses the official HTTPS npm registry and has an integrity digest.
- No Git, mutable tag, remote arbitrary tarball, local-path, or unverified-registry source appears in either lockfile.

Exact final contract direct graph:

| Class | Package | Exact version |
| --- | --- | --- |
| Runtime | `@uniswap/v2-core` | `1.0.1` |
| Runtime | `@uniswap/v2-periphery` | `1.1.0-beta.0` |
| Development | `@nomicfoundation/hardhat-ethers` | `4.0.15` |
| Development | `@nomicfoundation/hardhat-ethers-chai-matchers` | `3.0.11` |
| Development | `@nomicfoundation/hardhat-mocha` | `3.0.21` |
| Development | `@nomicfoundation/hardhat-network-helpers` | `3.0.11` |
| Development | `@openzeppelin/contracts` | `5.1.0` |
| Development | `@types/chai` | `5.2.3` |
| Development | `@types/mocha` | `10.0.10` |
| Development | `@types/node` | `25.5.0` |
| Development | `chai` | `6.2.2` |
| Development | `ethers` | `6.17.0` |
| Development | `hardhat` | `3.11.1` |
| Development | `mocha` | `11.3.0` |
| Development | `typescript` | `5.9.3` |

Exact contract overrides:

| Package | Exact override | Decision |
| --- | --- | --- |
| `adm-zip` | `0.6.0` | Reviewed exact transitive remediation. |
| `brace-expansion` | `2.1.4` | Reviewed exact transitive remediation after the seven-day hold elapsed. |
| `glob` | `13.0.6` | Reviewed exact override required to remove the remaining vulnerable transitive line; published 2026-02-19, dry-run tarball inspected, signature verified, and no release-age exception required. |
| `serialize-javascript` | `7.0.5` | Reviewed exact transitive remediation. |

Existing locked packages that declare install scripts:

| Project | Package | Version |
| --- | --- | --- |
| Application | `unrs-resolver` | `1.12.2` |
| Contracts | `esbuild` | `0.28.1` |
| Contracts | `fsevents` | `2.3.3` |

Their scripts were not executed during this review. `.npmrc`, CI environment variables, and explicit `npm ci --ignore-scripts` commands deny them by default.

### Current vulnerability result

A fresh `npm audit` of the committed predecessor application graph on
2026-08-10 reported 46 findings: 1 critical, 20 high, 24 moderate, and 1 low.
The critical path was the unused
`@react-native-async-storage/async-storage@1.24.0` peer graph through React
Native and React DevTools to `shell-quote@1.8.3`. Other affected paths entered
through `next@16.2.6`, `eslint-config-next@16.1.6`, `wagmi@2.19.5`, and
`viem@2.47.4`.

The dedicated application remediation removes six unused direct dependencies
and updates Next, its ESLint configuration, Wagmi, Viem, React, and React DOM to
the exact versions recorded in `APPLICATION-DEPENDENCY-REMEDIATION.md`. Its
final immutable install returned `npm audit` exit 0 with zero vulnerabilities
at every severity. `npm audit signatures` verified all 549 installed-package
signatures and 105 provenance attestations with exit 0.

The earlier Hardhat 2 contract-tooling graph reported 48 findings: 1 critical,
24 high, 10 moderate and 13 low. That graph is no longer the contract lock in
the current worktree. The final exact Hardhat 3 contract graph, including the
`glob@13.0.6` override, returned `npm audit` exit 0 with zero vulnerabilities at
every severity. npm reported dependency metadata of 5 production, 161
development, 34 optional and 165 total packages; those categories are npm's
own metadata and are not intended to be arithmetically additive. A matching
`npm audit signatures` run returned exit 0 with 140 registry-signature-verified
packages and 52 verified attestations.

The application dependency graph is no longer advisory-blocked. This is
evidence about known registry advisories, not proof that every dependency is
benign or that a deployment occurred. During the same 2026-08-10 verification,
a newly published advisory caused the contract graph to report one high
`js-yaml` finding. The separate preceding contract review updates only that
transitive selection to exact `js-yaml@4.3.1`; its fresh immutable audit is
again zero. The contract and application changes remain separate commits and
review records; no automatic audit fix was used.

## Verification and limitations

Completed locally as investigative checks on the factory-reset Mac (these
results are not production clean-runner release evidence):

- JSON parsing for both manifests and lockfiles;
- semantic equality of manifest and lockfile-root dependency metadata;
- exact direct-version and override checks;
- official-registry source and integrity-presence checks;
- GitHub workflow YAML parsing;
- full-SHA action-pin checks;
- shell syntax validation for `run-sweep.sh`;
- high-confidence secret-pattern checks across the worktree and every unique
  historical Git text blob;
- whitespace/error checks with `git diff --check`.

An isolated temporary dependency review used immutable installs with lifecycle
scripts disabled and no production credentials. Against the final application
lock, the current local signature check verified 549 packages and 105 registry
attestations with exit 0; the matching audit reported zero vulnerabilities.
TypeScript, lint, 164/164 application unit tests, the public-manifest gate, and
the Next 16.3.0 production build passed. The contract graph's recorded
140-signature/52-attestation result was repeated after the separate `js-yaml`
remediation, and its audit returned zero. These are local review results, not
deployment evidence. Repeat audit, signatures, builds, tests and attestation on
the authorised release runner and attach the outputs by immutable digest before
deployment.

The repository policy and history-aware secret scanner were executed with a
bundled Node.js runtime and passed. Official-registry `npm audit` queries
reconfirmed zero findings in both the final application and contract graphs
described above. The earlier 37-finding application graph is retained only as
pre-remediation comparison evidence. CodeQL, GitHub dependency review, protected-branch
enforcement and provider-side secret scanning still require an authenticated
GitHub account and CI run.

### Dependency-remediation state

The contract-tooling remediation is present in the current worktree: unused
toolbox and `ts-node` surfaces were removed, Hardhat was migrated to the exact
Hardhat 3 plugin graph listed above, and the four reviewed exact overrides were
applied. The resulting contract audit is zero. This does not mean a deployment
has occurred; preserve the package and lock changes as a dedicated dependency
review unit before merge.

The application remediation is complete in its dedicated review unit. It
removes the obsolete wallet, React Native, particle, tooltip, and animation
surfaces; updates six direct packages to their exact reviewed versions; uses no
new override; and resolves the earlier `shell-quote`, Hono, WalletConnect,
MetaMask SDK, Axios, socket.io, Next, Viem, Babel, brace-expansion, js-yaml, and
`ws` advisory paths. Every selected release completed the seven-day hold; no
exception was approved.

Every dependency graph must remain advisory-clean and required CI must pass
before the public website is released. Keep these residual risks visible:

- The custom secret scanner is intentionally high-confidence and cannot replace GitHub secret scanning, push protection, provider-side revocation, or history scanning. Enable those repository settings manually.
- CodeQL result upload and dependency review depend on the repository's GitHub security-feature availability.
- Hardhat 3 may otherwise download Solidity compilers. Release attestation instead requires a pre-populated, digest-reviewed `compilers-v3` cache and an independently enforced network-disabled build; preserve the compiler lists, filenames, native/WASM selection and digests in the evidence package.
- CODEOWNERS is advisory until branch protection requires Code Owner approval and prevents bypass.
- Runner images are named (`ubuntu-24.04`) but are not immutable image digests. A higher-assurance release process should use an attested ephemeral runner image pinned by digest.
- Registry signatures are evidence of registry publication, not proof that package contents are benign. Both remediated graphs still require current release-runner audit/signature evidence before release.
