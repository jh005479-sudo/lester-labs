# Humanfs dependency review — 8 September 2026

Decision: accept the exact related-package patch set below, subject to protected
CI. The user authorized reviewing the blocking dependencies and merging the
reviewed fixes. No advisory suppression or security exception is requested.

## Scope, necessity, and alternatives

`eslint@9.39.4` reaches the affected `@humanfs/node@0.16.7` filesystem adapter.
Update it to `0.16.8`, its required `@humanfs/core` from `0.19.1` to `0.19.2`, and
add the required transitive `@humanfs/types@0.15.0`. Exact overrides constrain all
three selections. The types package supplies interfaces referenced by the two
existing packages' exported declarations; it is not a new runtime feature.

No direct dependency changes. npm generated changes to exactly three lock nodes:
two version updates and one new development-only types node. The complete lock
grows from 634 to 635 package nodes. `@humanwhocodes/retry@0.4.3` and every other
selection remain unchanged, including the separately reviewed NanoID patch.
No lockfile integrity was edited manually.

Retaining the old adapter leaves a known advisory. Replacing ESLint's internal
filesystem layer or copying its interfaces into this application would require a
fork and a larger maintenance burden. Updating ESLint itself would alter more of
the graph than this compatible patch set. The small required types package is
accepted rather than weakening resolution or relying on missing declarations.

## Exact package review

| Package | Change | Published UTC / age at review | Unpacked bytes / files | Immediate / unique transitive dependency count |
| --- | --- | --- | --- | --- |
| `@humanfs/node@0.16.8` | From `0.16.7` | 2026-04-17 20:51:26.959; over 143 days | 44,472 / 8 (was 44,140 / 8) | 3 / 3: core, types, unchanged retry |
| `@humanfs/core@0.19.2` | From `0.19.1` | 2026-04-17 20:51:11.882; over 143 days | 72,759 / 12 (was 72,735 / 12) | 1 / 1: types |
| `@humanfs/types@0.15.0` | New transitive development dependency | 2024-09-09 19:44:08.000; over 728 days | 15,241 / 5 | 0 / 0 |

All three packages use the official `https://registry.npmjs.org/` source and the
`https://github.com/humanwhocodes/humanfs` repository. Nicholas C. Zakas (`nzakas`)
is the publisher and maintainer in the old and selected metadata. The repository
is active and not archived. No ownership transfer was found in the compared
registry and repository evidence; this does not establish a complete private
account history. All selected packages are Apache-2.0 licensed; neither existing
package changes license.

Node/core identify source commit
`f57df9bf460ccfedd2df4e48f72b215e0145f69f`; types identifies
`85069f193cbacc371c3beb649ce746f8c5a493be`. The changed Node implementation matches
its pinned upstream source byte-for-byte. GitHub reports the Node/core source
commit as unsigned. These releases publish no SLSA provenance attestation, which
is explicitly retained as a limitation, not represented as a verification pass.
Their official registry signatures do verify, with key validity assessed at
publication using npm's verification rule. The 2024 types signature predates the
registry key's 2025 expiry; full `npm audit signatures` remains required.

Old and selected tarballs were downloaded and inspected without executing their
contents. Every SHA-1 and SHA-512 matches the corresponding registry metadata,
and every registry ECDSA signature verifies. Archives contain no absolute or
traversal paths, links, or native binaries. Exact SHA-512 selections:

- Node: `gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==`
- Core: `UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==`
- Types: `ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==`

## Changes, capabilities, and lifecycle handling

The Node patch preserves symbolic links during individual and recursive copies
instead of dereferencing their contents. The remainder of its implementation is
unchanged. Core changes only its package manifest to expose its type dependency;
its runtime source is identical. The entire new types source contains interfaces
and comments, with no executable JavaScript or runtime export.

The existing adapter reads/writes/copies/deletes caller-specified filesystem paths
through Node's filesystem API. Core delegates to the supplied implementation.
No network, credential collection, environment-reading, process spawning, custom
cryptography, or native compilation is introduced. Filesystem privileges still
belong to the calling process; this patch is not a general filesystem sandbox.
Builds must continue to isolate credentials and untrusted inputs.

All three manifests declare `prepare: npm run build`, which invokes TypeScript's
`tsc`; Node/core also retain `pretest: npm run build`. These hooks were inspected
as metadata and **not executed**. Node/core already ship usable JavaScript and
declarations, and types exports its checked-in interface source, so installation
does not require compilation. There is no preinstall/install/postinstall hook in
this selected group. `ignore-scripts=true` remains in force with no allow-list or
exception. Existing lock flags for `unrs-resolver@1.12.2`, `esbuild@0.28.1`, and
optional `fsevents@2.3.3` remain unchanged and denied.

The [upstream advisory](https://github.com/advisories/GHSA-p498-v437-472g)
identifies `0.16.8` as patched. The [release record](https://github.com/humanwhocodes/humanfs/releases/tag/node-v0.16.8)
also records the related type-dependency change. No exploit was reproduced.

## Validation and remaining controls

Resolution retains Node `24.18.0`, npm `11.16.0`, the seven-day hold, exact pins,
strict peers, official registry, and script denial. Installs use a disposable
worktree, fresh HOME/cache, and empty inherited environment without wallet,
hosting, registry, or SSH-agent credentials. The Node distribution checksum and
pin verification are recorded in `NANOID-3.3.18-REVIEW.md`.

Local immutable install passed with 550 packages and no lifecycle execution.
The lock SHA-256 remained
`fbcdde38c1c1c563c82fba4b059da16334426517e9c3c62b5a70d074f70ab655`.
The application audit reports zero vulnerabilities at every severity. The
unchanged contract graph also reports zero vulnerabilities. Application registry
verification passed for 550 signatures and 105 attestations; the humanfs packages
have signatures but no attestations, as disclosed above. The complete dependency
tree has no missing or invalid peers. The production build and TypeScript passed;
all 266 baseline unit tests passed, and lint has zero errors and 93 existing
warnings. Protected CI must pass on the exact PR revision; the platform feature
PR receives another run after integration.

No CI workflow, GitHub Action, contract dependency, or application feature changes
in this dependency PR. Registry signatures cannot rule out publisher compromise,
and zero advisories do not establish absence of unknown defects. Missing upstream
provenance remains documented. No security rule was relaxed, no release-age
exception was used, and no dependency lifecycle script was executed.
