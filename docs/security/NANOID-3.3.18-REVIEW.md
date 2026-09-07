# NanoID dependency review — 8 September 2026

Decision: accept the exact `nanoid@3.3.18` patch, subject to protected CI.
The user authorized reviewing the blocking dependencies and merging the reviewed
fixes. This is a dedicated dependency change; no advisory suppression or security
exception is requested.

## Scope and necessity

Update transitive `nanoid@3.3.17` to `3.3.18` with an exact root override. The only
lock node changed is `node_modules/nanoid`; npm generated its version, registry URL,
and integrity fields. No lock integrity was edited manually. No direct dependency
was added, removed, or upgraded; all other dependency selections are unchanged.

The package supplies IDs to `postcss@8.5.23`, reached through `next@16.3.0` and
`@tailwindcss/postcss@4.2.1`. Replacing PostCSS's internal dependency with a custom
implementation would require maintaining a fork. Updating the existing leaf
package is smaller than a framework upgrade and preserves the parent's compatible
range. No new library is needed.

## Exact package and publication

| Item | Reviewed evidence |
| --- | --- |
| Package / version | `nanoid@3.3.18` |
| Previous version | `3.3.17` |
| Published | 2026-08-07 16:41:05.696 UTC; over 31 days old at review |
| Source | Official `https://registry.npmjs.org/` registry |
| Repository | `https://github.com/ai/nanoid` |
| Source commit | `9ad98052b316c5e707f8098ace509d2ae165e54d`; GitHub reports a verified signature |
| Maintainer / publisher | Andrey Sitnik (`ai`); GitHub Actions trusted publishing, same owner and publisher configuration as `3.3.17` |
| License | MIT, unchanged |
| Unpacked size / entries | 25,198 bytes / 25 files; previous version 25,046 bytes / 25 files |
| Immediate / transitive dependencies | 0 / 0; unchanged |
| Lifecycle scripts | None in either published package |
| Native compilation / binaries | None; the existing CLI is JavaScript |
| Registry signature | SHA-256/ECDSA signature verified with the official npm key, valid at publication |
| Provenance | Registry provides a SLSA v1 attestation from the existing GitHub Actions publication workflow; full verification is included in `npm audit signatures` |
| Tarball integrity | Downloaded old and new tarballs; SHA-1 and SHA-512 match their exact registry metadata |

The selected SHA-512 is
`DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==`.
Archives contain no traversal paths, absolute paths, links, or unexpected binary
entries. The repository is active and not archived; no ownership change was found
in the compared package metadata. Historical ownership visibility is limited to
the public repository and registry evidence reviewed here.

## Code and capability assessment

The full tarball diff changes only the package version, a README link, and the
React Native asynchronous custom-alphabet implementation's default and nonpositive
size handling. The changed source matches the pinned upstream source apart from
removed comments. The standard Node and browser implementations are unchanged.

The library obtains random bytes from Node crypto or browser Web Crypto. Its
existing React Native-specific adapter imports `expo-random`; that platform path
and package are not added to this application's graph. No network, filesystem,
credential, environment-reading, or subprocess capability is introduced. The
existing CLI reads arguments and writes results to the terminal; it is not invoked
by this review. No custom cryptography or exploit reproduction was introduced.

The [upstream advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8)
identifies `3.3.18` as patched. The installed PostCSS path calls the normal
`nanoid(6)` API, but this observation is not used to waive or suppress the advisory.
See the [upstream release](https://github.com/ai/nanoid/releases/tag/3.3.18).

## Validation and remaining work

Resolution used Node `24.18.0` and its bundled npm `11.16.0`, matching repository
pins. The official Node distribution's SHA-256 matched `SHASUMS256.txt`:
`e1a97e14c99c803e96c7339403282ea05a499c32f8d83defe9ef5ec66f979ed1`.
The package manager recognizes and retains `min-release-age=7`.
Resolution and installation use a disposable worktree, fresh HOME/cache, and an
empty inherited environment, without wallet, hosting, registry, or SSH-agent
credentials. Dependency lifecycle scripts remain disabled.

Local immutable install passed with 549 packages and no lifecycle execution.
The lock SHA-256 stayed
`ab514bec394463a88ce6c8857afd448e3295ef99fc5e318f94ebd9c3a16e8e4b`.
The production build and TypeScript passed; all 266 tests on the dependency PR's
main-branch baseline passed. Lint reported zero errors and 93 existing warnings.
`npm audit signatures` verified 549 registry signatures and 105 attestations.
`npm audit` now reports zero high/critical findings and one existing moderate
`@humanfs/node@0.16.7` finding, tracked in its own related-package review.
Protected CI must pass on the exact PR revision; this patch removes the high
finding only. The platform feature PR receives a separate test run after integration.

No CI workflow or GitHub Action is changed. `.npmrc`, runtime pins, and contract
dependencies remain unchanged. Signatures and audits do not prove absence of
unknown defects. No security rule was relaxed, no seven-day exception was used,
and no dependency lifecycle script was executed.
