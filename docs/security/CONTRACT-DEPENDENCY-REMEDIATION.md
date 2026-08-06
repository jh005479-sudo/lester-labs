# Contract Dependency Remediation Review

Date: 2026-08-06

Scope: the final Hardhat 3 contract-tooling migration in `contracts/package.json` and `contracts/package-lock.json`

Decision: **accept the exact reviewed graph for contract compilation and testing, subject to the controls and limitations below.** No seven-day release-age exception was requested or used.

This is a dependency-review record, not deployment evidence and not a claim that package signatures, provenance attestations, or a zero-advisory result make third-party code benign. The deployment key was not accessed during this review.

## Final immutable evidence

| Check | Reviewed result |
| --- | --- |
| Package manager | `npm@11.16.0`, exactly pinned in `packageManager` |
| Contract lock SHA-256 | `c537da287ce1b7b0cf1380625690132a1b5509cd243237b6d3453ee28a3bc2ae` |
| Lock shape | lockfile v3; 166 package nodes plus the root package; 2 runtime and 14 development direct declarations |
| Sources | Every locked package with a `resolved` field uses `https://registry.npmjs.org/` and has an integrity digest; no Git, local-path, arbitrary-tarball, or alternate-registry dependency is selected |
| Vulnerability audit | `npm audit` completed with exit 0 and `0` vulnerabilities at every severity |
| Registry verification | `npm audit signatures` completed with exit 0: 141 package signatures verified and 52 registry attestations verified |
| Install-script declarations | Only `esbuild@0.28.1` and optional `fsevents@2.3.3` are marked `hasInstallScript` in the final lock |
| Script execution | No dependency lifecycle script was executed; installation and verification used lifecycle scripts disabled |

The registry verification counts are graph-wide aggregates. The tables below separately record whether each reviewed version's cached registry metadata exposes a signature and a SLSA provenance-attestation pointer; that is not a substitute for the successful graph-wide verification command.

## Manifest change and dependency cost

The migration removes direct `@nomicfoundation/hardhat-toolbox@6.1.2` and `ts-node@10.9.2`, replaces the locked `hardhat@2.28.6` line with `hardhat@3.11.1`, and makes the Hardhat 3 integrations explicit. Nine packages become new direct declarations. Some were formerly present indirectly through Toolbox or peer resolution; "new" here means newly declared and security-owned by this project.

Immediate dependency counts come from each selected lock node. Closure counts are unique resolved `dependencies` and present `optionalDependencies`, excluding the named package itself and excluding peer-only declarations. They are shared and deduplicated, so they must not be added together. The complete lock contains 166 package nodes.

| Package | Change | Purpose and necessity | Immediate / unique closure | Alternative considered | Decision |
| --- | --- | --- | ---: | --- | --- |
| `@nomicfoundation/hardhat-ethers@4.0.15` | New direct | Official Ethers 6 integration used by contract tests and deployment/verification scripts. Hardhat 3 no longer receives it through Toolbox. | 6 / 27 | Hand-written provider adapters would duplicate security-sensitive ABI, signer, and network integration. | Accept exact version. |
| `@nomicfoundation/hardhat-ethers-chai-matchers@3.0.11` | New direct | Supplies Ethereum-aware assertions required by the migrated test suite. | 4 / 22 | Replace all matchers with manual receipt/log/revert decoding; larger custom test surface. | Accept exact version. |
| `@nomicfoundation/hardhat-mocha@3.0.21` | New direct | Explicit Hardhat 3 adapter for the repository's Mocha tests. | 5 / 47 | Rewrite the suite for `node:test`; a material, unrelated test migration. | Accept exact version. |
| `@nomicfoundation/hardhat-network-helpers@3.0.11` | New direct | Provides deterministic snapshots, fixtures, time, balance, and local-network helpers used by tests. | 2 / 16 | Reimplement JSON-RPC test helpers internally; avoidable state-control code. | Accept exact version. |
| `@types/chai@5.2.3` | New direct | TypeScript declarations for the directly selected assertion library. | 2 / 2 | Maintain local ambient declarations; fragile and unnecessary. | Accept exact version. |
| `@types/mocha@10.0.10` | New direct | TypeScript declarations for Mocha globals and test APIs. | 0 / 0 | Maintain local ambient declarations; fragile and unnecessary. | Accept exact version. |
| `chai@6.2.2` | New direct | Assertion runtime selected explicitly instead of relying on Toolbox/peer hoisting. | 0 / 0 | Node assertions plus a full test rewrite. | Accept exact version. |
| `ethers@6.17.0` | New direct | ABI encoding, contract calls, RPC access, and transaction signing used by tests and operational scripts. Direct declaration prevents undeclared peer reliance. | 7 / 8 | Custom Ethereum RPC/signing code or a second Web3 stack; both increase risk and migration scope. | Accept exact version; treat as key-sensitive at runtime. |
| `mocha@11.3.0` | New direct | Test runner required by the explicit Hardhat Mocha adapter. | 20 / 57 | `node:test`; requires a separate test conversion. | Accept exact version. |
| `hardhat@3.11.1` | Updated from locked `2.28.6` | Compiler/task/network orchestrator. Hardhat 3 removes the vulnerable legacy tooling graph and supports the explicit plugin model. | 18 / 81 | Retain Hardhat 2 (rejected because its resolved graph carried known vulnerabilities), or migrate to Foundry (larger toolchain rewrite). | Accept exact version. |

The remaining direct declarations were not newly introduced: `@openzeppelin/contracts@5.1.0`, `@types/node@25.5.0`, `dotenv@17.3.1`, `typescript@5.9.3`, `@uniswap/v2-core@1.0.1`, and `@uniswap/v2-periphery@1.1.0-beta.0`. Loose ranges on the latter five previously ranged entries were replaced with the already selected exact versions; `@openzeppelin/contracts` was already exact. No version change was introduced for those six packages.

## Exact-version registry review

Publication dates, unpacked sizes, file counts, repositories, publishers, and per-version signature/attestation fields below were read from the pre-existing cached npm registry packuments for the exact versions. No network request was made for this document. All tarballs resolve from the official npm registry in the lock.

`Sig` is the number of registry signature records in cached version metadata. `Prov` means the version metadata includes a SLSA provenance v1 attestation pointer. An absent pointer is recorded as unavailable rather than inferred.

| Exact package | Published UTC | Seven-day status on 2026-08-06 | Licence | Unpacked bytes / files | Publisher or maintainer | Sig / Prov | Repository |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| `@nomicfoundation/hardhat-ethers@4.0.15` | 2026-07-16 17:15:45 | Eligible | MIT | 297,520 / 74 | Nomic Foundation; cached per-version maintainer array empty | 1 / Yes | `github.com/NomicFoundation/hardhat`, `packages/hardhat-ethers` |
| `@nomicfoundation/hardhat-ethers-chai-matchers@3.0.11` | 2026-07-02 15:50:48 | Eligible | MIT | 336,300 / 179 | Nomic Foundation; cached per-version maintainer array empty | 1 / Yes | `github.com/NomicFoundation/hardhat`, `packages/hardhat-ethers-chai-matchers` |
| `@nomicfoundation/hardhat-mocha@3.0.21` | 2026-06-04 15:44:10 | Eligible | MIT | 71,519 / 44 | Nomic Foundation; cached per-version maintainer array empty | 1 / Yes | `github.com/NomicFoundation/hardhat`, `packages/hardhat-mocha` |
| `@nomicfoundation/hardhat-network-helpers@3.0.11` | 2026-07-02 15:50:35 | Eligible | MIT | 171,103 / 164 | Nomic Foundation; cached per-version maintainer array empty | 1 / Yes | `github.com/NomicFoundation/hardhat`, `packages/hardhat-network-helpers` |
| `@types/chai@5.2.3` | 2025-10-20 23:32:43 | Eligible | MIT | 92,011 / 6 | DefinitelyTyped `types` publisher | 1 / No pointer | `github.com/DefinitelyTyped/DefinitelyTyped`, `types/chai` |
| `@types/mocha@10.0.10` | 2024-11-20 18:38:25 | Eligible | MIT | 96,109 / 5 | DefinitelyTyped `types` publisher | 1 / No pointer | `github.com/DefinitelyTyped/DefinitelyTyped`, `types/mocha` |
| `chai@6.2.2` | 2025-12-22 21:26:03 | Eligible | MIT | 146,636 / 7 | `chaijs`; manifest author Jake Luer | 1 / Yes | `github.com/chaijs/chai` |
| `ethers@6.17.0` | 2026-06-18 04:48:27 | Eligible | MIT | 13,035,887 / 1,301 | `ricmoo`; manifest author Richard Moore | 1 / No pointer | `github.com/ethers-io/ethers.js` |
| `hardhat@3.11.1` | 2026-07-23 16:25:44 | Eligible | MIT | 4,116,337 / 1,457 | `alcuadrado`; manifest author Nomic Foundation | 1 / Yes | `github.com/NomicFoundation/hardhat`, `packages/hardhat` |
| `mocha@11.3.0` | 2025-05-16 14:01:41 | Eligible | MIT | 2,139,641 / 69 | `voxpelli`, `joshuakgoldberg`, `uzlopak`; Mocha project | 1 / Yes | `github.com/mochajs/mocha` |

All ten selected direct-package releases above were more than seven days old on 2026-08-06. No release-age exception or `min-release-age-exclude` was used.

### Capability, native-code, and maintenance assessment

- Hardhat and its four Nomic plugins execute repository code, read and write build files, load compiler binaries, and can reach configured RPC endpoints. Hardhat may otherwise fetch missing compilers. The release runner must therefore use the reviewed pre-populated compiler cache, disable outbound network access for the reproducible build, and expose no wallet or deployment credential during dependency installation, compilation, or tests. Coordinated Nomic ownership reduces integration ambiguity but concentrates trust in one organization and monorepo.
- `ethers` can construct, sign, and broadcast transactions when a caller gives it an RPC endpoint and signer. This capability is necessary for the deployment scripts and makes the package security-sensitive. The deployer key must be injected only after the immutable dependency/build attestation gate; it must never be present during installation. The package has a large published surface and a maintainer-concentration risk around its principal publisher.
- Mocha executes arbitrary test modules, and the Hardhat Mocha adapter inherits that execution surface. Chai and its matchers evaluate assertions over attacker-controllable test values. These packages must be restricted to development/build environments and excluded from production runtime artifacts.
- The two `@types/*` packages are declaration-only and have no runtime, native binary, or install-hook requirement. Their centralized DefinitelyTyped publication path is a trust dependency, mitigated here by exact versions, integrity, signatures, and immutable installation.
- None of the ten reviewed direct package nodes declares `preinstall`, `install`, or `postinstall`; none declares OS/CPU restrictions or `gypfile`. `mocha@11.3.0` contains a publisher-side `prepublishOnly` script, but it is not an install hook and was not run.
- The final transitive graph includes `esbuild@0.28.1`, whose install hook normally validates/selects its platform binary, and optional macOS-only `fsevents@2.3.3`, whose install hook relates to its native module. They are the only lock nodes marked with install scripts. Neither hook was executed. The clean x64 Linux build must retain `ignore-scripts=true` and `npm ci --ignore-scripts`; do not approve either hook merely to make a build pass.

## Exact transitive overrides

The four overrides are not new direct dependencies. They force reviewed remedial versions on transitive paths and are intentionally exact. Closure counts use the same non-peer method described above.

| Override | Published UTC | Seven-day status | Licence | Unpacked bytes / files | Immediate / closure | Publisher or maintainer | Sig / Prov | Purpose, concern, alternative, decision |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| `adm-zip@0.6.0` | 2026-07-10 20:08:24 | Eligible | MIT | 140,065 / 20 | 0 / 0 | `cthackers` | 1 / No pointer | Exact archive-handler remediation selected by the zero-advisory final graph. Archive parsers are path/size-sensitive; do not expose it to untrusted archives. Waiting for upstream convergence was considered but would retain the affected resolution. **Accept.** |
| `brace-expansion@2.1.4` | 2026-07-30 10:15:01 | Eligible from 2026-08-06 10:15:01 UTC | MIT | 16,892 / 5 | 1 / 1 | `juliangruber`, `isaacs` | 2 / No pointer | Exact string-expansion remediation. Expansion of untrusted patterns can amplify CPU/memory use; tooling inputs remain trusted and bounded. This was the youngest selection and was not accepted before its full hold elapsed. **Accept after hold; no exception.** |
| `glob@13.0.6` | 2026-02-19 17:26:33 | Eligible | BlueOak-1.0.0 | 1,607,230 / 65 | 3 / 6 | `isaacs` | 1 / No pointer | Removes the remaining vulnerable glob line from the resolved tooling graph. Glob traverses the filesystem and must receive trusted, bounded patterns. Upstream-only resolution was insufficient for the final audit. **Accept exact override.** |
| `serialize-javascript@7.0.5` | 2026-03-25 14:24:36 | Eligible | BSD-3-Clause | 19,174 / 4 | 0 / 0 | `okuryu`, `ericf`, `redonkulus`; Yahoo repository | 1 / Yes | Exact serializer remediation. It emits JavaScript source and must never serialize untrusted data into executable/HTML contexts. Removing the test-tool path was more disruptive than the reviewed exact override. **Accept for tooling only.** |

No override node declares `preinstall`, `install`, or `postinstall`, OS/CPU restrictions, a native build, or `gypfile`. The published `glob@13.0.6` manifest contains `prepare` and `prepublishOnly` release-maintenance scripts. They were not executed; installs remain registry-tarball, immutable, and script-disabled. Overrides can violate assumptions made by their parents even when semver-compatible, so compile, typecheck, the full contract suite, and audit/signature checks must remain required. Remove an override only in a dedicated dependency review after its upstream path selects an equally reviewed safe exact version.

## Vulnerability and provenance decision

The final resolved graph has no applicable known advisory according to the recorded `npm audit` result. This covers all packages in the tables in their actual resolved paths; npm did not produce a package-specific unresolved advisory for any selected exact version. It does not establish absence of unknown vulnerabilities, malicious maintainer behavior, compromised publication credentials, unsafe application use, or future advisories.

The recorded signature and attestation checks establish registry-publication evidence for the resolved graph. They do not prove source-to-package equivalence or benign code. Packages without a cached per-version attestation pointer are explicitly marked `No pointer`; no provenance claim is inferred for them. The release runner must repeat `npm audit` and `npm audit signatures` against this exact lock, preserve the outputs by digest, and stop on any changed registry result.

## Required controls and remaining risks

1. Land the manifest and lock migration as a dependency-only review unit. Do not combine future dependency updates with contract, frontend, or deployment behavior changes.
2. Enforce the committed `.npmrc`, including `min-release-age=7`, `ignore-scripts=true`, `save-exact=true`, lockfile use, audit, and strict peer dependency handling. Do not add a release-age exclusion for this graph.
3. Install only with the exact pinned package manager and `npm ci --ignore-scripts` on a fresh unprivileged x64 Linux runner. Never reuse workstation `node_modules` or caches as release inputs.
4. Keep registry/network access and all signing, wallet, SSH, cloud, hosting, and production credentials unavailable during install and build. Inject a permitted testnet deployer only after source, lock, dependency tree, compiler cache, and build artifact digests have been attested.
5. Re-run compile, typecheck, all contract tests, `npm audit`, and `npm audit signatures` on the release runner. A lock digest mismatch, lifecycle-script execution, new advisory, unverifiable signature, or build-output mismatch is a stop condition.
6. Exclude Hardhat, Mocha, Chai, TypeScript, and all other development tooling from any production runtime artifact. Treat RPC endpoints, compiler inputs, glob patterns, archives, and serialized values as security boundaries.
7. Monitor the Nomic, ethers, Mocha, DefinitelyTyped, `isaacs`, `cthackers`, and Yahoo publication paths for ownership or release-process changes. Exact pins and signatures limit mutation but do not remove publisher compromise risk.

No third-party dependency was installed while preparing this note. No dependency script was run, no network access was used, no lockfile was changed, and no dependency security rule was relaxed. The only repository change made for this review is this documentation file.
