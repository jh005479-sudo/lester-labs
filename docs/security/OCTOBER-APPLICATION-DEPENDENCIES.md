# October 2026 application dependency remediation

## Targeted replacement

- Next.js and eslint-config-next: `16.3.0` → `16.3.8`, the patched release in the existing minor line.
- sharp: `0.35.3` → `0.35.5`, including matching image-processing binaries/libvips.
- js-yaml: `4.3.1` → `4.3.2`.
- source-map-js: `1.2.1` → `1.2.2`.
- brace-expansion: `1.1.18` → `1.1.21` for minimatch 3, and `5.0.9` → `5.0.12` for minimatch 10. Parent-scoped exact overrides preserve the distinct API generations.

No forced audit fix, Next.js major/minor migration, ESLint downgrade or advisory suppression was used. Existing exact pins and overrides remain unless listed above. Lock regeneration also selected fastq `1.20.3` and Next's required @swc/helpers `0.5.23`.

Registry publication timestamps and integrity were checked for all 45 changed package/version pairs, including optional architecture binaries. Every selection was older than seven days. Dependency lifecycle scripts stayed disabled. A `prepare` script declared by brace-expansion was not executed. npm immutable installation checks tarball integrity; installed-package registry signatures and attestations were verified separately.

## Actual local verification

Using Node `24.22.1` / npm `11.19.1` on ARM64:

- Immutable `npm ci --ignore-scripts`: passed.
- Application unit tests: 283 passed, zero failed.
- ESLint: passed (existing warnings remain).
- Next.js production compilation: passed with the release-build-ID environment set. This was a local candidate build, not signed clean-tree production evidence.
- Registry signatures: 552 packages verified; 107 attestations verified.
- Production-only `npm audit --omit=dev`: zero vulnerabilities at every severity.
- Full application audit: five high-severity package records remain, all from the single unpatched braces advisory propagated through the development-only lint dependency chain.

## Unresolved upstream development-tool advisory

`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion in recursive brace-pattern AST walkers. The GitHub advisory has no first patched version and npm's latest braces remains `3.0.3`, which is affected. Registry inspection confirmed Next ESLint plugin `16.3.8`, `16.4.1` and `16.4.2` still depend on fast-glob `3.3.1`. Upgrading to those releases would not remove this path. npm's proposed Next ESLint downgrade to `14.2.35` is breaking and was not applied.

This is not a claim of remote exploitation in the production application. Production-only dependency audit is clean, but the full development graph is not. Required audit checks remain fail-closed. Do not claim all vulnerabilities are resolved, merge through failing required checks, or deploy this work as fully approved. An upstream fix, a separately reviewed replacement of the affected lint tooling, or an explicit narrowly scoped risk-acceptance decision remains necessary.

## Evidence

Detailed local logs and registry metadata are under `.git/remediation/`: `app-updated-audit.json`, `app-updated-production-audit.log`, `app-updated-results.json`, `app-package-review.json`, `app-dependency-changes.json`, and matching unit/lint/build/signature logs. These local paths are not production attestations. Package metadata evidence is also checked in as `OCTOBER-APPLICATION-PACKAGES.json`.
