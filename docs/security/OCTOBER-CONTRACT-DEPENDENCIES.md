# October 2026 contract dependency remediation

Verified on 2026-10-21 using Node v24.22.1 (Linux ARM64) and npm 11.19.1. This report covers only the separate `contracts/` dependency tree; it does not attest the frontend, production deployment, or contract security.

## Exact changes and publication-age gate

| Package | Previous lock version | Exact replacement | Registry publication (UTC) | Age at check |
|---|---|---|---|---|
| adm-zip | 0.6.0 | 0.6.1 | 2026-09-11 10:24:22.219 | 40.45 days |
| brace-expansion | 2.1.4 | 2.1.7 | 2026-09-14 22:02:58.810 | 36.97 days |
| js-yaml | 4.3.1 | 4.3.2 | 2026-08-26 20:42:48.747 | 56.02 days |
| undici | 6.28.0 | 6.28.1 | 2026-09-04 14:23:45.648 | 47.28 days |

All four releases exceed seven days; no dependency release-age exception is required. Publication timestamps were retrieved directly from the npm registry, not inferred from dist-tags.

The existing adm-zip and brace-expansion overrides were advanced within their existing version lines. The existing global brace-expansion override was retained rather than introducing an unrelated major-version migration. New exact overrides pin `js-yaml` to `4.3.2` and `undici` to `6.28.1`; these are the only major lines present in the lock. Unqualified keys preserve compatibility with the existing root package-policy verifier. The glob 13.0.6 and serialize-javascript 7.0.5 overrides and all direct dependencies remain unchanged. Only four lock entries changed: their versions, resolved tarball URLs and integrity values.

Dependency paths include Hardhat → adm-zip, minimatch → brace-expansion, Mocha → js-yaml, and @nomicfoundation/hardhat-utils → undici. The prior audit recorded six affected package records (five high, one moderate), including propagated Hardhat/minimatch findings. The replacement versions address the exact advisory ranges in that audit; no force fix or broad upgrade was used.

## Verification

Commands ran from `contracts/`, with the patched runtime directory first on PATH:

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm audit --audit-level=info --json
npm audit signatures
# DEPLOYER_PRIVATE_KEY unset; REPLACEMENT_CREDENTIAL_FREE_BUILD=true
npm run compile
npm test
```

All commands exited 0.

- Lock regeneration and clean installation reported zero vulnerabilities; clean install added 139 packages.
- The explicit all-severity audit returned zero info, low, moderate, high and critical vulnerabilities.
- Signature audit: **139 packages have verified registry signatures; 52 packages have verified attestations**. These counts cover installed packages on this platform, not every optional package for other operating systems.
- Independently downloaded all four changed registry tarballs and verified SHA-512 against both their registry metadata and lockfile integrity fields.
- `npm run compile`: compiled 6 Solidity files with solc 0.5.16, 4 with 0.6.6 and 23 with 0.8.24. Existing cached compilers were available; no installer command was invoked. Compilation emitted SPDX and function-mutability warnings but no errors.
- `npm test`: **50 passing (2s)**, final summary **50 passing (50 mocha)**. Tests use local simulated Hardhat networks; no public-chain deployment, transaction, signer or live-network script was invoked.
- `.npmrc` guards are unchanged: `ignore-scripts=true`, `min-release-age=7`, exact saves, lockfiles, audit and strict peer dependencies. Explicit npm test/compile execution does not enable dependency lifecycle hooks; pre/post hooks remain suppressed.
- Scoped `git diff --check` passed. No source, deployment plan, attestation sentinel or credential file was changed.

## Evidence and limitations

Local, uncommitted command output and registry evidence are retained under `.git/remediation/contracts-october/`: `lock.log`, `ci.log`, `audit-after.json`, `audit-after.stderr`, `signatures.log`, `compile.log`, `test.log`, `compile-help.log`, the four `*-registry.json` records, `integrity-verification.json`, and `package-lock.before.json`. The baseline is `.git/remediation/audit-current-contracts.json`.

No dependency remediation blocker remains. A probe for user/network namespace isolation was denied by the host, so compilation/testing must not be described as OS-network-isolated or as a production build attestation. Credential-free local compilation and simulated tests are regression evidence only. Existing production deployment and independent-review gates remain in force. No commit, push, deployment, root-app dependency change, or Git index mutation was performed by this remediation.
