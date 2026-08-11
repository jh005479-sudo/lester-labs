# Post-compromise contract replacement

This document is the incident-recovery and contract-replacement track. It does
not diagnose or appeal MetaMask's site classification; that investigation must
remain evidentially separate from any transaction signed during recovery.

## Safety status

No production deployment has been executed or approved. On 2026-08-06, the
narrowly authorised valueless `testnet-immutable-disposable` profile deployed
successfully from source commit
`abcf1b75ee7945f557163dce11485555da63a5b6`; its credential-free independent
verifier passed after all thirteen CREATE transactions. Exact read-only copies
of that run's manifest and two-pass build attestation are preserved in
[`docs/security/evidence/disposable-testnet-4441-2026-08-06/`](security/evidence/disposable-testnet-4441-2026-08-06/README.md).
This execution is functional-test evidence only and does not satisfy production
containment, frontend activation, or reputation-appeal gates. Both deployment
paths remain fail-closed unless the operator supplies the profile's exact
acknowledgements after reviewing a read-only preview.

Two source-pinned deployment profiles deliberately serve different purposes:

| Profile | Plan | Permitted use | Authority model |
| --- | --- | --- | --- |
| `production-separated-authority` | `contracts/deployment/post-compromise-plan.json` | Public cutover and reputation-remediation evidence | Fresh gas-only EOA, controller multisig, and treasury multisig; all three distinct |
| `testnet-immutable-disposable` | `contracts/deployment/disposable-testnet-plan.json` | Isolated valueless functional testing only | Disclosed wallet is gas payer and fee recipient only; every administrative and governance capability is frozen at LitVM's `0x0000000000000000000000000000000000000001` ECRECOVER precompile |

The production plan's controller and treasury remain zero-address
placeholders, and `contracts/deployment/production-authorities.json` remains an
`UNREVIEWED` sentinel, so every production preview and deployment fails until
reviewed values for both files are committed together. The authority inventory
strictly pins each Safe address, proxy runtime, slot-zero implementation,
implementation runtime, official Safe source release and full commit, exact
owner order, and threshold. The proxy and SafeL2 implementation hashes are
derived from the signed, exact Safe 1.4.1 artifact documented in
[`security/SAFE-RUNTIME-PROVENANCE.md`](security/SAFE-RUNTIME-PROVENANCE.md),
not accepted from an operator's source claim. Both proxies must use the same
pinned singleton implementation. New incident-recovery Safes must have no
enabled module, guard, or fallback handler, closing extension paths that could
bypass their signer thresholds; a zero address cannot masquerade as an
unreviewed value.
The inventory requires two distinct reviewer approvals with separate evidence
digests. The validator requires at least two owners and a threshold of at least
two, rejects EOAs for both durable authorities, and rejects every known
incident-associated or chat-disclosed address. Shared owners are permitted only
when their count is below both Safe thresholds; a shared coalition therefore
cannot control either authority. Identical owner sets are also rejected so
separate Safe addresses cannot masquerade as separate control domains. A
private key pasted into chat is disclosed
even if it was newly generated. It must never be a production owner,
administrator, treasury, fee setter, multisig signer, or deployer. A public key
can be drained or nonce-raced by anyone. Production therefore uses a new,
single-purpose gas-only EOA funded with only enough testnet native token, and
the scripts reject both known incident addresses even in that role.

The disposable profile is a narrow exception authorised for this valueless
testnet. It pins the disclosed address only as the transaction signer and
economic fee recipient. It cannot be an owner, fee setter, routing controller,
governance canceller, token holder, or Timelock role member. Before any write,
the deployment and manifest verifier submit a known secp256k1 test vector to
address `0x…01` and require the standard ECRECOVER result, proving that the
configured authority is the chain precompile rather than an ordinary account.
The entire initial LGT supply is issued to and self-delegated by that frozen
address, leaving no account able to propose, transfer votes, mint, administer,
or reconfigure the disposable stack.

This exception does not make the public signer trustworthy. Anyone can spend
its gas, race its nonce, withdraw test fees received by it, create sibling
contracts, or manufacture activity associated with it. A disposable execution
must stop on nonce drift, retain any partial journal for investigation, and be
kept off the public Lester Labs origin. Its addresses and manifest are
structurally forbidden from frontend activation and must never be used in a
MetaMask appeal, public cutover, safety claim, or production evidence package.
Every privileged production address is assigned in constructor calldata, and
the fresh production gas EOA is retired after its one sequence.

Controller and treasury are deliberately separate security domains. The plan,
every role-bearing replacement constructor, every treasury setter and every
ownership-transfer path rejects a collapsed owner/controller and treasury.
The DEX likewise rejects `feeToSetter == feeTo`.

Before attestation, run the credential-free authority check from `contracts/`
with `DEPLOYER_PRIVATE_KEY` absent:

```sh
npm run verify:production-authorities:litvm
```

The command pins all reads to one exact positive LitVM block, confirms that the
block hash stays stable for the full check, and prints a JSON evidence record
containing the inventory SHA-256, block number/hash, and verified public Safe
facts. Preserve that output and its SHA-256 in the production evidence bundle.
The production build attestation separately binds the exact authority-inventory
file. Preview/deployment repeat the current-state check before any CREATE, and
the independent manifest verifier requires the same inventory at both the
pre-deployment checkpoint and its current verification block. This verifier
also binds each authority to the exact pinned SafeProxyFactory transaction,
chain-specific CREATE2 derivation, creation block/hash, and zero-extension Safe
initializer. It requires no code at the prior block, exactly one ProxyCreation
and SafeSetup, Safe nonce zero, and EOA owners at the verification block. It
exhaustively scans Safe-address logs from creation in bounded block ranges and
rejects every later execution, hash approval, signer/threshold/configuration
change, extension, and unknown event. The sole permitted later event is a
well-formed `SafeReceived`, because any account can send harmless native dust
to the authority; its count is recorded in the verification report. Review
approvals must postdate both canonical creation-block timestamps, cannot
postdate the canonical verification block, and expire after 30 days. This
renewable review window provides chain-rate-independent freshness without
forcing clean, unused Safes to be recreated as block height advances. The
independently reviewed gas-only deployer is
rejected if it is either Safe, either singleton/factory, or any owner. The same
facts are rerun through the distinct secondary RPC before activation. This
verifier must never be run with a signing key.

On-chain history cannot prove that an owner key has never produced an offline
ECDSA signature. The external authority-review evidence must therefore record a
fresh hardware-backed owner-key ceremony, independent custody, no chat or build
machine exposure, and direct reviewer confirmation. The runtime check proves
that every listed owner is an EOA at cutover; it does not substitute for that
custody evidence. Native value forced in without executing Safe code (for
example by contract destruction), ERC-20 balances transferred to the Safe, and
ordinary `SafeReceived` dust do not alter authority storage and are not treated
as evidence of Safe use. Reviewers must still account for material unexpected
balances separately.

## Exact deployment order

The script uses ordinary CREATE addresses derived from the gas-only deployer.
Production requires a fresh nonce-zero EOA; the disposable profile records its
already-used signer nonce separately. It calculates and prints all thirteen
addresses before the first transaction, then rejects any nonce drift at every
step.

1. `WETH9` (`WrappedZkLTC`) — fresh, adminless wrapped native token.
2. `UniswapV2Factory` — controller becomes `feeToSetter`; treasury becomes
   `feeTo` in the constructor. Pairs retain the canonical Uniswap V2 `0.30%`
   invariant and protocol-fee LP-minting formula; they never transfer a fixed
   slice of each swap input directly to treasury.
3. `UniswapV2Router02` — fresh, immutable factory and wrapped-native links.
4. `UniSwapConnector` — fresh, immutable router, factory, treasury, controller,
   and wrapped-native links.
5. `TokenFactory` — reviewed controller is initial owner; each creation fee is
   forwarded immediately to the reviewed treasury.
6. `VestingFactory` — reviewed controller is initial owner; each creation fee
   is forwarded immediately to the reviewed treasury.
7. `LiquidityLocker` — reviewed controller is initial owner; each lock fee is
   forwarded immediately to the reviewed treasury.
8. `TheLedger` — reviewed treasury and controller are both constructor values.
9. `Disperse` — fresh and adminless, with reentrancy protection, safe ERC-20
   transfers, caller/token/recipient-count/total audit events, and an O(1)
   monotonic `totalRecipientEntries` counter. Each distribution has 1–200
   positive-value recipient entries; duplicate addresses count as separate
   entries, not unique users.
10. `ILOFactory` — router, connector, treasury, fee configuration, and
    controller are all supplied in one constructor transaction. It pins the
    fresh DEX factory immutably and requires the connector's router, factory,
    treasury, controller, and live `assertTreasuryRouting()` attestation to
    match, preventing later routing back to the legacy DEX.
11. `LitGovToken` — in production, mints exactly 10,000,000 LGT to the reviewed
    treasury; in the disposable profile, mints it to frozen `0x…01`. It
    self-delegates that initial balance and assigns mint ownership directly to
    the predicted Timelock address. The deployer never owns or receives LGT.
12. `LitTimelock` — two-day delay; predicted Governor is the sole proposer and
    executor, the controller is the sole emergency canceller, and the Timelock
    itself is the sole default admin. The deployer and treasury have no role,
    and the zero address does not open execution to everyone.
13. `LitGovernor` — pins the token, Timelock, one-block voting delay, 45,600
    block voting period, 100,000 LGT proposal threshold, and 4% quorum.

There is no post-deploy ownership transfer or connector setup window. The
production gas-only signer has no privileged or economic role at any
intermediate or final state. The disposable signer has no privileged role and
is only the fixed test-fee recipient.
Token, vesting, locker, and ILO fees are forwarded rather than accumulated for
a later sweep; fee setters are capped at 0.1 native token. TheLedger preserves
its documented 50% immediate treasury / 50% held-remainder economics. Its
permissionless `flushRetainedFeesToTreasury()` liveness function can pay only
the configured treasury; the caller cannot choose a recipient. This avoids a
generic owner sweep and prevents a frozen disposable controller from stranding
the held remainder.

The replacement path intentionally deploys fresh instances of every listed
component, including the immutable/adminless ones. It does not reuse a legacy
router, wrapped-native contract, connector, Disperse deployment, or factory.
This avoids treating “no owner method” as evidence that old runtime is safe.

Future ILO controller recovery must also be coordinated. `ILOFactory` rejects
plain ownership transfer and renunciation because its connector pins the DEX
controller; a plain transfer would strand creation behind a permanently
mismatched connector. In one decoded multisig batch, deploy a reviewed
replacement connector, update DEX `feeTo`/`feeToSetter` as applicable, and call
`rotateControlAndRouting(newController, router, connector, treasury)`. That
final call re-attests the router, immutable DEX factory, treasury, controller,
and live connector routing before changing ownership. Never split this
sequence across independently approved operator sessions.

The build attestation contains sixteen artifact records: thirteen direct
deployments, the factory-created `UniswapV2Pair` and `ILO` generations, and the
`VestingWallet` template plus its compiler-declared immutable ranges.

## Analytics cutover capture

The checked-in homepage values are a provisional first-party floor, not the
final deployment snapshot. Legacy activity can continue while the stale public
deployment remains reachable. Immediately before the production alias moves,
run `npm run security:capture-activity` from a clean credential-free host. The
read-only command pins TokenFactory creations, both ILO factory counters, and
Ledger messages to one exact LitVM block. It carries forward the displayed
airdrop-entry and swap floors separately because the legacy Disperse contract
has no authenticated counter/event and the historical swap API can be bounded
or cached. Review those limitations rather than presenting them as unique-user
or volume measurements.

Save that JSON as an immutable candidate. From a second clean network, use a
different credential-free HTTPS RPC URL to re-read the candidate's exact
`throughBlock`. Paths are allowed; credentials, query strings, fragments, and
the primary Caldera RPC origin are rejected:

```bash
node scripts/security/verify-platform-activity-cutover.mjs <candidate.json> <second-public-rpc-url>
```

Save the verifier JSON as a second immutable file. The verifier rejects the primary capture origin, credentialed/query-string
endpoints, changed block identity, altered source configuration, counters below
the continuity floors, mismatched exact-block legacy runtimes, or any counter
disagreement. The production exporter canonical-validates the candidate, live
re-runs the second-RPC proof through the preserved URL, and proves at the same
block that TokenFactory creations, Router swaps, Disperse recipient entries,
Ledger messages, and ILO children are all zero in the replacement deployment.
It binds both raw files, the canonical candidate digest, and the literal zero
counters into the independently reviewed approval payload. Set each replacement
activity start block to `throughBlock + 1`; the source configuration fails its
build if activation is attempted with an inconsistent floor.

## Read-only preview

Production builds, attestations, previews, deployments, and verification remain
restricted to a newly created, digest-pinned x64 Linux ephemeral runner from
the reviewed commit. The factory-reset Mac exception described below applies
only to the valueless `testnet-immutable-disposable` profile; it can never
attest, verify, or deploy the `production-separated-authority` profile. The
disposable execution described above has occurred; no production replacement
deployment has occurred.

On the production runner, install only from the exact lockfile with
`npm ci --ignore-scripts`, complete `npm audit` and `npm audit signatures`, and
pre-populate Hardhat 3's private `compilers-v3/linux-amd64` cache with the three
exact compiler builds. Independently verify their digests, then remove every
write bit from every regular file and directory under the newly installed
`node_modules` and enforce it with a read-only mount or separately owned
immutable layer. Every symlink must resolve back inside that tree. Disable
outbound network before compilation. No wallet, hosting, cloud, registry, SSH,
or deployment secret may be present. Hardhat's `artifacts/`, `cache/`, and
`typechain-types/` outputs and the compiler cache must remain outside
`node_modules`. Attestation, preview, deployment, and verification all run as
an unprivileged non-root user; the scripts reject root.

The committed `deployment/replacement-build-attestation.json` remains a
deliberate `NOT_ATTESTED` sentinel. The trusted runner writes the real
attestation to a new path outside the checkout; it is an immutable release
artifact, not a self-referential source commit. The attestation command rejects
an unauthorised platform/profile combination, an in-workspace output, a dirty
tree, missing pre-pinned Node/Hardhat/compiler digests, or an overwrite. Its
controlled compile environment does not forward `HOME`. It performs two forced
compilations and requires identical records
for sixteen artifacts, including Pair, ILO and VestingWallet. Each Hardhat 3
artifact supplies a canonical `buildInfoId`; the attestation binds both
`artifacts/build-info/<buildInfoId>.json` and the separate
`artifacts/build-info/<buildInfoId>.output.json` by SHA-256. Hardhat 2
`.dbg.json` files are neither
trusted nor required. The record also binds all three exact compiler builds,
the Node and absolute-path Git executables, Hardhat package metadata and CLI,
lockfile, `.npmrc`, config, plan, production authority inventory (for the
production profile), and source commit. It walks every
`node_modules` entry without exclusions and hashes the sorted relative path,
type, mode, symlink target and file content. A writable entry, special file,
escaping symlink, changed tree between compiler passes, or non-directory tree
root is a hard failure.

The operator supplies runner-specific absolute paths and independently
reviewed SHA-256 values to `npm run attest:replacements` for production or
`npm run attest:replacements:disposable-testnet` for the disposable profile.
The attestation embeds the exact profile and source-pinned plan path; it cannot
be reused across profiles. Concrete runner values belong in the signed build
record, not this repository. At minimum the production runner sets
`REPLACEMENT_TRUSTED_EPHEMERAL_BUILD=true`,
`REPLACEMENT_NETWORK_DISABLED=true`, `REPLACEMENT_BUILD_HOME`,
`REPLACEMENT_BUILD_TMPDIR`, `REPLACEMENT_BUILD_PATH`,
`REPLACEMENT_BUILD_ATTESTATION_OUTPUT`, the reviewed Node and Hardhat digests,
the reviewed absolute Git path/digest, the reviewed Linux compiler-list digest,
and the reviewed SHA-256 digest for each of solc 0.5.16, 0.6.6 and 0.8.24.
`REPLACEMENT_BUILD_HOME` is task-specific private build state and is not
assigned to the process `HOME`; `HOME` is not forwarded. Build state and TMP
must be separate real private directories owned by the unprivileged operator
with no group/other access. The external attestation parent must be a real
operator-owned directory with no group/other write access. Never hand-edit the
resulting attestation.

Do not expose the gas-only signer for preview. The deploy script re-hashes the
attestation, clean source state, and selected artifacts immediately before
every CREATE transaction. It hashes the complete read-only `node_modules` tree
once immediately before the keyed deployment and again after the attempt, so
changed artifacts or dependencies fail closed and a post-attempt change is
recorded. The full tree is intentionally not re-read before every CREATE;
read-only mount/ownership is the intervening control.
Hardhat does not auto-load `.env`; all approved runtime values must be injected
explicitly by the clean runner or its secret broker. The currently pinned
`dotenv` package remains installed but unused so that its removal can occur in
a separate dependency-only pull request with lockfile and supply-chain review.

From `contracts/`, set only the gas-only public address in the shell, keep
`DEPLOYER_PRIVATE_KEY` absent, mount both the external attestation and the
already attested `node_modules` tree read-only, and run the production preview:

```sh
export REPLACEMENT_BUILD_ATTESTATION_PATH=/absolute/read-only/release/replacement-build-attestation.json
export EXPECTED_REPLACEMENT_BUILD_ATTESTATION_SHA256=0x_REVIEWED_SHA256
export REPLACEMENT_GIT_EXECUTABLE_PATH=/absolute/reviewed/path/to/git
export EXPECTED_REPLACEMENT_GIT_EXECUTABLE_SHA256=0x_REVIEWED_GIT_SHA256
export EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS=0x_GAS_ONLY_PUBLIC_ADDRESS
export REPLACEMENT_PREVIEW_ONLY=true
npm run deploy:litvm
unset REPLACEMENT_PREVIEW_ONLY
```

For the isolated disposable profile, use its separately generated attestation,
set `EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS` to the address pinned in
`disposable-testnet-plan.json`, and substitute:

```sh
export REPLACEMENT_PREVIEW_ONLY=true
npm run deploy:litvm:disposable-testnet
unset REPLACEMENT_PREVIEW_ONLY
```

Preview mode verifies the LitVM chain ID, locally pinned legacy runtime hashes,
the reviewed plan and build attestation, every source-pinned production Safe
fact, the configured public gas-only
address, absence of pending transactions for that address, and all predicted
CREATE addresses without loading a signer. Using the
absolute digest-pinned Git executable with hooks, fsmonitor and external config
disabled, it also requires the expected repository root, `HEAD == sourceCommit`,
no staged, unstaged, or untracked file, no submodule, and no
`assume-unchanged`/`skip-worktree` index flag that could hide a local change.
The attester repeats the commit, index, and status checks after both compiler
passes. Preview sends no transaction and writes no deployment record.

Review the controller/treasury contract code, multisig implementation, owners,
threshold, modules, guard and fallback handler; then review the plan hash,
nonce-zero production signer, order, and every predicted address on a second
clean device. The deployer verifies that production controller and treasury
already have contract code, but it cannot infer that arbitrary code is a safe
multisig. Record that independent review in the evidence file. Any pending
transaction or nonce change invalidates the preview; repeat it rather than
trying to compensate.

## Approved execution and verification

### Production profile

Only after the preview is independently approved:

```sh
# Inject the fresh single-use key only now through the approved ephemeral
# runner secret mechanism; do not use a local .env file or paste it here.
export REPLACEMENT_RECORDS_DIRECTORY=/absolute/private/external/deployment-records
export ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT=DEPLOY_FRESH_POST_COMPROMISE_STACK
npm run deploy:litvm
unset ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT
```

Pre-create `REPLACEMENT_RECORDS_DIRECTORY` outside the repository with mode
`0700`; symlinks and any group/other permission are rejected. Keeping journals
external prevents the mandatory clean-worktree check from failing after the
first transaction and avoids mixing mutable release evidence into the attested
source tree. The script re-runs the preflight and nonce calculation. A
`.partial.json` file means execution stopped and must be investigated; do not
blindly restart from a new nonce. On success, the script:

- checks every transaction sender, nonce, CREATE address, receipt, runtime
  code size, and runtime hash;
- reconstructs exact constructor calldata from the local compiled artifacts;
- simulates each constructor again with `eth_call` and requires the resulting
  runtime to match the deployed runtime, including immutable values;
- verifies every owner, treasury, DEX fee role, router/connector link, fee, and
  empty replacement ILO inventory;
- verifies the Router starts with `totalSwapCount == 0`. The counter advances
  once per successful public Router swap call across all nine swap entrypoints,
  regardless of hop count; reverted calls and direct Pair swaps do not count.
  It is a permissionless action counter, not a unique-user or volume metric,
  and valid low-value swaps can deliberately inflate it;
- verifies the exact governance supply, delegation, role graph, parameters,
  zero deployer balance/votes, and empty proposal inventory;
- verifies Disperse's 200-entry cap and initial zero recipient-entry counter;
- verifies that the production gas-only deployer is neither an authority nor
  an economic recipient; and
- promotes the journal to a final `.json` manifest only after all checks pass.

Re-run the independent read-only verifier from a second trusted ephemeral
runner and RPC:

1. Read `buildSourceCommit` from the deployment manifest.
2. Check out that exact commit on a clean runner. It intentionally contains the
   `NOT_ATTESTED` placeholder.
3. Install only from the reviewed immutable lockfile with `npm ci
   --ignore-scripts`, reproduce the two-pass build with a fresh HOME/cache and
   the same digest-pinned compiler binaries while offline, and compare its
   external attestation digest with the published release artifact and manifest.
4. Without loading any key, run the verifier:

```sh
unset DEPLOYER_PRIVATE_KEY
export REPLACEMENT_MANIFEST_PATH=/absolute/path/to/replacement-4441-ADDRESS-nonce-N.json
export REPLACEMENT_BUILD_ATTESTATION_PATH=/absolute/read-only/release/replacement-build-attestation.json
export EXPECTED_REPLACEMENT_BUILD_ATTESTATION_SHA256=0x_REVIEWED_SHA256
export REPLACEMENT_GIT_EXECUTABLE_PATH=/absolute/reviewed/path/to/git
export EXPECTED_REPLACEMENT_GIT_EXECUTABLE_SHA256=0x_REVIEWED_GIT_SHA256
export EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS=0x_GAS_ONLY_PUBLIC_ADDRESS
npm run verify:replacements:litvm
```

After independent verification and an approved atomic analytics snapshot,
derive—not hand-enter—the frontend activation package on the clean runner:

```sh
export REPLACEMENT_DEPLOYMENT_PROFILE=production-separated-authority
export REPLACEMENT_MANIFEST_PATH=/absolute/path/to/replacement-manifest.json
export PLATFORM_ACTIVITY_CUTOVER_PATH=/absolute/path/to/cutover-candidate.json
export PLATFORM_ACTIVITY_SECOND_RPC_PROOF_PATH=/absolute/path/to/second-rpc-proof.json
export PUBLIC_FRONTEND_PACKAGE_OUTPUT_PATH=/absolute/private/external/frontend-candidate.json
npm run export:public-frontend:litvm
```

Without `PUBLIC_FRONTEND_APPROVALS_PATH`, the exporter emits a fail-closed
`CANDIDATE` and its exact `approvalPayloadSha256`. It requires distinct reviewed
HTTPS RPC origins, re-runs the complete manifest verifier against both RPCs, and
independently checks deployment transactions/receipts, runtime bytecode and
lengths, constructor parameters, role bindings, legacy anchors, exact-block Safe
facts, and all five literal-zero replacement counters. The payload embeds that
second-RPC report, its RPC URL, exact block/hash, verified scope, complete Safe
report, counters, manifest digest, and an independently recomputed report digest.
It also binds the raw production-authority and control-plane recovery files and
derives Pair/ILO child hashes plus VestingWallet immutable ranges from attested
compiler output.

At least two protected independent reviewers must review that exact payload and
produce an external file of this shape:

```json
{
  "approvalPayloadSha256": "0x<64 lower-case hex characters>",
  "reviewerApprovals": [
    {
      "reviewer": "<reviewed identity>",
      "reviewRole": "source-security",
      "approvalPayloadSha256": "0x<same payload digest>",
      "evidenceSha256": "0x<reviewer evidence digest>",
      "approvedAt": "2026-08-10T20:00:00.000Z"
    },
    {
      "reviewer": "<different reviewed identity>",
      "reviewRole": "release-operations",
      "approvalPayloadSha256": "0x<same payload digest>",
      "evidenceSha256": "0x<different reviewer evidence digest>",
      "approvedAt": "2026-08-10T20:01:00.000Z"
    }
  ]
}
```

These records are auditable review assertions, **not cryptographic signatures**
and not the reviewer-authentication mechanism. Their strings and digests cannot
establish authorship. Reviewer authenticity and promotion authority therefore
come from the separate protected frontend approval/promotion envelope, protected
branch and environment controls, and direct independent confirmation. Re-run
the exporter with `PUBLIC_FRONTEND_APPROVALS_PATH` and a new
nonexistent output path; only then can it emit `APPROVED`. Commit that exact
package as `src/config/approvedPublicReplacement.json` with both source latches.
`next build` and `npm run security:public-manifest` recompute the digests and
reject partial, duplicated, mismatched, nonzero-counter, or stale-evidence data.

The resulting build is still a release candidate. It must not be served on the
public origins until the separate protected x64 Linux frontend `APPROVED`
manifest, deployment, and apex/www byte-for-byte parity gate passes. That
frontend artifact is deliberately not embedded in this payload because doing
so would create an impossible self-reference.

### Disposable functional-test profile

The disposable profile remains subject to the dependency-audit, two-pass
attestation, preview, external-journal, nonce, bytecode and independent-
verification gates. It may use either the production-grade Linux runner or an
unprivileged factory-reset Darwin arm64/x64 Mac solely because this profile is
immutable, isolated to testnet and uses functionally valueless gas. The Darwin
exception cannot create a production attestation and cannot produce a public
frontend activation package.

On Darwin, the operator must set the exact acknowledgement below for both
attestation and later verification. The attester records environment kind
`factory-reset-darwin-disposable`, requires the network-disabled assertion and
private external build-state/TMP directories, and does not forward or override
`HOME`. Hardhat 3 uses its native user cache at
`~/Library/Caches/hardhat-nodejs/compilers-v3`; therefore the attestation pins
the exact `macosx-amd64` and `wasm` compiler-list digests and every selected
compiler filename/digest. Solc 0.8.24 must use the reviewed native build. Solc
0.5.16 and 0.6.6 may use WASM only when each native build has its exact reviewed
`.does.not.work` marker; the marker digest and `isSolcJs` selection are recorded
and verified, so fallback cannot occur silently.

Before building on the factory-reset Mac:

```sh
export USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY=true
export REPLACEMENT_NETWORK_DISABLED=true
export REPLACEMENT_BUILD_HOME=/absolute/private/external/build-state
export REPLACEMENT_BUILD_TMPDIR=/absolute/private/external/tmp
export EXPECTED_SOLC_MACOSX_AMD64_COMPILER_LIST_SHA256=0x_REVIEWED_SHA256
export EXPECTED_SOLC_WASM_COMPILER_LIST_SHA256=0x_REVIEWED_SHA256
export EXPECTED_SOLC_0_5_16_DOES_NOT_WORK_MARKER_SHA256=0x_REVIEWED_SHA256
export EXPECTED_SOLC_0_6_6_DOES_NOT_WORK_MARKER_SHA256=0x_REVIEWED_SHA256
npm run attest:replacements:disposable-testnet
```

Supply the common Node, Git, Hardhat, compiler-file, path and external-output
values described above as well. The explicit acknowledgement is an assertion
about the operator-reviewed factory-reset host; it is not evidence suitable for
a production release.

Deployment additionally requires conspicuous acknowledgement of the public
signer's nonce and identity risk:

```sh
# Inject the already disclosed, valueless testnet key only through the isolated
# runner secret mechanism after the no-key preview.
export REPLACEMENT_RECORDS_DIRECTORY=/absolute/private/external/disposable-records
export USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY=true
export ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT=DEPLOY_DISPOSABLE_IMMUTABLE_TESTNET_STACK
export ACKNOWLEDGE_DISPOSABLE_TESTNET_SIGNER=ACCEPT_PUBLIC_TESTNET_SIGNER_NONCE_RISK
npm run deploy:litvm:disposable-testnet
unset ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT ACKNOWLEDGE_DISPOSABLE_TESTNET_SIGNER
```

Independent verification uses the matching disposable attestation and command:

```sh
unset DEPLOYER_PRIVATE_KEY
export USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY=true
export REPLACEMENT_MANIFEST_PATH=/absolute/path/to/disposable-manifest.json
export EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS=0x_SOURCE_PINNED_DISPOSABLE_ADDRESS
npm run verify:replacements:disposable-testnet
unset USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY
```

The verifier requires gas payer and treasury to match the pinned disposable
address, all owners/controllers/DEX setters/canceller roles and the complete
initial LGT balance and voting power to equal verified ECRECOVER precompile
`0x…01`, and the signer to have zero LGT balance and votes. Successful
verification authorises functional testing only. Do not copy these addresses
into the public frontend configuration.

The verifier also requires the manifest's plan hash to equal the checked-in
plan byte-for-byte, and its build-attestation hash and source commit to equal
the independently reviewed local attestation. Before running it, make the
freshly installed dependency tree match the attested read-only modes; the
verifier rejects every writable file/directory, escaping symlink, special file,
or tree-digest mismatch. It refuses to run while a deployment private key is
loaded. Production addresses must not be published and paid actions must not be
enabled until this independent verification passes. Disposable addresses must
not be published or activated even after they pass.

The dependency digest closes post-install file mutation; it does not prove the
host kernel, parent process, mounted filesystem, Node process memory, or secret
broker is honest. A file owner may also restore write bits unless the OS mount,
container layer, or separate ownership prevents it. Treat the pre/post hashes
as point-in-time evidence, keep the live runner unprivileged and network-
restricted, inject the key only after the no-key preview, and destroy the
runner and signer after deployment. This residual process/TOCTOU trust requires
manual review and cannot be removed by an application-level script alone.

## Legacy recovery is preserved

The deployment script never sends a transaction to a legacy contract. Before
the first new deployment it verifies every legacy runtime against the pinned
inventory in `contracts/scripts/lib/live_treasury_audit.ts`, and the output
manifest retains those addresses and hashes as recovery anchors.

Two distinct legacy ILO factories are provenance targets and must remain in
the recovery inventory:

- hidden production-build factory
  `0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f`, runtime hash
  `0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5`,
  with 8,330 children observed on 2026-08-04; and
- canonical legacy factory `0xA533bbe87BDCd91E4367dE517E99bF8Ba75Fd0Ab`,
  runtime hash
  `0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a`,
  with 121 children observed on 2026-08-04.

The combined observed inventory was 8,451 children. Counts can grow while a
legacy factory remains callable, so the addresses and runtime hashes are hard
attestations while the counts are dated provenance observations, not caps.

Keep the canonical legacy ILO factory discovery/recovery-only. Existing ILO
contributors and owners must retain access to the contract's applicable
`claim`, `refund`, `cancel`, LP withdrawal, and excess-token recovery paths.
Do not route new contributions, finalizations, liquidity, approvals, or token
creation through legacy addresses. Factory replacement cannot rewrite values
embedded in existing child contracts, and new DEX liquidity must be seeded
separately after review.

### Optional legacy authority recovery

A read-only live RPC check on 2026-08-04 showed that the July rotation had
never executed. Core owner/treasury roles and both DEX fee roles were still at
the compromised `0xDD22…` controller. At that observation, native balances
were approximately 8,331.8 zkLTC in TokenFactory, 221.31 in VestingFactory,
483.78 in LiquidityLocker, and 333.88 in TheLedger. These values are not a
guarantee; re-read owner, code hash, nonce, balance, and pending transactions at
one fresh block before deciding whether recovery remains possible.

The historical rotation script is retired because it targeted the
incident-associated `0xCbf8…` address. Do not use that address or the newly
disclosed key-derived `0x4399…` address. Do not use the old sweeping script: on the legacy runtimes it would
send accumulated fees to the current compromised owner.

If the current legacy owner key is still available and recovery value justifies
the race risk, an operator may consider a narrowly reviewed manual recovery
from a clean isolated device. This is optional and separate from replacement:

1. Approve a new address-only hardware multisig destination on independent
   clean devices. Prepare and decode every calldata payload before exposing the
   legacy key; never import that key into the previously compromised Mac or a
   browser wallet.
2. Re-attest every legacy runtime hash and current owner at one block. Abort if
   code, owner, DEX roles, or nonce differs from the reviewed snapshot.
3. With the legacy signer, transfer TokenFactory, VestingFactory, and
   LiquidityLocker ownership directly to the safe multisig. Do not withdraw
   first. After finality, the multisig may invoke their legacy withdrawal
   methods so proceeds never return to the compromised EOA.
4. With the legacy signer, set ILOFactory and TheLedger treasury routes to the
   safe destination, then transfer their ownership. Existing ILO children keep
   their embedded legacy treasury regardless of factory rotation. TheLedger's
   accumulated native remainder has no withdrawal method and is not recoverable
   through ownership.
5. Set DEX `feeTo` to the safe treasury, then make `feeToSetter` the safe
   controller as the final DEX transaction. Moving the setter first removes the
   legacy signer's ability to complete fee routing.
6. Treat governance token ownership, balances, delegation, Timelock roles, and
   pending operations as a separate high-risk recovery. Do not reuse the
   retired governance deployment or July rotation automation.
7. Re-read all state from a second RPC after finality. Assume an attacker who
   has the same legacy key can race, cancel, or replace transactions; an
   isolated device protects new credentials but cannot make the old key secret
   again.

No legacy recovery transaction was generated, signed, or broadcast as part of
this implementation.

## Production signer requirements

- **Gas-only deployer:** one new nonce-zero, single-use trusted EOA signs exactly thirteen
  CREATE transactions. It
  needs minimal testnet gas and no other funds, permissions, allowances,
  credentials, or durable role. Both known exposed incident addresses are
  rejected. Retire the EOA after the manifest is final.
- **Controller:** no signature is required during deployment. It must already
  be a separately reviewed multisig contract. After deployment, that authority
  alone can change application fees, treasury routes,
  ILO routing, ownership, and the DEX fee setter. Protect it as the principal
  administrative key and the governance emergency canceller.
- **Treasury:** no signature is required during deployment. It must be a
  different separately reviewed multisig contract. It receives factory,
  ILO, ledger, and DEX fees and the initial 10,000,000 LGT supply. It must be
  distinct from the controller and Timelock owner role.
- **Legacy users/owners:** their own signatures remain necessary for recovery
  actions on legacy child contracts. The replacement deployer cannot recover
  assets on their behalf.

No controller-to-deployer transfer, deployer-to-controller transfer, or other
temporary-admin transaction is part of this architecture.

The disposable profile has no remaining administrative signer requirement:
all such capabilities are intentionally unreachable at the verified ECRECOVER
precompile. Its disclosed wallet is only a transaction sender and fixed
recipient of valueless test fees. That profile cannot be promoted into the
production architecture; production requires a new deployment using the three
separate roles above.
