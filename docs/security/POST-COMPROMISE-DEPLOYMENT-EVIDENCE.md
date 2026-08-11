# Post-Compromise Deployment and Reputation Appeal Evidence

Use one copy of this document per incident and deployment. Record UTC timestamps. Attach evidence by immutable URL or SHA-256 digest. Redact secrets, authentication headers, personal data, and full wallet traces before sharing the appeal package.

Never record a private key, seed phrase, raw session cookie, registry token, deploy token, or unredacted environment value here.

> **Current Lester Labs incident status (2026-08-06): containment is incomplete.** Independent live-chain review found authority still associated with the retired compromised controller `0xDD221FBbCb0f6092AfE51183d964AA89A968eE13`. The rejected July target `0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28` remains incident-associated and is not acceptable in the public-remediation stack. The separately disclosed valueless testnet key used for this investigation cryptographically derives to `0x439945924515218061b644901a31aC4A6c00957c`; it is likewise forbidden as a production controller, treasury, or deployer. Anyone holding that disclosed key material can race its nonce and substitute contracts at a predicted CREATE sequence even if the signer would otherwise be “gas-only.” It is permitted only in a separately attested, valueless `testnet-immutable-disposable` functional-test profile where it is gas payer and economic recipient, every authority and all governance voting power are frozen at the verified `0x…01` ECRECOVER precompile, and frontend activation rejects the manifest. That disposable deployment is not containment or appeal evidence. Do not submit a false-positive appeal, re-enable public paid writes, or describe any incident/disclosed-key address as production-safe. Generate three fresh, distinct production addresses from trusted systems—a controller, treasury, and new single-use gas EOA—record public addresses only, complete the live rotations/redeployments, independently verify the resulting state, and prove clean-build-to-live served-artifact parity first. The appeal remains blocked until all of those gates are complete.

The authorised disposable profile executed on 2026-08-06 from source commit
`abcf1b75ee7945f557163dce11485555da63a5b6`. Its exact manifest and build
attestation are recorded separately under
[`docs/security/evidence/disposable-testnet-4441-2026-08-06/`](evidence/disposable-testnet-4441-2026-08-06/README.md).
They are explicitly excluded from the public origin, analytics continuation,
production safety claims, and the appeal package.

Current attribution evidence is strong but deliberately narrow: MetaMask's dapp scanner classified the apex and `www` hostnames as `BLOCK` with a critical `DRAINER` risk factor while classifying the Vercel project alias as `NONE`; ten sampled routes were byte-for-byte identical across those hosts and referenced one deployment ID. The same domain did not appear in MetaMask's contemporaneous public stale or hot list data. Static inspection of the sampled JavaScript found no credential-collection flow, clipboard read, hidden recipient substitution, or arbitrary-code-evaluation primitive. These are strong negative findings about the current sampled client artifacts, not proof that historical deployments, hosting state, server-side behavior, RPC responses, or contract behavior were clean.

A live in-app-browser check on 2026-08-04 reproduced the stale production
wallet surface. Clicking `Connect Wallet` opened RainbowKit's `Connect a
Wallet` dialog with Rainbow, Base Account, MetaMask, and WalletConnect options
plus an external Rainbow education link. No wallet provider was installed in
that isolated browser, so no connector was selected and no signature or
transaction trace was generated; this is UI evidence, not proof of the deeper
connector paths. The remediated runtime source removes RainbowKit imports and use, disables
remote/multi-provider discovery, and exposes one deterministic injected-wallet
control. Do not claim that change is live until served-bundle parity proves it.

An independent external-reputation signal also exists. A public third-party
post directs users to Lester Labs to manufacture testnet activity, calls a
future token “confirmed,” asserts a 51% community allocation, and urges users
to farm before TGE. Preserve the [original X post](https://x.com/FareaNFts/status/2048754598618521671)
and a [public mirror](https://mobile.twstalker.com/CryptoBlockES) with UTC
capture time, screenshot, and content digest because social content can change.
This is an unverified third-party representation—not evidence that Lester
Labs, LitVM, or Litecoin confirmed a reward—but its association of the Lester
origin with misleading reward claims and farming behavior is a plausible
reputation input independent of code behavior. The repository's former
speculative eligibility article has been replaced with anti-scam guidance
stating that no reward programme, allocation, snapshot, or eligibility rules
are confirmed.

A concrete contract-level scanner signal was found in the legacy Lester DEX. Its vendored `UniswapV2Pair.swap()` is not canonical Uniswap V2 behavior: after measuring each input, it transfers `0.20%` of token0 and/or token1 directly to the factory's mutable `feeTo` address, then applies the remaining in-pool fee. Canonical Uniswap V2 instead realizes its optional protocol fee through LP-token minting during liquidity events. The extra direct token recipient is disclosed by the old product fee model and is not, by itself, an arbitrary wallet drain; nevertheless, it is a plausible drainer/recipient heuristic for transaction scanners. The risk is real because the compromised `feeToSetter` can redirect `feeTo`. This is an evidence-backed possible trigger, not proof of MetaMask's undisclosed classification logic. The legacy DEX must remain recovery-only (exact LP approval and `removeLiquidity*`, or wrapped-token withdrawal); swaps, pool creation, liquidity additions, and new wrapping are blocked. A replacement must use canonical pair fee behavior and distinct reviewed controller/treasury roles.

## 1. Case and warning identity

| Field | Evidence |
| --- | --- |
| Internal incident/case ID | TODO |
| Incident lead | TODO |
| Independent reviewer | TODO |
| Production origin | TODO |
| Repository | TODO |
| Reputation provider and appeal route | TODO |
| Exact warning/category/severity | TODO |
| First observed UTC | TODO |
| Last reproduced UTC | TODO |
| Wallet/browser/extension versions | TODO |
| Screenshot or recording SHA-256 | TODO |
| Raw scanner response location and SHA-256 | TODO |

State whether the warning appears before connection, on connection, on a particular route, or only for a specific transaction. Distinguish a domain block from a transaction-simulation warning and a contract-address warning.

## 2. Containment and account recovery

- [ ] Production recovery, signing, building, and deployment do not use the originally suspected device. The separately authorised factory-reset-Mac disposable-testnet exception is documented and is not treated as production provenance.
- [ ] Recovery was performed from a separately trusted device and network.
- [ ] Three fresh addresses were generated from trusted systems: controller, treasury, and a single-use gas EOA; this record contains public addresses only.
- [ ] Controller and treasury are distinct deployed contract authorities, and all replacement constructor/setter/ownership invariants reject collapsing those roles.
- [ ] Each production multisig implementation/runtime, owners, threshold, enabled modules, guard, fallback handler, and recovery policy was independently verified and recorded; contract code alone was not treated as proof of a safe multisig.
- [ ] A fresh nonce-zero single-use gas EOA was generated on the trusted deployment runner; it is not a known incident address, and it signed only the thirteen reviewed CREATE transactions.
- [ ] No address whose private key was exposed in source, chat, logs, tests, browser state, or the suspected device is used for durable authority.
- [ ] Active GitHub, hosting, DNS, registry, email, RPC, monitoring, and wallet sessions were revoked.
- [ ] Personal access tokens, deploy hooks, API keys, SSH keys, GPG keys, OAuth grants, recovery codes, and environment secrets were inventoried and rotated as applicable.
- [ ] Repository collaborators, deploy keys, webhooks, Actions secrets/environments, branch rules, tags, releases, and audit logs were reviewed for persistence.
- [ ] Hosting collaborators, project links, domains, aliases, environment variables, build settings, and historical deployments were reviewed.
- [ ] DNS records, registrar access, nameservers, DNSSEC, certificate issuance, and certificate-transparency entries were reviewed.
- [ ] On-chain admin, owner, proxy, treasury, guardian, timelock, and upgrader authority was rotated or independently confirmed.
- [ ] The retired `0xDD221FBbCb0f6092AfE51183d964AA89A968eE13` controller, rejected July target `0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28`, and disclosed-key-derived `0x439945924515218061b644901a31aC4A6c00957c` address have no live production authority and were not used to sign the production replacement CREATE sequence.
- [x] The 2026-08-06 disposable functional-test deployment is [recorded separately](evidence/disposable-testnet-4441-2026-08-06/README.md) and excluded from the public origin, frontend targets, analytics continuation, safety claims, and appeal package.

Evidence locations, event IDs, revocation times, and reviewers (never secret values):

```text
Checked-in fail-closed inventory: docs/security/evidence/production-control-plane-recovery.json
Initial GitHub repository observation: docs/security/evidence/github-control-plane-observation-2026-08-10.json
Initial GitHub observation SHA-256: 97be8998a89ca5d17654ec438cb9abfcb9c7ef2287874ae2230e670754a232f5
Current GitHub repository observation: docs/security/evidence/github-control-plane-observation-2026-08-11.json
Current GitHub observation SHA-256: efea2609e630175f806f0d4d8ceadbaf520ba4f10bcdb9042b304e224f1fd906
External redacted evidence bundle and SHA-256: TODO
```

## 3. Reviewed source provenance

| Field | Evidence |
| --- | --- |
| Full Git commit SHA | TODO |
| Commit signature verification | TODO |
| Expected tree SHA | TODO |
| Reviewer-approved PR | TODO |
| Branch protection and Code Owner approval | TODO |
| Root `package-lock.json` SHA-256 | TODO |
| Contract `package-lock.json` SHA-256 | TODO |
| `.npmrc` SHA-256 values | TODO |
| Source archive SHA-256 | TODO |
| SBOM location and SHA-256 | TODO |

- [ ] The reviewed checkout was clean and had no submodules, Git dependencies, local-path dependencies, unverified registries, or unexpected untracked build inputs.
- [ ] Direct dependencies exactly match the lockfile root metadata.
- [ ] Every registry tarball in both lockfiles has an integrity digest and uses `https://registry.npmjs.org/`.
- [ ] Review covered wallet targets, calldata construction, approvals, permits, typed-data signing, network switching, external URLs, analytics, dynamic code loading, service workers, privileged contract methods, and deployment scripts.

## 4. Clean build record

| Field | Evidence |
| --- | --- |
| Clean runner/image identity or immutable digest | TODO |
| Node.js version and signed distribution evidence | TODO |
| npm version and registry integrity/signature evidence | TODO |
| Workflow run URL and attempt | TODO |
| Build start/end UTC | TODO |
| Network egress policy | TODO |
| Artifact SHA-256 | TODO |
| Build log SHA-256 | TODO |
| External replacement attestation immutable URL/path and SHA-256 | TODO |
| Fresh build HOME/cache identity | TODO |
| Node executable SHA-256 | TODO |
| Absolute Git executable path and SHA-256 | TODO |
| Hardhat package metadata and CLI SHA-256 | TODO |
| solc 0.5.16 binary/list SHA-256 and registry Keccak-256 | TODO |
| solc 0.6.6 binary/list SHA-256 and registry Keccak-256 | TODO |
| solc 0.8.24 binary/list SHA-256 and registry Keccak-256 | TODO |
| First/second build artifact-record digest comparison | TODO |

Required results:

| Check | Result and evidence |
| --- | --- |
| `node scripts/security/verify-package-policy.mjs` | TODO |
| `node scripts/security/scan-secrets.mjs` | TODO |
| `node scripts/security/verify-control-plane-recovery.mjs --require-reviewed` | TODO |
| `npm ci --ignore-scripts` (application) | TODO |
| `npm ci --ignore-scripts` (contracts) | TODO |
| `npm audit --audit-level=high` (both projects) | TODO |
| `npm audit signatures` (both projects) | TODO |
| Lint and application unit tests | TODO |
| Production build | TODO |
| Contract tests | TODO |
| CodeQL security-extended analysis | TODO |
| Dependency review | TODO |

- [ ] Dependency scripts were not executed.
- [ ] No production, wallet, cloud, DNS, SSH, signing, or deployment credential was available during installation or untrusted build steps.
- [ ] The build did not reuse `node_modules`, npm cache, browser profiles, shell profiles, or artifacts from the suspected device.
- [ ] The frontend production build completed with outbound network disabled; it uses reviewed local/system font stacks and performs no `next/font/google` or other remote font download.
- [ ] Ordinary security CI passed `LESTER_RELEASE_BUILD_ID` from the event SHA, proved it was a lower-case 40-hex value equal to both `GITHUB_SHA` and the checked-out `HEAD`, and then built that exact revision. An approved package was not tested with an absent or synthetic build identity.
- [ ] The external attestation records the deterministic full `node_modules` tree digest (every sorted relative path, type, mode, internal symlink target, and file content); all regular files/directories are non-writable, all symlinks resolve inside the tree, and pre-deploy plus post-attempt digests match.
- [ ] The live runner enforced `node_modules` with a read-only mount, immutable container layer, or separate ownership before key injection; compiler cache, Hardhat artifacts/cache, and TypeChain outputs remained outside it. Residual host/process/TOCTOU trust was reviewed manually.
- [ ] Attestation, preview, deployment, and independent verification ran as an unprivileged non-root user on the required x64 Linux runner.
- [ ] Hardhat did not auto-load an ignored `.env`; preview and verification ran with no deployment key, and approved live values were injected explicitly by the clean runner/secret broker only after preview approval.
- [ ] Any compiler or binary downloaded during the build is identified by source, exact version, digest, signature/provenance status, and reviewer.
- [ ] The replacement build ran on a digest-pinned x64 Linux ephemeral runner, never the suspected Mac; outbound network was disabled before both compilation passes.
- [ ] The real replacement attestation was published outside the checkout and independently digest-pinned; the committed `NOT_ATTESTED` sentinel was not rewritten.
- [ ] All sixteen attested artifacts reproduced byte-for-byte. Thirteen are direct CREATE deployments; the additional records bind factory-created `UniswapV2Pair` and `ILO` runtimes plus the immutable-reference-aware `VestingWallet` template.
- [ ] Deployment and independent verification used the digest-pinned Git executable with hooks/helpers disabled, required `HEAD` to equal the attested commit, and observed no staged, unstaged, or untracked files.

## 5. Deployment and domain binding

### Pre-remediation public observation (2026-08-04T18:30:38Z)

This is an unauthenticated external observation, not proof of registrar or
hosting-account ownership:

- `lester-labs.com` resolved to IPv4 `216.198.79.1`; no AAAA response was
  observed. `www.lester-labs.com` was a CNAME to `lester-labs.com`.
- Authoritative nameservers were `ns75.domaincontrol.com` and
  `ns76.domaincontrol.com` (GoDaddy/DomainControl). No DS, DNSKEY, CAA, or TXT
  response was observed for the queried apex record set. Account audit and
  DNSSEC/CAA decisions still require registrar access.
- The apex returned an HTTP 307 redirect to `https://www.lester-labs.com/`.
  The `www` origin returned HTTP 200 and identified `server: Vercel`, with a
  Vercel cache hit and an object age of 666,842 seconds.
- The sampled live response had HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and COOP headers,
  but no `Content-Security-Policy` header. Do not claim the source-level CSP is
  deployed until served-header parity proves it.
- The `www` certificate was Let's Encrypt YR2 serial
  `06C26F85FA41B93AA2C5C988FDCB1D820822`, valid 2026-06-14 through
  2026-09-12, SHA-256 fingerprint
  `1F:24:0C:4D:5F:53:5A:E0:8A:86:5D:8C:A7:9F:1D:54:79:98:56:6F:DA:BF:BA:00:CF:A8:BB:CB:A4:6E:DB:A6`.
  The apex used a distinct certificate with fingerprint
  `3B:D3:D5:EC:93:A6:2F:A5:AE:39:DB:D9:A4:9E:84:5C:07:7E:DB:0E:B8:85:9D:AA:8D:A5:16:9A:BF:D7:34:45`.

The legacy TokenFactory remained active after the initial analytics floor was
recorded. The public homepage showed 500,434 token creations during one browser
sample. A direct API read then returned 500,443 at
2026-08-04T19:23:11.234Z. The source-pinned read-only cutover command later
measured 500,457 from the factory nonce at LitVM block 36,763,170, hash
`0x502aa093d0ae45fc14139997dabd2ee6cb942dccf33be8df7f2460b42ed2bc94`,
timestamp 2026-08-04T19:30:12Z. This rapid movement proves that the committed
500,139 value is only an initial incident floor, not the final value to deploy.
Run `npm run security:capture-activity` immediately before alias cutover,
independently review the two bounded display counters, and save the output as
an immutable candidate. From a second clean network and a different credential-
free HTTPS RPC URL, run
`node scripts/security/verify-platform-activity-cutover.mjs <candidate.json> <second-public-rpc-url>`.
Preserve the complete URL and both raw output digests. The clean production
exporter must live re-run that proof and the full deployment manifest against a
distinct reviewed RPC origin, perform source-pinned authority verification, and
prove every replacement counter is zero at the same exact block. The approval
payload must embed and digest-bind that second-RPC report, including its URL,
exact block/hash, manifest digest, verified scope, complete Safe facts, and zero
counters; a transient successful exporter run is not enough.

Re-run these observations from two clean networks after registrar and Vercel
recovery. Export the registrar and hosting audit logs, verify every DNS record
and certificate-transparency entry, and attach raw command output by digest.

A fresh unauthenticated observation at `2026-08-10T22:13:57Z` is recorded in
`evidence/public-origin-observation-2026-08-10.json` (SHA-256
`71009f7e02dd97caab1b8c6c98be5528643154abbb66c46b3cafbaf2958b746d`).
The apex still redirects to a byte-identical `www` HTML response from deployment
`dpl_ApzQPMWK4deZofUP35xjjKSTiZWg`; the cached object was approximately 13.9
days old, still presented the active pre-containment product copy, and still
lacked a Content-Security-Policy header. The remediated source is not live.

A later containment check at `2026-08-11T00:07:21Z` is recorded in
`evidence/public-origin-containment-check-2026-08-11.json` (SHA-256
`de95704d57a947f0c8065b89023ff829fd9d500923bfad8fb89d87fb141c3174`).
The `www` body was
still exactly 93,701 bytes with the same
`87c114fd4338883fbd0521457cd3449a38164fdc2af1531859a1769418148351`
SHA-256, a cache age of 1,205,446 seconds, no CSP or `Clear-Site-Data`, and the
wallet/DeFi interaction copy still present. This makes the separately packaged
wallet-free emergency containment release the first hosting action after
account recovery; it does not relax any full-replacement or appeal gate.

An authenticated, redacted Vercel dashboard observation at
`2026-08-11T00:36:28Z` is recorded in
`evidence/vercel-control-plane-observation-2026-08-11.json` (SHA-256
`db9c641d8d99a3a320d0ec8432a4c5aa49b4d018f172b19b27a490a910279c6a`).
During that containment session, the project Git integration was disconnected,
23 legacy project environment-variable entries were removed, two non-current
browser sessions were revoked, and the Vercel CLI OAuth application was
disconnected. At `2026-08-11T06:18:52Z`, automatic production-domain assignment
was also disabled and re-read as disabled after saving, so a staged build must
be promoted explicitly. A distinct empty `lester-labs-release-canary` project
was created without Git, custom domains, deployments, or project variables, and
its automatic production-domain assignment was also disabled. No deploy hook or project webhook remained visible. The live
deployment was deliberately left unchanged pending signed-artifact staging and
parity checks. Account-level 2FA/passkey enrolment, global credential review,
registrar/DNS recovery, and independent approval remain release blockers; this
dashboard observation is not a provider-attested audit export.

MetaMask's official public `eth-phishing-detect` utility returned “This domain
is not blocked” for both the apex and `www` inputs at
`2026-08-10T22:18:13Z`. The observation is recorded in
`evidence/metamask-public-list-observation-2026-08-10.json` (SHA-256
`1b694dc43d3dd19424032c002c1b9af09909da3c2f51b2dd1418c45cacc33c9d`).
That public-list result does not clear the separately observed dapp-scanner
`BLOCK` / critical `DRAINER` classification and is not an appeal decision.

| Field | Evidence |
| --- | --- |
| Hosting account/project ID | TODO |
| Deployment ID and immutable URL | TODO |
| Deployment commit SHA | TODO |
| Deployed artifact SHA-256 | TODO |
| Production alias mapping | TODO |
| Deployment actor and reviewer | TODO |
| Environment variable names and rotation times (values redacted) | TODO |
| DNS record set and resolver evidence | TODO |
| TLS certificate fingerprint and transparency entry | TODO |
| Cache/service-worker purge time | TODO |
| Rollback deployment ID | TODO |

- [ ] Production and preview projects cannot silently share privileged secrets.
- [ ] The production domain resolves only to the intended provider and project.
- [ ] No stale deployment, redirect, rewrite, middleware, edge function, service worker, injected tag, or analytics container can serve unreviewed code.
- [ ] Security headers, content security policy, redirects, robots metadata, and well-known security contact were captured from the live origin.

## 6. Served-artifact parity

- [ ] The source-pinned `APPROVED` public package contains the complete verified production manifest, child-runtime attestations, raw production-authority/control-plane evidence digests, full exact-block Safe verification report, independent cutover candidate/proof digests and URL, exact block/hash/totals, and five literal zero replacement counters. It also embeds the full distinct-origin second-RPC manifest/Safe/counter verification report and binds that report to its own recomputed digest, the exact manifest digest, and the exact cutover block/hash. Its recomputed canonical payload SHA-256 matches `approvalPayloadSha256`; the nested manifest also independently matches `deploymentManifestSha256`.
- [ ] Every one of the thirteen manifest addresses equals the deterministic `CREATE(gasOnlyDeployer, nonce)` address for its declared nonce; no disposable-stack address was relabelled as production evidence.
- [ ] Treat `approvalPayloadSha256` and the two-or-more structured reviewer records as auditable consistency records, not cryptographic signatures, proof of authorship, or the reviewer-authentication mechanism. Authenticity and promotion authority come from the separate protected frontend approval/promotion envelope, direct independent reviewer confirmation, independently reviewed source/build attestation, recovered publishing accounts, and protected review of the commit that pins the digest.
- [ ] Controller and treasury existed as contract authorities before the first replacement deployment, do not overlap any replacement or known compromised legacy address, and have separately reviewed multisig implementation, owners, and threshold.
- [ ] At the exact cutover block, the replacement TokenFactory account nonce is `1` and replacement Router swaps, Disperse recipient entries, Ledger messages, and ILO children are all zero; only activity from `throughBlock + 1` is added to the preserved historical floor.
- [ ] Pair and ILO child runtime hashes and the VestingWallet normalized runtime/immutable ranges were generated from the sixteen-artifact clean-build attestation, not typed manually.
- [ ] The approved package cutover chain/block/hash exactly equals the committed post-replacement platform-activity snapshot; every new activity delta begins at `throughBlock + 1`.
- [ ] Both application and governance latches were activated in the same reviewed change; no disposable profile address or incident address is present.
- [ ] The contract/control-plane/cutover package produced only a release candidate. The public aliases did not move until the separate protected frontend manifest was `APPROVED`, the exact build ID was deployed, and apex/www parity succeeded.

Record at least two independent credential-free HTTP fetches from clean networks
and multiple user-agent profiles. These are HTTP observations, not browser-engine
proof. Also record real digest-pinned Chromium and Firefox sessions and a genuine
MetaMask session with redacted network traces.

| Item | Build artifact digest | Live digest | Match |
| --- | --- | --- | --- |
| HTML entry document | TODO | TODO | TODO |
| Each first-party JavaScript chunk | TODO | TODO | TODO |
| Web manifest and service worker | TODO | TODO | TODO |
| Critical static configuration | TODO | TODO | TODO |

Document all third-party origins contacted during page load, wallet connection, and each transaction flow. For each origin, record purpose, request type, sensitive fields, response influence, and whether it can modify transaction targets or calldata.

```text
TODO
```

## 7. Wallet interaction and transaction trace

Use a new disposable testnet wallet. Record its public address only.

| Field | Evidence |
| --- | --- |
| Test wallet public address | TODO |
| Chain name and numeric chain ID | TODO |
| Wallet and extension versions | TODO |
| Clean browser/profile identity | TODO |
| Screen capture SHA-256 | TODO |
| Redacted HAR/devtools trace SHA-256 | TODO |

For every tested user action, record:

| UI action | RPC method | Target | Value | Decoded function/typed data | User-visible preview accurate? | Transaction/result |
| --- | --- | --- | --- | --- | --- | --- |
| TODO | TODO | TODO | TODO | TODO | TODO | TODO |

- [ ] No page requests a seed phrase, private key, wallet backup, authentication cookie, or unrelated credential.
- [ ] No action changes the intended target, value, chain, spender, recipient, deadline, slippage, nonce, or calldata after review.
- [ ] No hidden `approve`, `setApprovalForAll`, permit, unlimited allowance, typed-data signature, native transfer, token transfer, or contract deployment occurs.
- [ ] Rejected prompts create no follow-on request or transaction.
- [ ] Wallet connection alone causes no signature or transaction request.
- [ ] Every RPC request and wallet prompt maps to a deliberate visible user action.
- [ ] The sole connection path requests LitVM chain `4441`, verifies the connector-reported chain and account, and disconnects partial state if attestation fails.
- [ ] Every write path uses the single guarded write abstraction; immediately before each wallet prompt it rechecks Wagmi state, connector chain/account, pins `chainId: 4441` and the connected account, and rejects any disagreement without sending a request.
- [ ] Static policy tests enumerate every write callsite and reject raw provider requests, unguarded contract writers, direct transaction/signature methods, alternate chain switchers, and user-controlled target addresses.
- [ ] External metadata, token images, RPC responses, query parameters, and local storage cannot inject executable code or substitute transaction targets.

## 8. Live contract inventory and authority

Repeat this table for every address the production application can call.

| Field | Evidence |
| --- | --- |
| Network and chain ID | TODO |
| Contract name and address | TODO |
| Runtime bytecode hash | TODO |
| Expected build bytecode hash | TODO |
| Verified source URL | TODO |
| Compiler version/settings | TODO |
| Proxy type and implementation address | TODO |
| Proxy admin/upgrader | TODO |
| Owner, guardian, treasury, fee recipient | TODO |
| Privileged roles and members | TODO |
| Creation and upgrade transaction hashes | TODO |
| Recent privileged-call review range | TODO |
| Independent reviewer | TODO |

- [ ] Runtime bytecode matches the reviewed source and compiler settings.
- [ ] Proxy slots, implementation bytecode, and initialization state match the approved inventory.
- [ ] No unexpected approval, delegatecall target, self-destruct path, arbitrary-call primitive, signer, child contract, fee recipient, or withdrawal authority exists.
- [ ] Deployed frontend addresses match this inventory exactly.
- [ ] The production replacement manifest has profile `production-separated-authority`, proves the exact thirteen-transaction nonce sequence, and rejects `0xDD22…`, `0xCbf8…`, and disclosed-key-derived `0x4399…` as controller, treasury, or deployer.
- [ ] The nonce-bound partial/final journal was written to a pre-created mode-`0700`, non-symlink directory outside the source repository; no CREATE was attempted after a dirty-checkout or nonce failure.
- [ ] Replacement DEX Pair uses the canonical 0.30% in-pool invariant and optional protocol-fee LP minting, with no direct per-swap input-token transfer to `feeTo`.
- [ ] Replacement Router starts with `totalSwapCount == 0`; all nine public swap entrypoints advance it exactly once only when the complete call succeeds. It counts permissionless Router actions regardless of hop count, excludes direct Pair calls, is not a unique-user or volume metric, and can be deliberately inflated with valid low-value swaps.
- [ ] Replacement Disperse starts with `totalRecipientEntries == 0`, caps each batch at 200 positive-value recipient entries, and events/counter agree. Duplicate addresses are not counted as unique users.
- [ ] Production replacement Token starts with exactly 10,000,000 LGT held and self-delegated by treasury; Timelock owns minting; deployer holds zero balance/votes.
- [ ] Replacement Timelock has only self as admin, Governor as proposer/executor, controller as canceller, and no zero-address/open role; Governor parameters match the reviewed plan.
- [ ] Direct Timelock cancellation is durably reflected as Canceled, and native-value proposals execute only from a prefunded Timelock because Governor is nonpayable and has no receive path.

Known findings that must be carried into the inventory and appeal decision:

| Surface | Finding | Security interpretation | Required disposition |
| --- | --- | --- | --- |
| Legacy DEX pair | `swap()` transfers `0.20%` of each measured input token directly to mutable factory `feeTo` rather than using canonical V2 LP-mint protocol fees. | Not an arbitrary drain, but an extra recipient/transfer pattern that can resemble a drainer heuristic; compromised `feeToSetter` can redirect the recipient. | Recovery-only UI; no legacy swaps/add-liquidity/pool creation/new wrapping; canonical replacement pair behavior. |
| Legacy governance token | `owner()` is the retired compromised controller. | Token authority is compromised; voting power/ownership assumptions are not trustworthy. | Read-only historical reference; replace with a distinct source-pinned token. |
| Legacy timelock | Retired controller has `DEFAULT_ADMIN_ROLE` and `CANCELLER_ROLE`. | A compromised key retains privileged governance control. | Read-only; deploy a separately controlled replacement timelock. |
| Legacy Governor | Governor has proposer authority, but no account (including Governor) has executor authority. | Governance is non-executable even apart from the compromised roles. | Block votes/proposals/queue/execute until the complete replacement role graph is independently verified. |

## 9. Reputation and threat-intelligence checks

Capture the exact request, response, UTC time, scanner version/list version, category, and raw-response digest for each applicable provider. Do not treat a clean result from one provider as proof that the deployment is safe.

| Provider/list | Before remediation | After remediation | Evidence |
| --- | --- | --- | --- |
| MetaMask domain scan/warning | TODO | TODO | TODO |
| MetaMask transaction simulation | TODO | TODO | TODO |
| eth-phishing-detect or related blocklist | TODO | TODO | TODO |
| Browser safe-browsing provider | TODO | TODO | TODO |
| Hosting/registrar abuse status | TODO | TODO | TODO |
| Independent malware/phishing scanners | TODO | TODO | TODO |
| Third-party airdrop-farming claims linking Lester | “Confirmed” token, 51% allocation, and farm-before-TGE language in the X post/mirror recorded above. Treat as unverified association evidence. | TODO | TODO |

Record whether the reputation result is deterministic, route-specific, wallet-specific, transaction-specific, or intermittent. Preserve provider case IDs and all responses.

- [ ] Reputation evidence distinguishes Lester-authored statements from
  third-party farming claims and does not repeat those claims as fact.
- [ ] The revised anti-scam tutorial and its served-artifact digest are included
  in the remediation evidence.
- [ ] After the clean containment/full release is live, request recrawl or
  removal of stale pre-containment results through the verified Google Search
  Console and Bing Webmaster accounts, record the request IDs/timestamps, and
  verify that indexed snippets no longer advertise retired wallet actions.
- [ ] Request correction from the identifiable authors or hosts of preserved
  reward/farming claims. Keep the request factual, do not claim control over the
  third party, and preserve the public URL plus before/after digest evidence.

## 10. Findings, remediation, and residual risk

| Finding | Severity | Evidence | Remediation commit/deployment/transaction | Verification | Residual risk |
| --- | --- | --- | --- | --- | --- |
| TODO | TODO | TODO | TODO | TODO | TODO |

Explicitly state which of these conclusions the evidence supports:

- [ ] Confirmed malicious behavior was found and removed.
- [ ] A compromised deployment or control plane was found while reviewed source was clean.
- [ ] A vulnerable or misleading interaction was found, but no credential theft or transaction substitution was observed.
- [ ] No malicious behavior was found after the documented source, build, deployment, runtime, and on-chain checks; a false-positive appeal is appropriate.
- [ ] Evidence remains insufficient; do not appeal yet.

## 11. Appeal package

The fail-closed submission template is
[`METAMASK-APPEAL-DRAFT.md`](METAMASK-APPEAL-DRAFT.md). It remains marked
`NOT READY TO SUBMIT` until this checklist and its placeholders are complete.

- [ ] Concise incident timeline and containment summary.
- [ ] Exact affected origin/address and warning reproduction.
- [ ] Full reviewed commit and clean deployment IDs.
- [ ] Immutable CI, audit, signature, secret-scan, static-analysis, test, and artifact-parity evidence.
- [ ] Live contract bytecode and authority inventory.
- [ ] Transaction traces showing that prompts match visible user intent.
- [ ] Explanation of any original trigger and the exact remediation.
- [ ] Residual risks and monitoring plan.
- [ ] Contact that can answer provider questions without sharing secrets.

Do not assert "false positive" unless the evidence covers both the code repository and the live deployment/control plane. Ask the provider to identify the triggering URL, address, transaction pattern, or list entry if it is not already disclosed.

## 12. Sign-off

| Role | Name/GitHub identity | UTC date | Reviewed evidence digest | Decision |
| --- | --- | --- | --- | --- |
| Incident lead | TODO | TODO | TODO | TODO |
| Source reviewer | TODO | TODO | TODO | TODO |
| Build/deployment reviewer | TODO | TODO | TODO | TODO |
| Contract/on-chain reviewer | TODO | TODO | TODO | TODO |

Final decision and monitoring/rollback owner:

```text
TODO
```
