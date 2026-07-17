# Lester Labs Security and UI/UX Audit

Date: 2026-07-17

Audited baseline: `fe727b3`

Scope: Next.js application, LitVM read/write paths, launchpad, DEX, airdrop, explorer, portfolio, Solidity contracts, deployment scripts, documentation, desktop UI, and mobile UI.

> **Frontend release boundary:** The 2026-07-17 frontend PR intentionally excludes Solidity contracts, contract tests, deployment scripts, package manifests, and lockfiles. Contract findings marked `Fixed in source` still require a separate contract-source review and on-chain deployment/migration. Existing deployed bytecode is unchanged.

## Executive summary

The audit identified 27 source-level security and integrity issues: 19 medium severity and 8 low severity. Every item in that worklist has been fixed in source or explicitly closed with a documented deployment requirement. A second adversarial pass found and fixed one launchpad availability regression caused by the RPC provider rejecting an unbounded historical provenance query.

No known critical or high-severity source issue remains after the second pass. Application tests, contract tests, type checking, lint, production build, secret-pattern checks, and responsive browser checks completed successfully. This is an engineering audit, not a substitute for an independent third-party smart-contract audit.

Several Solidity fixes affect non-upgradeable contracts. Merging or deploying the web application does not change already-deployed bytecode. Those items remain operationally pending until the migration steps in this report are completed.

## Method

- Reviewed all application wallet write sites and the read data used to construct transactions.
- Checked canonical chain, factory, router, pair, ILO, and deployed-contract provenance boundaries.
- Reviewed value accounting, reentrancy ordering, slippage, transfer balance deltas, fee rounding, and recovery paths in Solidity.
- Audited untrusted token metadata, URLs, images, logs, addresses, CSV/manual input, and RPC failure behavior.
- Tested the homepage and core product routes at 1440x900 and 390x844.
- Verified invalid and valid launchpad deep links against the live LitVM testnet RPC without submitting a transaction.
- Ran unit, contract, type, lint, build, dependency, secret-pattern, and whitespace checks.

## Security finding register

| ID | Severity | Finding | Resolution and completion receipt |
| --- | --- | --- | --- |
| SEC-01 | Medium | A token could impersonate an official featured token by reusing its symbol. | Fixed. Featured identity and provenance are matched by canonical contract address rather than symbol. Address-identity regression tests pass. |
| SEC-02 | Medium | Presale reads could remain on the wrong chain after a wallet network switch. | Fixed. Launchpad reads are pinned to LitVM chain ID 4441 and writes pass through the safe network gate. |
| SEC-03 | Medium | A pre-existing pool could set an unsafe launch price before ILO finalization. | Fixed in source. ILO finalization rejects a skewed pre-existing pair and uses positive liquidity minima. Contract regression test passes. Deployment required. |
| SEC-04 | Medium | Bytecode heuristics could label a malicious or unreadable token as `SAFE`. | Fixed. Results are non-authoritative review signals, timeouts become `unknown`, and UI wording is `No flags found`, not a safety guarantee. |
| SEC-05 | Medium | Airdrop confirmation did not show the complete submitted recipient set. | Fixed. Review uses the exact validated snapshot and paginates all recipients. Parser and pagination tests pass. |
| SEC-06 | Medium | Retrying a partially completed airdrop could replay already-submitted batches. | Fixed. Progress is bound to a snapshot hash, confirmed hashes, in-flight hash, and suffix-only cursor. Corrupt or mismatched progress fails closed. |
| SEC-07 | Medium | An arbitrary launchpad route could expose funding controls for a non-factory contract. | Fixed. Route actions require canonical ILO factory provenance. Browser verification showed zero transaction actions for an unregistered address. |
| SEC-08 | Medium | ILO could accept native value that was not credited as a contribution. | Fixed in source. `receive()` accepts only the router, connector, or wrapped-native refund path. Contract test passes. Deployment required. |
| SEC-09 | Medium | The Ledger retained half of each fee without explicit accounting or withdrawal semantics. | Fixed in source. Owner fees accrue explicitly, treasury transfers are accounted, direct payments are rejected, and forced native value is recoverable separately. Tests pass. Deployment required. |
| SEC-10 | Medium | Topic-only `Transfer` lookalikes could inflate airdrop/platform statistics. | Fixed. Counts are tied to canonical contracts and strict event decoding; incomplete windows disclose coverage instead of presenting a false total. |
| SEC-11 | Medium | Liquidity locks recorded the requested amount rather than the actual received token balance. | Fixed in source. Locker verifies the exact balance delta and rejects transfer-fee shortfalls. Tests pass. Deployment required. |
| SEC-12 | Medium | Add-liquidity minimums could be derived from unauthenticated or stale reserves. | Fixed. Router/factory/pair wiring is authenticated, reserves and balances are refreshed immediately before submission, and minima must be positive. |
| SEC-13 | Medium | Holder scans could materialize an attacker-flooded log set before applying a display cap. | Fixed. Log ranges, pages, and retained results are bounded before materialization, with explicit coverage metadata. |
| SEC-14 | Medium | Transfer activity was presented as current holders or price evidence. | Fixed. The explorer labels sampled inbound transfer activity honestly and reserve-ratio history is separated from holder claims. |
| SEC-15 | Medium | A public ImgBB key could be abused and remote logo URLs expanded the trust surface. | Fixed. Remote upload credentials were removed. Logos are validated, bounded data URLs stored client-side in IndexedDB. Signature, type, size, and pixel tests pass. |
| SEC-16 | Medium | Airdrop documentation claimed multi-batch distribution was one atomic transaction. | Fixed. Documentation describes bounded wallet-confirmed batches and durable resume behavior. |
| SEC-17 | Medium | Portfolio event parsing could display underlying burns as LP locks. | Fixed. `TokenCreated`, `VestingCreated`, and `LockCreated` use ABI-aligned event decoding and canonical factories. |
| SEC-18 | Medium | Factory and platform-stat reads could enumerate unbounded histories. | Fixed. Presales, pools, swaps, tokens, and metadata use bounded newest-first windows and expose partial coverage. |
| SEC-19 | Medium | A guide could be read as instructing hardware-wallet private key exposure. | Fixed. Deployment guidance now uses environment references and signer workflows without requesting key disclosure. |
| SEC-20 | Low | Native airdrop used a 2300-gas transfer pattern that failed for contract recipients. | Fixed in source. Native sends use checked `call`, exact totals, atomic failure, and reentrancy protection. Tests pass. Deployment required. |
| SEC-21 | Low | Deployment could leave the deployer with timelock administration. | Fixed in deployment scripts. Role handoff and post-deployment assertions are required; governance integration tests pass. Deployment required. |
| SEC-22 | Low | Genesis-to-tip mint/token scans could cause RPC or browser denial of service. | Fixed. Scans are bounded, cached, paginated, and newest-first. |
| SEC-23 | Low | Weak creator signals could produce an overly confident `Strong` pool-health label. | Fixed. Health score is based on reserve depth, metadata completeness, and disclosed evidence, without asserting token safety. |
| SEC-24 | Low | Holder concentration could appear complete when only a partial history was scanned. | Fixed. Partial windows and sampled inbound activity are labeled explicitly. |
| SEC-25 | Low | Liquidity removal could submit zero minimum outputs. | Fixed. Removal requires an authenticated positive quote and recomputes non-zero minima from fresh reserves and supply before the wallet opens. |
| SEC-26 | Low | Per-swap protocol fee flooring allowed repeated micro-swaps to avoid fee capture. | Fixed in source. Pair-level fee remainders accumulate across swaps. Fragmented-swap test passes. New factory/pairs required. |
| SEC-27 | Low | Adversarial token metadata could trigger excessive reads or oversized UI strings. | Fixed. Metadata requests, strings, control characters, RPC time, and concurrency are bounded. Tests pass. |

## Re-audit finding

### SEC-28: canonical ILO deep links failed closed because the RPC rejected a full-history log query

Severity: Medium availability and UX impact, with no fund-loss path.

The initial provenance guard queried `ILOCreated` from block zero to latest. The LitVM provider rejected that unbounded request, so both invalid routes and genuine ILOs could show the same unavailable state. The fix verifies deployed code and checks the canonical factory's newest `allILOs` registry entries in bounded batches before using the exact event query as an older-sale fallback.

Receipt:

- A current factory ILO loaded its contribution and claim controls.
- `0x1111111111111111111111111111111111111111` exposed no approve, contribute, fund, finalize, claim, refund, sweep, or cancel action.
- Both paths had zero horizontal overflow.

## UI and UX findings resolved

### Performance and progressive rendering

- Explorer search and the latest-block shell render immediately.
- `/api/explorer/summary` separates block and transaction hydration and sends `public, s-maxage=4, stale-while-revalidate=20`.
- Observed local cold requests were approximately 0.8 seconds for blocks and 0.35 seconds for sampled transaction status; warm cached requests were 5-6 ms.
- The explorer displayed eight blocks and eight transactions progressively rather than holding the whole page for receipt hydration.
- Charts load an initial bounded market page and provide explicit pagination instead of enumerating the entire factory.
- Pool, launchpad, platform-stat, holder, and metadata scans disclose their bounded newest-first coverage.
- Homepage carousel PNGs gained substantially smaller WebP sources while retaining fallbacks.
- The global template no longer creates a perpetual pointer animation loop or duplicate global chrome.

### Mobile ergonomics and accessibility

- Core routes were checked at 390x844: swap, pool, launchpad, airdrop, portfolio, ledger, analytics, explorer, charts, locker, vesting, and token launch.
- No audited route had horizontal overflow.
- Swap slippage presets, custom slippage, pool link, token selectors, and max controls now meet the 44px target baseline.
- Pool search, saved search, create pool, watch, add-liquidity, chart, and explorer actions now meet the same baseline.
- Launchpad tabs and watchlist controls were enlarged to stable touch targets.
- Explorer save-search, block, and transaction links gained stable interaction height.
- Shared disconnected-wallet next actions gained stable interaction height.
- Keyboard focus, reduced-motion behavior, responsive ecosystem layout, and homepage event cleanup are covered by UI regression tests.

### Information architecture and honest states

- Launchpad status now distinguishes upcoming, live, finalized, and cancelled sales from on-chain times and terminal state.
- Launchpad supports search, quality filters, participated-only filtering, newest-first pagination, reminders, watchlists, and local saved searches.
- Pool browsing supports canonical searchable newest-first lists, saved searches, health evidence, watchlists, and direct chart/liquidity actions.
- Canonical token pages connect chart, swap, pool, presale, contract, creator, and transfer surfaces without symbol-based identity.
- Portfolio event decoding and empty states were corrected.
- Explorer/token analytics distinguish samples and partial coverage from complete holder or price claims.
- The homepage ecosystem flow, charts, and tool surfaces remain the primary app experience after the initial brand impression.
- Metadata emits a stable `/favicon.ico` URL. Search-engine presentation can still lag until Google recrawls the site.

## Verification receipts

| Check | Result |
| --- | --- |
| Application unit tests | 101 passed, 0 failed |
| Solidity/Hardhat tests | 27 passed, 0 failed |
| TypeScript | `tsc --noEmit` passed |
| Production build | Next.js build passed; 29 static pages generated and dynamic routes compiled |
| ESLint | 0 errors, 86 warnings |
| Whitespace/patch integrity | `git diff --check` passed |
| Dependency audit at high threshold | Exit 0; no high or critical findings |
| Secret-pattern scan | No committed secret value found; only the `.env.example` placeholder and environment-variable references matched |
| Desktop responsive pass | 1440x900, no horizontal overflow on audited routes |
| Mobile responsive pass | 390x844, no horizontal overflow on audited routes |
| Explorer cache behavior | Short shared cache plus stale-while-revalidate confirmed |
| Invalid ILO route | Failed closed with no transaction actions |
| Valid ILO route | Canonical sale resolved and displayed its intended action surface |

## Deployment and migration requirements

These are source fixes in non-upgradeable contracts. They are not active in existing deployed bytecode until migration:

1. Deploy the updated `Disperse` contract and repoint the airdrop application only after verifying the address and bytecode.
2. Deploy the updated ILO factory. New ILOs created by that factory will contain the receive restriction, pool-integrity checks, and `sweepExcessTokens()` recovery path. Existing ILO contracts cannot inherit those changes.
3. Migrate the launchpad application to the new canonical factory only after its router, connector, treasury, ownership, code, and chain assertions pass.
4. Deploy the updated `LiquidityLocker` and `TheLedger`, then update canonical frontend addresses after verification.
5. Execute governance role handoff so the timelock/governor owns the intended roles and the deployer has relinquished temporary administration.
6. Deploy a new V2 factory so newly created pairs use the fee-remainder and invariant fix. Existing pairs are immutable and require a deliberate liquidity migration.
7. Publish addresses, bytecode hashes, deployment transactions, owners/roles, and migration status in a deployment manifest before enabling writes.

Until those steps are complete, the frontend protections improve transaction targeting and preflight, but they cannot alter the behavior of legacy deployed contracts.

## Residual risks and limitations

- `npm audit` reports five moderate transitive advisories: PostCSS under Next and `uuid` under MetaMask utilities. There are no high or critical advisories. The automated PostCSS recommendation is a breaking Next downgrade and was not applied. Update these through tested upstream-compatible releases rather than forcing the lockfile.
- The package manifest and lockfile contained user-owned dependency changes before this audit and were intentionally not rewritten.
- ESLint reports 86 warnings, concentrated in legacy diagnostic/deployment scripts, explicit `any` types, unused variables, and several older effect patterns. They do not block the build and no warning was found to create a direct fund-loss path, but they remain maintenance debt.
- The browser audit did not connect a wallet or submit a live transaction. Transaction correctness was verified through source review, target/provenance tests, and local contract tests.
- No production deployment or liquidity migration was performed as part of this audit.
- No claim of formal verification or independent third-party audit is made.

## Final assessment

The reviewed source now fails closed at the important fund-moving boundaries: chain, deployment, pair, ILO, balance, allowance, reserve, slippage, recipient snapshot, and transaction target. Read-heavy surfaces are bounded and disclose incomplete coverage. The desktop and mobile application is materially faster, more usable, and less likely to present stale or overstated data.

The remaining high-leverage action is operational rather than code-level: perform the contract deployment and migration plan with a separate signed checklist, bytecode verification, and staged testnet smoke transactions before treating the Solidity fixes as live.
