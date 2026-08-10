# Application Dependency Remediation Review

Date: 2026-08-10

Scope: the dependency-only application changes in the root `package.json` and
`package-lock.json`, plus the source compatibility changes required by Wagmi 3
and the upgraded Next.js ESLint policy.

Decision: **accept this exact application graph, subject to the controls and
remaining release gates below.** No seven-day release-age exception was
requested or used. This review is not production deployment evidence, and a
zero-advisory result does not prove that third-party code is benign.

## Final immutable evidence

| Check | Reviewed result |
| --- | --- |
| Runtime and package manager | Official Node.js `24.18.0` distribution, SHA-256 checked against the official `SHASUMS256.txt`; bundled npm `11.16.0` |
| Application lock SHA-256 | `932576cfcb9f720e0c658d520899dcc43455f2f0308a913b9ee83458512ceb18` |
| Lock shape | lockfile v3; 634 package nodes plus the root package; 14 runtime and 8 development direct declarations; one unchanged exact override |
| Lock sources | 628 resolved package nodes use `https://registry.npmjs.org/` and have integrity digests; no Git, local-path, arbitrary-tarball, or alternate-registry source is selected |
| Immutable install | `npm ci --ignore-scripts --no-audit --no-fund` installed 549 packages in a disposable, credential-free copy |
| Vulnerability audit | `npm audit` completed with exit 0 and `0` vulnerabilities at every severity |
| Registry verification | `npm audit signatures` completed with exit 0: 549 package signatures and 105 provenance attestations verified |
| Release age | All 623 unique registry package/version selections were checked at `2026-08-10T21:48:24.936Z`; none was younger than seven days and no registry timestamp was missing |
| Install-script declarations | Only `unrs-resolver@1.12.2` is marked `hasInstallScript` in the final application lock |
| Script execution | No dependency lifecycle script was executed; every resolution, install, audit, and verification command kept lifecycle scripts disabled |

The platform-specific signature count is lower than the total number of lock
nodes because npm does not install optional packages for other operating
systems. Registry verification must be repeated on the production x64 Linux
runner against this exact lock.

## What changed

Six unused direct dependencies were removed:

| Removed exact package | Reason for removal and security effect |
| --- | --- |
| `@rainbow-me/rainbowkit@2.2.10` | The source has no RainbowKit import, provider, stylesheet, connector, or UI. Removing it deletes an obsolete wallet/QR dependency surface. |
| `@react-native-async-storage/async-storage@1.24.0` | This browser application has no use of AsyncStorage. Its React Native peer path pulled Metro, React DevTools, and critical `shell-quote@1.8.3` into the graph. |
| `@radix-ui/react-tooltip@1.2.8` | No source, configuration, or dynamic import uses the tooltip package. The other Radix components remain directly declared. |
| `@tsparticles/react@3.0.0` | No particle component or engine initialization remains. |
| `@tsparticles/slim@3.9.1` | No `loadSlim` or tsParticles configuration remains. Its removal also deletes the unused `@tsparticles/engine` install hook. |
| `framer-motion@12.38.0` | No source or dynamic import uses Framer Motion. |

Six coordinated direct packages were updated to exact versions:

| Package | Old | New | Published UTC | Purpose and decision |
| --- | ---: | ---: | --- | --- |
| `next` | `16.2.6` | `16.3.0` | 2026-08-03 20:34:17 | Required application framework. Removes the affected Next/PostCSS/Sharp/NanoID graph. Accept exact reviewed version. |
| `eslint-config-next` | `16.1.6` | `16.3.0` | 2026-08-03 20:31:30 | Keeps framework lint policy aligned with Next and selects fixed Babel, brace-expansion, and js-yaml tooling. Accept as development-only tooling. |
| `wagmi` | `2.19.5` | `3.7.6` | 2026-08-03 20:57:09 | Required React wallet state/hooks. Wagmi 3 leaves unused remote connectors as optional peers, removing WalletConnect, MetaMask SDK, Coinbase, Porto/Hono, Axios, and related paths from the installed graph. |
| `viem` | `2.47.4` | `2.54.2` | 2026-07-03 04:23:00 | Required ABI, RPC, and transaction-validation implementation. Selects fixed `ws@8.21.0`. Treat as wallet- and RPC-sensitive. |
| `react` | `19.2.3` | `19.2.8` | 2026-07-21 15:41:28 | Required UI runtime and compatible peer for the framework/wallet upgrade. |
| `react-dom` | `19.2.3` | `19.2.8` | 2026-07-21 15:41:41 | Required browser renderer and compatible peer for React/Next. |

No third-party dependency was added. The existing exact
`use-sync-external-store@1.6.0` override is unchanged, and no new override was
introduced.

### Exact selected-version registry review

Every updated direct version is MIT licensed, registry signed, and has a SLSA
provenance v1 attestation pointer in its exact registry metadata. None declares
`preinstall`, `install`, or `postinstall`.

| Exact package | Unpacked bytes / files | Runtime + optional dependencies | Publisher or maintainer | Registry signatures / provenance | Repository |
| --- | ---: | ---: | --- | --- | --- |
| `next@16.3.0` | 184,043,350 / 8,519 | 6 + 9 | Vercel release maintainers | 2 / Yes | `github.com/vercel/next.js` |
| `eslint-config-next@16.3.0` | 14,190 / 9 | 9 + 0 | Vercel/Next maintainers | 2 / Yes | `github.com/vercel/next.js` |
| `wagmi@3.7.6` | 1,900,191 / 553 | 3 + 0 | `awkweb`, `jmoxey` | 2 / Yes | `github.com/wevm/wagmi` |
| `viem@2.54.2` | 24,611,572 / 9,981 | 8 + 0 | `awkweb`, `jmoxey` | 1 / Yes | `github.com/wevm/viem` |
| `react@19.2.8` | 171,598 / 27 | 0 + 0 | Meta React publishers | 1 / Yes | `github.com/react/react` |
| `react-dom@19.2.8` | 7,319,407 / 43 | 1 + 0 | Meta React publishers | 1 / Yes | `github.com/react/react` |

The exact tarballs for these six packages and `unrs-resolver@1.12.2` were
downloaded with `npm pack --ignore-scripts` into a disposable directory. Every
SHA-1 and SHA-512 matched the official registry metadata, every registry ECDSA
signature verified, and each npm/SLSA attestation subject matched its tarball.
No archive contained an absolute/traversal path, symlink, hardlink, or hidden
entry. The Wagmi tarball explicitly exports `wagmi/actions`; Viem contains the
expected opt-in wallet, RPC, WebSocket, CCIP, private-key helper, and browser
storage APIs, but the review found no import-time credential collection or
unsolicited transaction/network action. The other upgraded direct tarballs had
no unexpected lifecycle hook or native binary.

The youngest final selection was `wagmi@3.7.6`. At the graph-wide release-age
check it was already more than seven full days old. The check covered 628
resolved nodes representing 623 unique package/version selections, returned no
under-age result and no registry error, and used the official npm registry.

### Capability and maintenance assessment

- Next executes build plugins, transforms application code, reads the source
  tree, and selects optional SWC/Sharp platform binaries. It must run only in a
  disposable unprivileged build environment without wallet, hosting, cloud,
  SSH, or registry credentials. Its unusually large tarball makes the Vercel
  publication path a material trust boundary.
- Wagmi and Viem handle wallet state, RPC data, ABI encoding, transaction
  preparation, and responses derived from untrusted chains. The application
  continues to allow only its single source-declared injected connector and
  routes writes through the central chain/target/call-data guard. Package
  upgrades do not replace those application-level controls.
- React and React DOM execute all client UI code and consume chain-controlled
  metadata. Existing output encoding, bounded metadata handling, and external
  URL validation remain required.
- ESLint and its parsers execute only in development/CI, but they process the
  complete source tree and therefore remain supply-chain-sensitive. They must
  not be present in a production runtime artifact.
- Ownership remains with the established Vercel, Meta React, and wevm project
  maintainers. Exact pins, integrity, signatures, and provenance constrain
  mutation but do not remove publisher-account or source-to-package risk.

## Graph and advisory reduction

The committed predecessor lock had 1,297 package nodes. The reviewed lock has
634: 679 paths removed, 16 added, and 138 paths updated to a different version.
The disposable platform install contains 549 packages.

A fresh audit of the predecessor graph on 2026-08-10 reported 46 findings: 1
critical, 20 high, 24 moderate, and 1 low. The resolved graph removes every
reported affected path, including:

- AsyncStorage peer to React Native, React DevTools, and
  `shell-quote@1.8.3` (critical);
- Wagmi 2 connectors to WalletConnect/Reown, MetaMask SDK, Porto/Hono,
  Coinbase/CDP, Axios/form-data, socket.io, and vulnerable `ws` lines;
- the affected Next, PostCSS, Sharp, NanoID, Viem/ws, Babel,
  brace-expansion, and js-yaml versions.

Notable safe final selections include `@babel/core@7.29.7`,
`brace-expansion@1.1.18` and `5.0.9`, `js-yaml@4.3.1`,
`nanoid@3.3.17`, `postcss@8.5.23`, `sharp@0.35.3`, and `ws@8.21.0`.
The final `npm audit` result is zero at every severity. This is evidence about
known advisories at the recorded time, not evidence that unknown or malicious
behavior is impossible.

## Source compatibility changes

Ten application files previously imported actions from undeclared transitive
`@wagmi/core`. They now use the official `wagmi/actions` export from the direct
dependency. Declaring `@wagmi/core` directly was rejected because it was not
needed and strict peer resolution attempted to add an unused Accounts/Privy
surface.

The upgraded React lint policy found six existing errors. They were fixed
without disabling or weakening a rule:

- swap and liquidity-removal deadlines are generated outside render and remain
  fresh at transaction submission;
- settlement preview calldata uses the stable deadline captured with its
  authenticated preview quote;
- locker time is updated after commit and fails closed before its first clock
  value; and
- ledger callback refs are synchronized after render rather than mutated
  during render.

## Final validation

The following local checks used the exact pinned Node/npm pairing and an
immutable install in a fresh temporary copy with an empty credential
environment:

- package-policy verification: pass for both npm projects;
- high-confidence current-worktree and Git-history secret scan: pass for 1,745
  current files and all unique historical text blobs;
- application `npm audit`: 0 findings;
- application `npm audit signatures`: 549 signatures and 105 attestations,
  exit 0;
- `npm ls --all`: pass with no invalid or missing peer graph;
- TypeScript: pass;
- ESLint: pass with 0 errors; 90 existing warnings remain visible;
- application unit tests: 164/164 pass;
- approved-public-replacement verifier: pass in the intended fail-closed
  `NOT_APPROVED` state; and
- Next.js 16.3.0 production build: pass, including TypeScript and generation of
  all 30 static pages.

No dependency lifecycle script was executed. The final application lock marks
only `unrs-resolver@1.12.2` with an install hook (`postinstall`). That hook was
denied. The exact hook delegates to `napi-postinstall@0.3.4`; if permitted,
that helper can spawn a nested package-manager install or download/extract a
native binding outside the reviewed immutable install. The supported-platform
optional binding resolved and lint/build passed without the hook. Never
allow-list or execute it merely to make a build pass, and retain this as an
explicit x64 Linux release-runner stop condition. The selected production
`@unrs/resolver-binding-linux-x64-gnu@1.12.2` tarball was separately verified;
its stripped ELF `.node` binary has SHA-256
`13bd18708eaf0f050f2d86732ed29ce8cdbc7f1ee81263c10790b5c90a46d28b`.

## Remaining controls and stop conditions

1. Keep this change as a dependency-only review unit. Do not combine it with
   production authority, deployment, hosting, DNS, or MetaMask appeal changes.
2. Repeat immutable install, audit, signature verification, lint, tests, and
   build on the protected x64 Linux runner. Stop on any lock digest change,
   advisory, signature failure, lifecycle execution, test failure, or output
   mismatch.
3. Do not expose wallet keys, SSH agents, cloud metadata, registry tokens,
   hosting credentials, or production secrets during installation or build.
4. Exclude development tooling, npm caches, `.npmrc`, source-control metadata,
   and secrets from runtime artifacts. Generate and retain the release SBOM and
   build attestation in the production evidence package.
5. Preserve the preceding contract `js-yaml@4.3.1` remediation as its own
   review unit. Its fresh immutable audit is zero; this application review does
   not alter the contract lock.
6. Public deployment remains blocked on the independent production authority,
   control-plane recovery, attested x64 build, served-artifact parity, and
   production evidence gates documented elsewhere.

No security policy setting was relaxed, no release-age exclusion was added,
no automatic audit fix was used, no unreviewed package was executed, and no
credential or wallet key was available to dependency installation.
