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

The releases and upstream Git references were checked on 2026-08-04. GitHub displayed verified signatures for the reviewed releases. Action code executes on the CI runner and may access the network; pinning limits mutation risk but does not eliminate trust in GitHub, the runner image, action code, or downloaded analysis/runtime artifacts.

## Dependency metadata result

- Application: 28 direct dependency/dev-dependency entries remain pinned to their existing exact versions; `use-sync-external-store` remains exactly overridden to `1.6.0`.
- Contracts: the final Hardhat 3 graph has 2 runtime and 14 development entries, all exact, plus four exact overrides. The lock contains 166 package entries.
- The application lock graph was not rewritten. The contract lock was intentionally regenerated for the reviewed Hardhat 3 migration; its resulting package nodes, versions, registry URLs and integrity values are part of the final-lock evidence rather than the earlier Hardhat 2 baseline.
- Publication age was rechecked for the selected contract graph before final locking. No seven-day release-age exception was approved or used.
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
| Development | `dotenv` | `17.3.1` |
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
| Application | `@tsparticles/engine` | `3.9.1` |
| Application | `bufferutil` | `4.1.0` |
| Application | `keccak` | `3.0.4` |
| Application | `rpc-websockets/node_modules/utf-8-validate` | `6.0.6` |
| Application | `sharp` | `0.34.5` |
| Application | `unrs-resolver` | `1.11.1` |
| Application | `utf-8-validate` | `5.0.10` |
| Contracts | `esbuild` | `0.28.1` |
| Contracts | `fsevents` | `2.3.3` |

Their scripts were not executed during this review. `.npmrc`, CI environment variables, and explicit `npm ci --ignore-scripts` commands deny them by default.

### Current vulnerability result

A fresh `npm audit` of the existing application graph on 2026-08-04 reported 37 findings: 1 critical, 10 high, 25 moderate, and 1 low (0 informational). Directly declared packages on affected paths include `next@16.2.6` (high), `@rainbow-me/rainbowkit@2.2.10` (moderate), `viem@2.47.4` (moderate), and `wagmi@2.19.5` (moderate). The critical finding is in transitive `shell-quote@1.8.3`, which is within the reported vulnerable range `<=1.8.4`.

The earlier Hardhat 2 contract-tooling graph reported 48 findings: 1 critical,
24 high, 10 moderate and 13 low. That graph is no longer the contract lock in
the current worktree. The final exact Hardhat 3 contract graph, including the
`glob@13.0.6` override, returned `npm audit` exit 0 with zero vulnerabilities at
every severity. npm reported dependency metadata of 5 production, 162
development, 34 optional and 166 total packages; those categories are npm's
own metadata and are not intended to be arithmetically additive. A matching
`npm audit signatures` run returned exit 0 with 141 registry-signature-verified
packages and 52 verified attestations.

The application graph remains release-blocking and is not release-ready. The
zero-advisory contract result is evidence about known registry advisories, not
proof that every dependency is benign or that a deployment occurred.

Do not run automatic fixes or silently upgrade the remaining affected
application packages. Resolve them in a dedicated dependency-only branch and
pull request that records old and proposed exact versions, release ages,
advisories and paths, lockfile/transitive changes, lifecycle-script changes,
ownership/provenance review, tests, audit output and registry-signature results.
The seven-day hold remains mandatory unless a narrowly documented
urgent-security exception is explicitly approved. Before merge, keep the
contract package/lock migration isolated as its own dependency change with the
same review evidence.

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

An isolated temporary dependency review also used immutable installs with
lifecycle scripts disabled and no production credentials. The earlier
application check reported 1,010/1,010 package signatures and 206 registry
attestations. Against the final exact contract lock, the current local
signature check verified 141 packages and 52 registry attestations with exit 0;
the matching audit reported zero vulnerabilities. A fresh offline Hardhat 3
compile completed, the complete contract suite passed 38/38, the focused
post-compromise suite passed 9/9, and TypeScript passed. These results are local
final-lock evidence, not deployment evidence. Repeat audit, signatures,
compile, tests and attestation on the authorised release runner and attach the
outputs by immutable digest before deployment.

The repository policy and history-aware secret scanner were executed with a
bundled Node.js runtime and passed. Official-registry `npm audit` queries
reconfirmed the 37 application findings and the final contract graph's zero
findings described above. CodeQL, GitHub dependency review, protected-branch
enforcement and provider-side secret scanning still require an authenticated
GitHub account and CI run.

### Dependency-remediation state

The contract-tooling remediation is present in the current worktree: unused
toolbox and `ts-node` surfaces were removed, Hardhat was migrated to the exact
Hardhat 3 plugin graph listed above, and the four reviewed exact overrides were
applied. The resulting contract audit is zero. This does not mean a deployment
has occurred; preserve the package and lock changes as a dedicated dependency
review unit before merge.

The application remediation is still only prepared research. It proposes
removing unused `@react-native-async-storage/async-storage`, updating to exact
`next@16.2.11` and `viem@2.54.2`, and adding narrowly reviewed exact transitive
overrides. Its candidate audit remains 17 findings (0 critical, 2 high,
14 moderate, 1 low). Although the reviewed `brace-expansion` release line has
now completed its hold, `hono@4.12.34`, published 2026-08-03T02:36:40Z, does
not complete seven days until 2026-08-10T02:36:40Z. No release-age exception
has been approved.

The application findings must be remediated, and required CI must pass, before
the public website is released. Keep these residual risks visible:

- The custom secret scanner is intentionally high-confidence and cannot replace GitHub secret scanning, push protection, provider-side revocation, or history scanning. Enable those repository settings manually.
- CodeQL result upload and dependency review depend on the repository's GitHub security-feature availability.
- Hardhat 3 may otherwise download Solidity compilers. Release attestation instead requires a pre-populated, digest-reviewed `compilers-v3` cache and an independently enforced network-disabled build; preserve the compiler lists, filenames, native/WASM selection and digests in the evidence package.
- CODEOWNERS is advisory until branch protection requires Code Owner approval and prevents bypass.
- Runner images are named (`ubuntu-24.04`) but are not immutable image digests. A higher-assurance release process should use an attested ephemeral runner image pinned by digest.
- Registry signatures are evidence of registry publication, not proof that package contents are benign. Both graphs still require current release-runner audit/signature evidence and the application graph requires its dedicated remediation review.
