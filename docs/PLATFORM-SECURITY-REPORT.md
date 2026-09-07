# Implementation security report — 7 September 2026

No third-party dependencies were added, removed, or updated.

- **Versions / release age:** all dependency and package-manager pins remain unchanged.
  No new release was selected, so no seven-day hold exception was needed.
- **Lifecycle scripts:** the existing lockfiles flag `unrs-resolver@1.12.2`
  (application), `esbuild@0.28.1`, and `fsevents@2.3.3` (contracts).
  No dependency install or lifecycle scripts were executed. Existing installed
  build and test tools were used locally; no local install, `npx`, or `dlx` was run.
  Protected CI installed application and contract dependencies with `npm ci --ignore-scripts`.
- **Lockfiles:** unchanged. `.npmrc`, exact dependency pins, and runtime pins are unchanged.
- **Registry verification:** application `npm audit signatures` verified registry
  signatures for 549 packages and attestations for 105 packages.
- **CI:** added an application browser-journey step to `security-ci.yml` and
  `test:browser` to package scripts. No new GitHub Action or mutable action ref.
  Policy verification checks 106 existing immutable Action invocations and 37
  direct dependency pins across application/contracts. Review the workflow under
  the existing CODEOWNERS/protected-branch process.
- **Application controls:** writes retain chain/account, target, runtime,
  provenance and role checks. New simulation runs inside those guards. Archive
  data never grants write authority. Public verification checks live contract
  code and lock state. Metrics is off by default, bounded, schema-validated,
  same-origin, and forwarded only to an explicitly configured server-side sink.
  Setup return links select only known internal pages. The browser runner uses
  private process pipes and passes values as protocol arguments, not generated code.
- **Checks:** build/types, 282 unit tests, ten browser journeys, secret scanning,
  package policy, and public replacement manifest pass locally. ESLint: zero errors, 59 warnings.
  Existing warnings remain, largely legacy React effect/typing warnings.

## Audit findings: release remains blocked

The unchanged application lockfile reports **one high and one moderate advisory**.
No advisory has been suppressed, no exploit has been reproduced, and no exception
is approved. A separate dependency update must perform the full review and obtain
any required approval before changing the lockfile.

PR #93's protected CI verified the exact runtime pins and immutable installs, then
failed at the application vulnerability audit. Its later signature, test, and build
steps were skipped. The local signature and test results above are separate evidence.

| Installed dependency and path | Advisory | Candidate patch for separate review |
| --- | --- | --- |
| `nanoid@3.3.17`, through `postcss@8.5.23` from `next@16.3.0` and `@tailwindcss/postcss@4.2.1` | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), high | `3.3.18`, published 7 August 2026; more than seven days old |
| `@humanfs/node@0.16.7`, through `eslint@9.39.4` | [GHSA-p498-v437-472g](https://github.com/advisories/GHSA-p498-v437-472g), moderate | `0.16.8`, published 17 April 2026; more than seven days old |

Static inspection found PostCSS using a fixed `nanoid(6)` call, rather than the
custom-generator path described by the advisory. No affected application call
site was found in this review. This limited observation is not a waiver or proof
of safety. The humanfs advisory affects recursive copying; the dependency is
used by development tooling that runs in CI. Keep untrusted build inputs and
credentials isolated. Both candidate patch versions still need complete package,
tarball, transitive-tree, lifecycle, ownership, and test review.

## Remaining operational reviews

- Complete protected CI with the repository's exact Node 24.18.0 / npm 11.16.0 pins.
  Local checks used installed Node 24.19.0 / npm 11.18.0; no pins were changed.
- Re-audit and verify signatures for release, including contract dependencies;
  this feature change does not modify contracts or their dependency graph.
- Validate wallet rejection, chain/account changes during preflight, and real
  testnet confirmation using a disposable test wallet before production promotion.
  Automated tests do not claim to cover an actual wallet extension prompt.
- Configure a private persistent metrics host or compatible managed endpoint,
  HTTPS, proxy rate limits, retention-compatible backups, and least privilege
  before enabling usage sharing. Do not place SQLite on Vercel's ephemeral disk.
- Archive history may be incomplete. No complete independently verified index is
  claimed; current certificate and transaction checks still depend on RPC availability.
- Review the runner's installed Chromium as part of runner-image management.
  The test script installs nothing and uses an isolated profile without wallet extensions.

No security rule was silently relaxed. Production release controls remain in force.
