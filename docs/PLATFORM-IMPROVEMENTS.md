# Platform improvements — 7 September 2026

Implemented on `codex/platform-workflows-ui`. This is a local implementation,
not a production deployment. Existing contract, wallet, provenance, and release
controls remain in force.

## The ten improvements

| Improvement | Delivered behavior | Limits / remaining setup |
| --- | --- | --- |
| Connected launch journey | `/projects` brings token creation, liquidity, presales, locks, vesting, and distribution together. Validated links carry the token forward; token, presale, and vesting drafts survive reloads. Confirmed creation receipts restore recent projects even after leaving the wizard. | Drafts and recent projects belong to this device. Other project steps remain optional. |
| Shared activity history | A bounded server gateway reuses the persistent LiteForge explorer archive, caches responses, deduplicates records, validates contract/topic/cursor identity, and exposes freshness and pagination. Market history uses the same gateway. | Explorer coverage may be incomplete. This is discovery data, not an independently maintained full-chain index or receipt proof. |
| Public verification and project pages | `/locker/verify` works without a wallet and binds a certificate to chain, locker, and ID. Contract code and lock state are checked at one block. Project pages show token and pool state, related lock/presale records, and device transaction progress. | Historical RPC failures remain visible. A certificate verifies the recorded lock, not project quality. |
| Clear navigation | Projects, Swap, Markets, Portfolio, Activity, and Docs have direct navigation. Analytics opens on network data; unavailable products sit under “What’s coming next?”. Copy describes active capabilities. | Governance activation is unchanged. |
| Guided setup | `/setup` guides wallet connection, LitVM network selection, and test-gas funding, then returns to a validated internal destination. Mobile wallet-browser guidance is included. | Uses the existing injected connector; no new wallet connector. A nonzero balance is not a guarantee of enough gas for every action. |
| Transaction centre | Local history tracks checking, wallet prompts, pending, confirmed, reverted, cancelled, and unknown outcomes. Reads reconcile receipts after reload. Identical unresolved submissions are blocked. Simulation runs after attestation and before the final fresh wallet-chain check. | No automatic resend. Missing RPC receipts remain unresolved; real wallet signing needs a controlled manual acceptance test. |
| Useful portfolio | Any valid address can be viewed without connecting. Recent locks and available vesting claims have next actions; upcoming locks offer calendar downloads. LP positions use same-block reads, integer ownership math, actual token decimals, and pagination. | Recent activity coverage is explicitly bounded. Legacy recovery remains accessible through existing tools. Reminders are calendar files, not a notification service. |
| Opt-in usage measurement | A strict address-free event schema and optional authenticated ingest endpoint measure tool starts, wallet connection, submissions, outcomes, and return visits. A dependency-free Node/SQLite service deduplicates, aggregates, excludes development events, and expires records after 30 days. | Disabled until durable storage is configured. See `METRICS-OPERATIONS.md`. These are client-reported browser signals, not unique people or verified adoption. Existing legacy counters are unchanged. |
| Comparable market information | Liquidity ranking compares pools sharing the same quote asset. Missing token decimals no longer become assumed 18-decimal amounts. History uses archive events and never invents points. LP balance calculations were corrected. | Reserve ratios are not oracle valuations. Markets cover at most the newest 72 pairs. |
| Browser regression coverage | `npm run test:browser` runs with an installed Chromium in a disposable profile. Covers validation, draft reloads, handoffs, certificates, address-only portfolios, pending persistence, unavailable data, privacy defaults, and five mobile routes. Added to existing security CI. | No browser package download or wallet signing. The runner must supply a reviewed Chromium binary. Dependency audit gates remain required. |

## Visual and copy changes

Preserved the purple identity while using quieter surfaces, stronger secondary
text, consistent spacing, clear primary actions, and 44px controls. New workspace
layouts work on desktop and mobile. Locker and vesting screens now put the task
first and allow preparation before connection. Instructions are shorter and use
ordinary language; technical provenance remains available where decisions need it.

## Verification

- Production compilation and TypeScript checks pass locally.
- 282 unit tests pass, including archive validation, same-quote ranking, exact
  LP math, draft parsing, receipt reconciliation, reorg/mismatch handling,
  duplicate prevention, project recovery, and metrics retention/deduplication.
- Browser runner passes ten journey groups, including setup return destinations
  and five mobile routes. It uses private process pipes and passes test values as data.
- In-app browser review confirmed desktop workspace hierarchy, mobile setup,
  draft restoration, 50 live archive records, and forward/back pagination.
- ESLint: no errors and 59 warnings, mainly existing React effect and typing warnings.
- Package policy, secret scan, and approved public manifest checks pass.
- Local verification used installed Node 24.19.0 and npm 11.18.0. Repository and
  CI pins remain Node 24.18.0 / npm 11.16.0. The local build is not protected-runner
  evidence or approval for production promotion.

## Release status

The dependency findings were resolved through separately reviewed PRs #94 and #95,
which passed protected CI before merge. Application and contract audits now report
zero vulnerabilities. The integrated feature PR must pass protected checks before
merge, and existing production promotion controls remain in force. No exception
or advisory suppression was added.

See `PLATFORM-SECURITY-REPORT.md` for exact packages, advisories, and verification.
